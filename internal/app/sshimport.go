package app

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"sync"
	"time"
)

// Chats run over SSH keep their transcripts on the server, in
// ~/.claude/projects. The desktop app only lists chats that have an entry
// in claude-code-sessions, so these chats are indexed from the servers listed
// in the app's SSH configs and in the existing entries.

// sshChat summarizes one transcript on an SSH host.
type sshChat struct {
	Host       string `json:"host"`
	Path       string `json:"path"`
	Session    string `json:"session"`
	First      string `json:"first,omitempty"`
	Last       string `json:"last,omitempty"`
	Cwd        string `json:"cwd,omitempty"`
	Branch     string `json:"branch,omitempty"`
	Entrypoint string `json:"entrypoint,omitempty"`
	Title      string `json:"title,omitempty"`
	AITitle    string `json:"aiTitle,omitempty"`
	Model      string `json:"model,omitempty"`
	// Known marks a transcript the desktop already lists; it is only reported
	// for its Ancestors.
	Known bool `json:"known,omitempty"`
	// Ancestors are the sessions this transcript continues, from its
	// derived-from records: /clear, a fork or a compaction starts a new
	// transcript and leaves the old one behind.
	Ancestors []string `json:"ancestors,omitempty"`
}

// sshRemoteScript runs on the server with python3. It prints one JSON object
// per transcript that is not in KNOWN, which the caller prefixes. A transcript
// in KNOWN is only read for the sessions it continues, and printed when it has any.
const sshRemoteScript = `import glob, json, os
def ancestors(entry, own, found):
    sessions = entry.get("sessions")
    if entry.get("type") != "derived-from" or not isinstance(sessions, list):
        return
    for item in sessions:
        if isinstance(item, dict):
            for key in ("id", "started"):
                value = item.get(key)
                if isinstance(value, str) and value != own and value not in found:
                    found.append(value)
for path in sorted(glob.glob(os.path.expanduser("~/.claude/projects/*/*.jsonl"))):
    info = {"path": path, "session": os.path.basename(path)[:-6]}
    known = info["session"] in KNOWN
    found = []
    try:
        with open(path, encoding="utf-8", errors="replace") as stream:
            for line in stream:
                if known and '"derived-from"' not in line:
                    continue
                try:
                    entry = json.loads(line)
                except ValueError:
                    continue
                if not isinstance(entry, dict):
                    continue
                ancestors(entry, info["session"], found)
                if known:
                    continue
                stamp = entry.get("timestamp")
                if isinstance(stamp, str):
                    info.setdefault("first", stamp)
                    info["last"] = stamp
                for key, field in (("cwd", "cwd"), ("gitBranch", "branch"), ("entrypoint", "entrypoint")):
                    if isinstance(entry.get(key), str):
                        info.setdefault(field, entry[key])
                if entry.get("type") == "custom-title" and isinstance(entry.get("customTitle"), str):
                    info["title"] = entry["customTitle"]
                elif entry.get("type") == "ai-title" and isinstance(entry.get("aiTitle"), str):
                    info.setdefault("aiTitle", entry["aiTitle"])
                message = entry.get("message")
                if isinstance(message, dict) and isinstance(message.get("model"), str):
                    info["model"] = message["model"]
    except OSError:
        continue
    if found:
        info["ancestors"] = found
    if known:
        if not found:
            continue
        info = {"path": path, "session": info["session"], "known": True, "ancestors": found}
    print(json.dumps(info))
`

// runSSH runs `ssh -o BatchMode=yes -o ConnectTimeout=5 <host> python3 -` with stdin and returns stdout.
// It is a variable so tests can replace it.
var runSSH = func(ctx context.Context, host, stdin string) ([]byte, error) {
	cmd := hidden(exec.CommandContext(ctx, "ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=5", host, "python3", "-"))
	cmd.Stdin = strings.NewReader(stdin)
	return cmd.Output()
}

