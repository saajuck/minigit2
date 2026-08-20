#!/usr/bin/env bash
# Builds the minigit2 server into a single self-contained executable via Node's Single
# Executable Applications (SEA) feature, and places it where Tauri's `externalBin` sidecar
# convention expects it: src-tauri/binaries/minigit2-server-<target-triple>.
#
# Node's SEA blob is essentially the real `node` binary with our bundled server injected into
# it — so the app's own dependencies (Express, etc.) travel with it, but a working `node` binary
# must already be available to build from (not to run — the *output* is self-contained).
set -euo pipefail

# Every path variable below (ROOT_DIR, OUT_DIR, OUT_BIN, WORK_DIR) is double-quoted at each use
# site, so spaces/unicode in any of them (a checkout under a path like "My Projects", a non-ASCII
# username) are handled correctly — verified by inspection rather than assumed, since CI's own
# runner paths are always plain ASCII and would never exercise this. Keep new path-using lines
# quoted the same way; an accidentally-unquoted expansion here would only break on exactly the
# kind of path CI never tests.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET_TRIPLE="${MINIGIT2_TARGET_TRIPLE:-x86_64-unknown-linux-gnu}"
OUT_DIR="$ROOT_DIR/src-tauri/binaries"
OUT_BIN="$OUT_DIR/minigit2-server-$TARGET_TRIPLE"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

echo "==> Bundling server into a single CJS file..."
"$ROOT_DIR/node_modules/.bin/esbuild" "$ROOT_DIR/server/src/index.ts" \
  --bundle --platform=node --target=node22 --format=cjs \
  --outfile="$WORK_DIR/bundle.cjs"

echo "==> Generating SEA blob..."
cat > "$WORK_DIR/sea-config.json" << EOF
{
  "main": "bundle.cjs",
  "output": "sea-prep.blob",
  "disableExperimentalSEAWarning": true
}
EOF
(cd "$WORK_DIR" && node --experimental-sea-config sea-config.json)

echo "==> Injecting blob into a node binary copy..."
mkdir -p "$OUT_DIR"
cp "$(command -v node)" "$OUT_BIN"
npx --yes postject "$OUT_BIN" NODE_SEA_BLOB "$WORK_DIR/sea-prep.blob" \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
chmod +x "$OUT_BIN"

echo "==> Sidecar built: $OUT_BIN"
