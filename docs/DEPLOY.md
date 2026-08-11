# Deploying minigit2

## Ubuntu (recommended): download the AppImage

1. Go to the [Releases page](https://github.com/saajuck/minigit2/releases) and download
   the latest `minigit2_*.AppImage`.
2. Make it executable and run it:
   ```bash
   chmod +x minigit2_*.AppImage
   ./minigit2_*.AppImage
   ```
   This opens a normal desktop window — no browser tab, no address bar. The window is backed
   by the same local server as every other install method; it only talks to `127.0.0.1`.
3. If the AppImage doesn't launch at all (silently does nothing), your system is missing
   `libfuse2`, which some newer Ubuntu releases don't install by default:
   ```bash
   sudo apt install libfuse2
   ```

Closing the window stops the background server automatically. Launching a second AppImage
window while one is already running reuses the existing server instead of starting a
duplicate — you'll just get a second window pointed at the same backend.

## Windows: download the installer

1. Go to the [Releases page](https://github.com/saajuck/minigit2/releases) and download either
   `minigit2_*_x64-setup.exe` (NSIS) or `minigit2_*_x64_en-US.msi` (MSI) — both are standard
   Windows installers, pick whichever you're used to. Run it and launch minigit2 from the Start
   menu like any other installed app.
2. The installer isn't code-signed (no certificate), so Windows SmartScreen will likely warn
   about an "unrecognized app" the first time — this is expected for an unsigned open-source
   build, not a sign of a bad download; choose "More info" → "Run anyway".
3. To uninstall, use **Settings → Apps** (or the classic **Programs and Features**) like any
   other Windows program. To update, just download and run the newer installer from the
   Releases page — it upgrades in place, same as re-running the Ubuntu AppImage's own download
   step; there's no in-app auto-updater.

> The Windows build is produced by the same CI pipeline as the AppImage (see
> [`.github/workflows/release.yml`](../.github/workflows/release.yml)), including a smoke test
> that launches the packaged server and confirms it responds — but nobody has run the installed
> app end-to-end on a real Windows machine yet. If you hit something broken, please open an
> issue.

## macOS, or any other Linux: run from source

There's no packaged build for these platforms yet. Run it the same way you would for local
development:

```bash
git clone https://github.com/saajuck/minigit2.git
cd minigit2
npm install
npm run build
npm start
```

Then open `http://127.0.0.1:4300` in a browser. Optional: most modern browsers can install
that page as a standalone app (look for an "Install" icon in the address bar) via the bundled
PWA manifest, which gives you a window without the surrounding browser chrome — the same
effect as the Ubuntu AppImage, just one manual step instead of a download.

To pick up updates later:

```bash
git pull
npm install
npm run build
npm start
```

## Building the packages yourself

Requires a Rust toolchain (`rustup`) and, on Ubuntu, the packages listed in
[`.github/workflows/release.yml`](../.github/workflows/release.yml). On Windows, run the
sidecar script through Git Bash (it ships with Git for Windows) — everything else is a normal
`npx`/`npm` command.

```bash
npm install
npm run build                          # builds server + client

# Ubuntu — produces the AppImage
./packaging/linux/build-sidecar.sh     # packages the server into a single sidecar binary
npx tauri build

# Windows (Git Bash) — produces an NSIS .exe and an .msi
./packaging/windows/build-sidecar.sh
npx tauri build
```

`tauri.conf.json`'s `bundle.targets` is `"all"`, so `npx tauri build` always produces whatever
formats are valid for the machine it's run on — no per-platform flag to remember. Output lands
in `src-tauri/target/release/bundle/<format>/`, named after the app's version (e.g.
`minigit2_0.1.0_amd64.AppImage`, `minigit2_0.1.0_x64-setup.exe`) — see "Cutting a release" below
for where that version comes from.

## Cutting a release

The version lives in one place: the root `package.json`'s `version` field.
`src-tauri/tauri.conf.json` reads it from there at build time (Tauri supports pointing `version`
at a `package.json` path instead of duplicating the number), so it never needs to be kept in
sync by hand.

1. Bump `version` in `package.json`, commit, merge to `master` as usual.
2. Go to **Actions → Release → Run workflow** on `master` and run it with no input. It builds
   the AppImage and the Windows installers (in parallel, on separate runners) and publishes them
   together as a GitHub Release tagged `v<version>` — the tag doesn't need to exist beforehand,
   the workflow creates it.

Pushing a real git tag matching `v*` also works and takes priority if present (`git tag v0.2.0
&& git push origin v0.2.0`) — useful if your own git credentials are allowed to push tags to
this repo. The `version` input on `workflow_dispatch` is only for overriding the tag on a
one-off build (e.g. a hotfix release without bumping `package.json`); leave it empty for the
normal flow above.
