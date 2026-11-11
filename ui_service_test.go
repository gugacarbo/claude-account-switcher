package main

import (
	"encoding/json"
	"math"
	"strings"
	"testing"
	"time"
)

func TestUIStateIsAnAllowlistedProjection(t *testing.T) {
	s := newSwitcher(t.TempDir())
	s.st.AppExe = "private executable"
	s.st.Accounts = []*Account{{UUID: "a", Org: "private org", Name: "Ada", Email: "ada@example.test", Usage: &Usage{Session: 42, Weekly: 70, SessionReset: time.Now().Add(time.Hour)}}}
	s.active = "a"
	ui := &UIService{s: s}
	got := ui.State()
	if len(got.Accounts) != 1 || !got.Accounts[0].Active || got.Accounts[0].Usage.Session != 42 {
		t.Fatalf("bad projection: %+v", got)
	}
	data, _ := json.Marshal(got)
	for _, forbidden := range []string{"private executable", "private org", "appExe", "token", "cookie", "lastSwitch"} {
		if strings.Contains(string(data), forbidden) {
			t.Fatalf("leaked %q: %s", forbidden, data)
		}
	}
	s.st.Accounts[0].Usage.Session = 88
	if got.Accounts[0].Usage.Session != 42 {
		t.Fatal("projection aliases live usage")
	}
}

func TestUIRejectsInvalidSettingsAndAccounts(t *testing.T) {
	s := newSwitcher(t.TempDir())
	ui := &UIService{s: s}
	for _, v := range []float64{0, 100, 1.5, math.NaN(), math.Inf(1)} {
		if ui.SetThreshold(v) == nil {
			t.Errorf("accepted threshold %v", v)
		}
	}
	if ui.SwitchAccount("missing") == nil {
		t.Fatal("accepted unknown account")
	}
	if ui.SetOption("arbitrary", true) == nil {
		t.Fatal("accepted unknown option")
	}
	if err := ui.SetThreshold(85); err != nil {
		t.Fatal(err)
	}
	if newSwitcher(s.dir).snapshot().Threshold != 85 {
		t.Fatal("setting not persisted")
	}
	if err := ui.SetOption("autoSwitch", true); err != nil {
		t.Fatal(err)
	}
	if !newSwitcher(s.dir).snapshot().AutoSwitch {
		t.Fatal("automation not persisted")
	}
}

func TestResumePromptAnswersAreValidatedAndTimeoutContinuesAll(t *testing.T) {
	hub := newResumeHub()
	req := resumeRequest{Chats: []resumeChat{{Title: "one"}, {Title: "two"}}, Wait: 1}
	result := make(chan []bool, 1)
	go func() { result <- hub.ask(req, 30*time.Millisecond, func() {}) }()
	deadline := time.Now().Add(time.Second)
	for hub.snapshot() == nil && time.Now().Before(deadline) {
		time.Sleep(time.Millisecond)
	}
	prompt := hub.snapshot()
	if prompt == nil {
		t.Fatal("no prompt")
	}
	if hub.answer(prompt.ID, []bool{true}) == nil {
		t.Fatal("accepted wrong answer count")
	}
	if hub.answer("stale", []bool{true, true}) == nil {
		t.Fatal("accepted stale prompt")
	}
	got := <-result
	if len(got) != 2 || !got[0] || !got[1] {
		t.Fatalf("timeout = %v", got)
	}
	if hub.snapshot() != nil {
		t.Fatal("prompt not cleared")
	}
}

func TestUIRejectsConcurrentRestarts(t *testing.T) {
	s := newSwitcher(t.TempDir())
	s.st.Accounts = []*Account{{UUID: "a"}}
	s.busy.Store(true)
	ui := &UIService{s: s}
	for _, action := range []func() error{func() error { return ui.SwitchAccount("a") }, ui.AddAccount, ui.ImportChats, ui.Quit} {
		if action() == nil {
			t.Error("accepted action while busy")
		}
	}
}

func TestResumePromptSelectedAnswers(t *testing.T) {
	hub := newResumeHub()
	result := make(chan []bool, 1)
	ready := make(chan struct{})
	go func() {
		result <- hub.ask(resumeRequest{Chats: []resumeChat{{Title: "one"}, {Title: "two"}}}, time.Second, func() { close(ready) })
	}()
	<-ready
	p := hub.snapshot()
	if err := hub.answer(p.ID, []bool{false, true}); err != nil {
		t.Fatal(err)
	}
	got := <-result
	if len(got) != 2 || got[0] || !got[1] {
		t.Fatalf("selection lost: %v", got)
	}
	if hub.answer(p.ID, []bool{true, true}) == nil {
		t.Fatal("accepted expired prompt")
	}
}

func TestUIQuitReservesBusyBeforeShutdown(t *testing.T) {
	s := newSwitcher(t.TempDir())
	called := false
	ui := &UIService{s: s, quit: func() { called = true }}
	if err := ui.Quit(); err != nil {
		t.Fatal(err)
	}
	if !called || !s.busy.Load() {
		t.Fatal("shutdown must prevent a new restart from racing quit")
	}
	if ui.Quit() == nil {
		t.Fatal("second quit accepted while shutting down")
	}
}

func TestResumePromptCancelStopsAll(t *testing.T) {
	hub := newResumeHub()
	result := make(chan []bool, 1)
	go func() { result <- hub.ask(resumeRequest{Chats: []resumeChat{{Title: "one"}}}, time.Second, func() {}) }()
	deadline := time.Now().Add(time.Second)
	for hub.snapshot() == nil && time.Now().Before(deadline) {
		time.Sleep(time.Millisecond)
	}
	if hub.snapshot() == nil {
		t.Fatal("no prompt")
	}
	hub.cancel()
	if got := <-result; len(got) != 1 || got[0] {
		t.Fatalf("cancel = %v", got)
	}
}
