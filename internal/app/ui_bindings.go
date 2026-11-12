//go:build !headless

package app

import "github.com/wailsapp/wails/v3/pkg/application"

// Stable IDs avoid Go's package-main naming difference between test binaries
// and desktop executables. Keep this small allowlist in sync with bridge.ts.
func registerUIBindings() {
	application.RegisterBindingMethodID((*UIService).State, 1)
	application.RegisterBindingMethodID((*UIService).SetThreshold, 2)
	application.RegisterBindingMethodID((*UIService).SetOption, 3)
	application.RegisterBindingMethodID((*UIService).SwitchAccount, 4)
	application.RegisterBindingMethodID((*UIService).AddAccount, 5)
	application.RegisterBindingMethodID((*UIService).ImportChats, 6)
	application.RegisterBindingMethodID((*UIService).InstallUpdate, 7)
	application.RegisterBindingMethodID((*UIService).OpenDataFolder, 8)
	application.RegisterBindingMethodID((*UIService).OpenWindow, 9)
	application.RegisterBindingMethodID((*UIService).CloseWindow, 10)
	application.RegisterBindingMethodID((*UIService).Quit, 11)
	application.RegisterBindingMethodID((*UIService).AnswerResume, 12)
	application.RegisterBindingMethodID((*UIService).PauseResume, 13)
}
