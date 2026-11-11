package main

import "time"

type resumeRequest struct {
	Account string       `json:"account"`
	Wait    int          `json:"wait"`
	Chats   []resumeChat `json:"chats"`
	Lang    string       `json:"lang"`
}

type resumeChat struct {
	Title  string `json:"title"`
	Folder string `json:"folder"`
}

// chooseResume uses the shared React window. In non-graphical contexts,
// preserve the historical unavailable-dialog policy: continue all chats.
func chooseResume(account string, chats []cutChat, wait time.Duration) []bool {
	req := resumeRequest{Account: account, Wait: int(wait / time.Second), Lang: language}
	for _, c := range chats {
		req.Chats = append(req.Chats, resumeChat{Title: c.title, Folder: c.folder})
	}
	if resumeInUI != nil {
		return resumeInUI(req, wait)
	}
	keep := make([]bool, len(chats))
	for i := range keep {
		keep[i] = true
	}
	return keep
}