// sshHosts lists the SSH hosts to scan: the desktop's SSH configs first, then
// the hosts of existing chat entries. Each host appears once.
func sshHosts(userData, sessionsRoot string) []string {
	var hosts []string
	seen := map[string]bool{}
	add := func(host string) {
		// A host starting with "-" would be read by ssh as an option.
		if host == "" || strings.HasPrefix(host, "-") || seen[host] {
			return
		}
		seen[host] = true
		hosts = append(hosts, host)
	}

	if data, err := os.ReadFile(filepath.Join(userData, "ssh_configs.json")); err == nil {
		var cfg struct {
			Configs []struct {
				SSHHost string `json:"sshHost"`
			} `json:"configs"`
		}
		if json.Unmarshal(data, &cfg) == nil {
			for _, c := range cfg.Configs {
				add(c.SSHHost)
			}
		}
	}

	paths, _ := filepath.Glob(filepath.Join(sessionsRoot, "*", "*", "local_*.json"))
	for _, p := range paths {
		data, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		var entry struct {
			SSHConfig json.RawMessage `json:"sshConfig"`
		}
		if err := json.Unmarshal(data, &entry); err != nil {
			log.Printf("Skip ssh host of %s: %v", p, err)
			continue
		}
		var cfg struct {
			SSHHost string `json:"sshHost"`
		}
		if json.Unmarshal(entry.SSHConfig, &cfg) == nil {
			add(cfg.SSHHost)
		}
	}
	return hosts
}

// knownSSHSessions returns the CLI session IDs of every chat entry in any
// account, and the ones the user deleted. A chat's earlier CLI sessions count
// as known too: the app starts a new one for a chat after /clear or when it
// spawns the remote process again, which Remote Control does often, and keeps
// the old ones in the entry. A deleted_<x> marker is matched against entries
// by local ID, and x itself is also treated as deleted.
func knownSSHSessions(sessionsRoot string) (known, deleted map[string]bool) {
	known = map[string]bool{}
	deleted = map[string]bool{}
	cliByLocal := map[string]string{}
	var deletedLocal []string

	dirs, _ := filepath.Glob(filepath.Join(sessionsRoot, "*", "*"))
	for _, dir := range dirs {
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		for _, e := range entries {
			name := e.Name()
			switch {
			case e.IsDir():
				continue
			case strings.HasPrefix(name, "deleted_"):
				deletedLocal = append(deletedLocal, strings.TrimPrefix(name, "deleted_"))
			case strings.HasPrefix(name, "local_") && strings.HasSuffix(name, ".json"):
				path := filepath.Join(dir, name)
				entry, err := readSessionIndex(path)
				if err != nil {
					log.Printf("Skip session index %s: %v", path, err)
					continue
				}
				for _, id := range priorCLISessions(path) {
					known[id] = true
				}
				if entry.cli == "" {
					continue
				}
				known[entry.cli] = true
				cliByLocal[entry.localID()] = entry.cli
			}
		}
	}
	for _, local := range deletedLocal {
		deleted[local] = true
		if cli := cliByLocal[local]; cli != "" {
			deleted[cli] = true
		}
	}
	return known, deleted
}

// priorCLISessions returns the CLI sessions a chat entry used before its
// current one. A file that cannot be read has none.
func priorCLISessions(path string) []string {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var entry struct {
		CLI          string            `json:"cliSessionId"`
		PriorRemote  []json.RawMessage `json:"priorRemoteCliSessionIds"`
		Prior        []json.RawMessage `json:"priorCliSessionIds"`
		LeftSince    []json.RawMessage `json:"cliSessionIdsLeftSinceAnswer"`
		LeftAt       map[string]any    `json:"priorCliSessionLeftAt"`
		LastAnswered string            `json:"lastAssistantCliSessionId"`
	}
	if json.Unmarshal(data, &entry) != nil {
		return nil
	}
	var ids []string
	add := func(id string) {
		if id != "" && id != entry.CLI {
			ids = append(ids, id)
		}
	}
	for _, list := range [][]json.RawMessage{entry.PriorRemote, entry.Prior, entry.LeftSince} {
		for _, raw := range list {
			var id string
			if json.Unmarshal(raw, &id) == nil {
				add(id)
			}
		}
	}
	for id := range entry.LeftAt {
		add(id)
	}
	add(entry.LastAnswered)
	sort.Strings(ids)
	return ids
}

