# Packaging

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
makes a single left or right click on the tray icon open the React dropdown,
anchored under the icon. It finds the icon by its StatusNotifierItem Id (the
app name) and leaves every other icon alone.

```bash
make install-gnome-extension
```

On Wayland the Shell only discovers a new extension after logging out and back
in; then run `gnome-extensions enable claude-account-switcher@snlperstripes.github.com`
if it is not enabled yet.
