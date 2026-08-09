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

## Windows, macOS, or any other Linux: run from source

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

## Building the AppImage yourself

Requires a Rust toolchain (`rustup`) and, on Ubuntu, the packages listed in
[`.github/workflows/release.yml`](../.github/workflows/release.yml).

```bash
npm install
npm run build                        # builds server + client
./packaging/linux/build-sidecar.sh   # packages the server into a single sidecar binary
npx tauri build
```

The AppImage is written to `src-tauri/target/release/bundle/appimage/`.

The `.github/workflows/release.yml` workflow does exactly this on a clean `ubuntu-latest`
runner and attaches the result to a GitHub Release whenever a tag matching `v*` is pushed (or
can be run manually via "Run workflow" for a one-off build without publishing a release).