// removeSupersededSSHChats moves out the entries named after a CLI session
// that another chat has since left behind. The SSH import wrote them, and the
// app adopts such transcripts the same way; either way it lists the chat
// twice, and the old copy cannot go on. Entries the app made for a chat have a
// local ID of their own and are never moved. They go to backupDir, keeping
// their account folders. Returns the folders it changed.
func removeSupersededSSHChats(sessionsRoot, backupDir string) ([]string, error) {
	paths, _ := filepath.Glob(filepath.Join(sessionsRoot, "*", "*", "local_*.json"))
	prior := map[string]bool{}
	for _, p := range paths {
		for _, id := range priorCLISessions(p) {
			prior[id] = true
		}
	}
	var changed []string
	for _, p := range paths {
		entry, err := readSessionIndex(p)
		if err != nil || entry.cli == "" || entry.localID() != entry.cli || !prior[entry.cli] {
			continue
		}
		if o, err := readObject(p); err != nil {
			continue
		} else if _, ok := o.get("sshConfig"); !ok {
			continue
		}
		rel, err := filepath.Rel(sessionsRoot, p)
		if err != nil {
			return changed, err
		}
		dst := filepath.Join(backupDir, rel)
		if err := os.MkdirAll(filepath.Dir(dst), 0o700); err != nil {
			return changed, err
		}
		if err := os.Rename(p, dst); err != nil {
			return changed, err
		}
		log.Printf("Moved %s to %s: an earlier session of another chat", rel, backupDir)
		if dir := filepath.Dir(p); !slices.Contains(changed, dir) {
			changed = append(changed, dir)
		}
	}
	return changed, nil
}

// fetchSSHChats scans every SSH host in parallel for transcripts the desktop
// does not list yet. A session seen on several hosts comes from the first host
// in sshHosts order. A transcript that another one continues is left out: the
// desktop shows a chat once, by its latest session. Failing hosts are logged
// and returned, so the caller can keep what it knew about them.
func fetchSSHChats(ctx context.Context, userData, sessionsRoot string) (chats []sshChat, failed map[string]bool) {
	failed = map[string]bool{}
	hosts := sshHosts(userData, sessionsRoot)
	if len(hosts) == 0 {
		return nil, failed
	}
	known, deleted := knownSSHSessions(sessionsRoot)
	ids := make([]string, 0, len(known))
	for id := range known {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	idsJSON, err := json.Marshal(ids)
	if err != nil {
		return nil, failed
	}
	stdin := "KNOWN = set(" + string(idsJSON) + ")\n" + sshRemoteScript

	results := make([][]sshChat, len(hosts))
	errs := make([]error, len(hosts))
	var wg sync.WaitGroup
	for i, host := range hosts {
		wg.Add(1)
		go func(i int, host string) {
			defer wg.Done()
			hctx, cancel := context.WithTimeout(ctx, 60*time.Second)
			defer cancel()
			out, err := runSSH(hctx, host, stdin)
			if err != nil {
				log.Printf("ssh %s: %v", host, err)
				errs[i] = err
				return
			}
			results[i] = parseSSHChats(host, out)
		}(i, host)
	}
	wg.Wait()

	superseded := map[string]bool{}
	for i, group := range results {
		if errs[i] != nil {
			failed[hosts[i]] = true
		}
		for _, c := range group {
			for _, id := range c.Ancestors {
				superseded[id] = true
			}
		}
	}
	seen := map[string]bool{}
	for _, group := range results {
		for _, c := range group {
			if c.Known || c.Entrypoint != "claude-desktop" || c.Session == "" ||
				known[c.Session] || deleted[c.Session] || superseded[c.Session] || seen[c.Session] {
				continue
			}
			seen[c.Session] = true
			c.Ancestors = nil
			chats = append(chats, c)
		}
	}
	sort.Slice(chats, func(i, j int) bool { return chats[i].Session < chats[j].Session })
	return chats, failed
}

// keepFailedHosts adds the cached chats of hosts that did not answer to
// fresh, so a host that is offline for a moment does not lose its chats.
func keepFailedHosts(fresh, cached []sshChat, failed map[string]bool) []sshChat {
	seen := map[string]bool{}
	for _, c := range fresh {
		seen[c.Session] = true
	}
	merged := fresh
	for _, c := range cached {
		if failed[c.Host] && !seen[c.Session] {
			seen[c.Session] = true
			merged = append(merged, c)
		}
	}
	sort.Slice(merged, func(i, j int) bool { return merged[i].Session < merged[j].Session })
	return merged
}

// parseSSHChats reads the JSON lines printed by sshRemoteScript.
func parseSSHChats(host string, out []byte) []sshChat {
	var chats []sshChat
	sc := bufio.NewScanner(bytes.NewReader(out))
	sc.Buffer(make([]byte, 0, 64<<10), 4<<20)
	for sc.Scan() {
		line := bytes.TrimSpace(sc.Bytes())
		if len(line) == 0 {
			continue
		}
		var c sshChat
		if err := json.Unmarshal(line, &c); err != nil {
			log.Printf("ssh %s: skip bad line: %v", host, err)
			continue
		}
		c.Host = host
		chats = append(chats, c)
	}
	if err := sc.Err(); err != nil {
		log.Printf("ssh %s: read output: %v", host, err)
	}
	return chats
}

// saveSSHCache stores the fetched chats so the list survives an offline start.
func saveSSHCache(path string, chats []sshChat) error {
	if chats == nil {
		chats = []sshChat{}
	}
	data, err := json.Marshal(chats)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	return writeFileAtomic(path, data)
}

// loadSSHCache reads the chats saved by saveSSHCache. A missing file is not an error.
func loadSSHCache(path string) ([]sshChat, error) {
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var chats []sshChat
	if err := json.Unmarshal(data, &chats); err != nil {
		return nil, fmt.Errorf("read ssh cache %s: %w", path, err)
	}
	return chats, nil
}

// writeSSHChats writes a chat entry for each SSH chat into the account's
// folder. Chats that are known or deleted, or whose entry already exists, are
// skipped, and no existing file is overwritten. Returns how many entries it wrote.
func writeSSHChats(sessionsRoot, account, org string, chats []sshChat, now time.Time) (int, error) {
	target := filepath.Join(sessionsRoot, account, org)
	if err := os.MkdirAll(target, 0o700); err != nil {
		return 0, err
	}
	// The cache may be stale, so check again right before writing.
	known, deleted := knownSSHSessions(sessionsRoot)

	written := 0
	for _, c := range chats {
		if !safeSSHSession(c.Session) {
			log.Printf("Skip ssh chat %q: not a session ID", c.Session)
			continue
		}
		if known[c.Session] || deleted[c.Session] {
			continue
		}
		if c.Cwd == "" {
			log.Printf("Skip ssh chat %s: no working directory", c.Session)
			continue
		}
		first, err := time.Parse(time.RFC3339Nano, c.First)
		if err != nil {
			log.Printf("Skip ssh chat %s: bad first timestamp: %v", c.Session, err)
			continue
		}
		path := filepath.Join(target, "local_"+c.Session+".json")
		if _, err := os.Stat(path); err == nil {
			continue
		} else if !errors.Is(err, os.ErrNotExist) {
			return written, err
		}

		rec := sshRecord(c, first, now)
		data, err := json.MarshalIndent(rec, "", "\t")
		if err != nil {
			return written, err
		}
		if err := writeFileAtomic(path, data); err != nil {
			return written, err
		}
		written++
	}
	return written, nil
}

// safeSSHSession reports whether id, which comes from the SSH host, can name
// an entry file without leaving the account's folder.
func safeSSHSession(id string) bool {
	if id == "" || id == "." || id == ".." || len(id) > 128 {
		return false
	}
	for _, r := range id {
		if !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '-' || r == '_' || r == '.') {
			return false
		}
	}
	return true
}

