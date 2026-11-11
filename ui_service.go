package main

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sync"
	"time"
)

// UIState is intentionally independent of State: authentication and filesystem
// details must never become part of the webview's binding surface.
type UIState struct {
	Accounts    []UIAccount `json:"accounts"`
	AutoSwitch  bool        `json:"autoSwitch"`
	SpendWeekly bool        `json:"spendWeekly"`
	SSHImport   bool        `json:"sshImport"`
	Autostart   bool        `json:"autostart"`
	Threshold   float64     `json:"threshold"`
	Busy        bool        `json:"busy"`
	Status      string      `json:"status"`
	Note        string      `json:"note"`
	Update      string      `json:"update"`
	Version     string      `json:"version"`
	Lang        string      `json:"lang"`
	Resume      *UIPrompt   `json:"resume"`
}
type UIAccount struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Email  string `json:"email"`
	Plan   string `json:"plan"`
	Active bool   `json:"active"`
	Detail string `json:"detail"`
	Usage  *Usage `json:"usage"`
}

type UIService struct {
	s       *switcher
	prompts *resumeHub
	open    func(string)
	close   func(string)
	quit    func()
}

func (u *UIService) State() UIState {
	snap := u.s.snapshot()
	state := UIState{Accounts: []UIAccount{}, AutoSwitch: snap.AutoSwitch, SpendWeekly: snap.SpendWeekly, SSHImport: snap.SSHImport, Threshold: snap.Threshold, Busy: snap.Busy || updating.Load(), Status: snap.Status, Note: snap.Note, Update: snap.Update, Version: version, Lang: language, Autostart: autostartEnabled()}
	now := time.Now()
	for _, a := range snap.Accounts {
		account := UIAccount{ID: a.UUID, Name: a.Name, Email: a.Email, Plan: a.Plan, Active: a.UUID == snap.Active, Detail: usageText(a, snap.Threshold, now)}
		if a.Usage != nil {
			usage := a.Usage.current(now)
			account.Usage = &usage
		}
		state.Accounts = append(state.Accounts, account)
	}
	if u.prompts != nil {
		state.Resume = u.prompts.snapshot()
	}
	return state
}
func (u *UIService) SetThreshold(v float64) error {
	if math.IsNaN(v) || math.IsInf(v, 0) || v != math.Trunc(v) || v < 1 || v > 99 {
		return errors.New(tr("Enter a whole number from 1 to 99.", "请输入 1 到 99 之间的整数。"))
	}
	u.s.setThreshold(v)
	return nil
}
func (u *UIService) SetOption(name string, on bool) error {
	switch name {
	case "autoSwitch":
		u.s.setAuto(on)
	case "spendWeekly":
		u.s.setSpendWeekly(on)
	case "sshImport":
		u.s.setSSHImport(on)
	case "autostart":
		if err := setAutostart(on); err != nil {
			return err
		}
		u.s.onChange()
	default:
		return errors.New("unknown setting")
	}
	return nil
}
func (u *UIService) SwitchAccount(id string) error {
	snap := u.s.snapshot()
	found := false
	for _, a := range snap.Accounts {
		if a.UUID == id {
			found = true
		}
	}
	if !found {
		return errors.New("unknown account")
	}
	if id == snap.Active {
		return nil
	}
	return u.launch(tr("Switch", "切换"), func() error { return u.s.switchTo(id, byHand) })
}
func (u *UIService) launch(name string, f func() error) error {
	if updating.Load() || !u.s.busy.CompareAndSwap(false, true) {
		return errors.New(tr("An operation is already running.", "已有操作正在进行。"))
	}
	u.s.onChange()
	go u.s.runClaimed(name, f)
	return nil
}
func (u *UIService) AddAccount() error {
	return u.launch(tr("Add account", "添加账号"), u.s.addAccount)
}
func (u *UIService) ImportChats() error {
	return u.launch(tr("Import", "导入"), func() error {
		ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
		defer cancel()
		u.s.fetchSSH(ctx)
		return u.s.importChats()
	})
}
func (u *UIService) InstallUpdate() error {
	v := u.s.snapshot().Update
	if v == "" {
		return errors.New("no update available")
	}
	if u.s.busy.Load() {
		return errors.New("an operation is already running")
	}
	go u.s.installUpdate(context.Background(), v)
	return nil
}
func (u *UIService) OpenDataFolder() { shellOpen(u.s.dir) }
func (u *UIService) OpenWindow(name string) error {
	if name != "settings" && name != "threshold" {
		return errors.New("unknown window")
	}
	if u.open != nil {
		u.open(name)
	}
	return nil
}
func (u *UIService) CloseWindow(name string) error {
	if name != "settings" && name != "threshold" && name != "resume" && name != "panel" {
		return errors.New("unknown window")
	}
	if name == "resume" && u.prompts != nil {
		u.prompts.cancel()
	}
	if u.close != nil {
		u.close(name)
	}
	return nil
}
func (u *UIService) Quit() error {
	if updating.Load() || !u.s.busy.CompareAndSwap(false, true) {
		return errors.New(tr("Wait for the current operation to finish.", "请等待当前操作完成。"))
	}
	if u.quit != nil {
		u.quit()
	}
	return nil
}
func (u *UIService) AnswerResume(id string, keep []bool) error {
	if u.prompts == nil {
		return errors.New("no resume prompt")
	}
	return u.prompts.answer(id, keep)
}

type UIPrompt struct {
	ID       string       `json:"id"`
	Account  string       `json:"account"`
	Chats    []resumeChat `json:"chats"`
	Deadline time.Time    `json:"deadline"`
}
type resumeHub struct {
	mu      sync.Mutex
	prompt  *UIPrompt
	answers chan []bool
	serial  uint64
}

func newResumeHub() *resumeHub { return &resumeHub{} }
func (h *resumeHub) snapshot() *UIPrompt {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.prompt == nil {
		return nil
	}
	p := *h.prompt
	p.Chats = append([]resumeChat(nil), p.Chats...)
	return &p
}
func (h *resumeHub) ask(req resumeRequest, wait time.Duration, show func()) []bool {
	h.mu.Lock()
	h.serial++
	p := &UIPrompt{ID: fmt.Sprint(h.serial), Account: req.Account, Chats: append([]resumeChat(nil), req.Chats...), Deadline: time.Now().Add(wait)}
	answers := make(chan []bool, 1)
	h.prompt = p
	h.answers = answers
	h.mu.Unlock()
	show()
	timer := time.NewTimer(wait)
	defer timer.Stop()
	var keep []bool
	select {
	case keep = <-answers:
	case <-timer.C:
		keep = make([]bool, len(req.Chats))
		for i := range keep {
			keep[i] = true
		}
	}
	h.mu.Lock()
	if h.prompt == p {
		h.prompt = nil
		h.answers = nil
	}
	h.mu.Unlock()
	return keep
}
func (h *resumeHub) answer(id string, keep []bool) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.prompt == nil || h.prompt.ID != id {
		return errors.New("resume prompt has expired")
	}
	if len(keep) != len(h.prompt.Chats) {
		return errors.New("answer count does not match chats")
	}
	select {
	case h.answers <- append([]bool(nil), keep...):
		return nil
	default:
		return errors.New("resume prompt already answered")
	}
}
func (h *resumeHub) cancel() {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.prompt == nil {
		return
	}
	select {
	case h.answers <- make([]bool, len(h.prompt.Chats)):
	default:
	}
}

// Assigned once before background workers start. Core/CLI tests never need a GUI.
var resumeInUI func(resumeRequest, time.Duration) []bool
