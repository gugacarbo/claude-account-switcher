package app

import (
	"context"
	"time"
)

func runBackground(ctx context.Context, s *switcher) {
	go func() {
		timer := time.NewTimer(time.Minute)
		defer timer.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-timer.C:
				s.checkUpdate(ctx)
				timer.Reset(time.Hour)
			}
		}
	}()
	go func() {
		timer := time.NewTimer(time.Minute)
		defer timer.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-timer.C:
				job, cancel := context.WithTimeout(ctx, 90*time.Second)
				s.fetchSSH(job)
				cancel()
				timer.Reset(30 * time.Minute)
			}
		}
	}()
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	var last time.Time
	for {
		if s.adding() || time.Since(last) >= hotEvery {
			last = time.Now()
			job, cancel := context.WithTimeout(ctx, 45*time.Second)
			s.refresh(job)
			cancel()
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
