package app

// nativeAdapter is the coordinator's side-effect boundary. Resolve the desktop
// on every use: an application update can relocate its data while we run.
// Tests can replace these operations without touching a real desktop session.
type nativeAdapter struct {
	desktop       func() desktop
	processes     func() ([]uint32, string)
	restartLaunch func() (string, []string)
	quit          func() error
	start         func(string, ...string) error
	awake         func() func()
}

func systemNative() nativeAdapter {
	return nativeAdapter{desktop: claudeDesktop, processes: desktopProcesses,
		restartLaunch: desktopRestartLaunch, quit: quitDesktop, start: startDesktop, awake: stayAwake}
}