// sshRecord builds the chat entry the desktop reads for an SSH chat.
func sshRecord(c sshChat, first time.Time, now time.Time) map[string]any {
	created := first.UnixMilli()
	last := first
	if t, err := time.Parse(time.RFC3339Nano, c.Last); err == nil {
		last = t
	}

	title := c.Title
	titleSource := "user"
	if title == "" {
		titleSource = "auto"
		title = c.AITitle
	}
	if title == "" {
		title = "SSH chat " + c.Session[:min(8, len(c.Session))]
	}

	rec := map[string]any{
		"sessionId":               "local_" + c.Session,
		"cliSessionId":            c.Session,
		"cwd":                     c.Cwd,
		"originCwd":               c.Cwd,
		"createdAt":               created,
		"lastActivityAt":          last.UnixMilli(),
		"title":                   title,
		"titleSource":             titleSource,
		"isArchived":              now.Sub(last) > 7*24*time.Hour,
		"sshConfig":               map[string]string{"sshHost": c.Host},
		"sshRemoteTranscriptPath": c.Path,
	}
	// Worktree chats keep the repository as their origin.
	const marker = "/.claude/worktrees/"
	if i := strings.LastIndex(c.Cwd, marker); i >= 0 {
		if name := c.Cwd[i+len(marker):]; name != "" && !strings.Contains(name, "/") {
			rec["originCwd"] = c.Cwd[:i]
			rec["worktreePath"] = c.Cwd
			rec["worktreeName"] = name
		}
	}
	if c.Branch != "" {
		rec["branch"] = c.Branch
	}
	// Claude marks messages it made up itself with "<synthetic>", not a model.
	if c.Model != "" && !strings.HasPrefix(c.Model, "<") {
		rec["model"] = c.Model
	}
	return rec
}
