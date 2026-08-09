# Cutting a release

Every time the release workflow (`.github/workflows/release.yml`) is triggered, `package.json`'s
`version` must be bumped first (commit + merge to `master` before running the workflow). The
workflow tags releases as `v<version>` from that field — re-running it without bumping just
re-publishes over the same tag/release instead of creating a new one. See
[`docs/DEPLOY.md`](docs/DEPLOY.md#cutting-a-release) for the full process.
