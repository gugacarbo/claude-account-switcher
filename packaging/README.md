# Packaging

## Linux — main installation

```bash
make install
```

Builds the production binary (frontend embedded) and installs it as the user's
main installation: `~/.local/bin/claude-switcher`, the app-menu launcher and
icon under `~/.local/share/`. If the XDG autostart entry already exists, its
`Exec` is repointed to the installed path — a dev run (`bun run dev`) records
the temporary `go run` binary in `/tmp` when the autostart toggle is used, and
that path vanishes on reboot. The script never creates the autostart entry:
the app's own toggle owns that choice, and it should be used from the
installed app, not the dev one. The previous binary is kept in
`dist/claude-switcher.previous`. Install the GNOME Shell extension separately
(below); it only loads after logout/login.

## winget

`winget/manifests/` mirrors the layout of [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs).
To publish a release:

1. Copy the version folder, bump `PackageVersion`, `ReleaseDate`, the URLs and `InstallerSha256`
   (the hash is in the release's `.sha256` file, upper case).
2. Check it locally:
   ```bash
   winget validate packaging/winget/manifests/s/SnlperStripes/ClaudeAccountSwitcher/<version>
   ```
3. Open a pull request to microsoft/winget-pkgs with the same folder, or let
   [`wingetcreate update`](https://github.com/microsoft/winget-create) do steps 1 and 3.

## GNOME Shell extension

On GNOME the AppIndicator extension only forwards a double click to the app and
keeps single clicks for its own menu. `gnome-shell/claude-account-switcher@snlperstripes.github.com`
makes a single left or right click on the tray icon open the React dropdown. It
finds the icon by its StatusNotifierItem Id (the app name) and leaves every
other icon alone.

It also places the dropdown. A Wayland compositor ignores the position a client
asks for, so the app cannot anchor its own window; the extension runs inside the
compositor and moves it under the icon. To find that window it uses the client
pid from the indicator's bus name (`org.kde.StatusNotifierItem-<pid>-<n>`) and
takes the app's smallest mapped window: the panel (420x640) and the resume
prompt (480x540) are larger than the dropdown (320x440). Window titles would be
exact, but Wails 3.1.0 skips `gtk_window_set_title` for frameless windows, so
every window of the app has the same title; `menuTitleSuffix` is kept for the
day that changes. What the extension did is written to
`/tmp/claude-switcher-tray.log`, because a failed match is otherwise silent and
`log()` does not reach `journalctl` on every host.

```bash
make install-gnome-extension
```

The Shell imports an extension only when it starts, so **log out and back in**
after installing or changing it — `gnome-extensions disable/enable` does not
reload the code. Then run
`gnome-extensions enable claude-account-switcher@snlperstripes.github.com` if it
is not enabled yet.
