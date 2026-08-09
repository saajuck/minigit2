# minigit2

A local Git graph client: visualize a repo's history and navigate it,
without editing it.

## Features

- **Multi-repo**: add a repo by absolute path or via a built-in folder
  browser, switch between added repos.
- **Commit graph**: local branches, tags, and remote-tracking branches
  (`origin/*`), with ref badges (including HEAD, detached or not).
  Virtualized list: only visible rows are mounted, scales to large
  histories.
- **Per-commit diff**: click a commit to see its changed files; each file
  expands and loads its patch on demand. Resizable panel (drag the
  divider).
- **Checkout**: double-click a commit for a detached checkout, or a branch
  badge to check out that branch. Confirms if the working tree has
  uncommitted changes; `git`'s own refusal remains the final safety net (no
  force/discard).
- **Status**: bar showing current branch / detached HEAD / working tree
  dirty state, manual refresh button plus automatic refresh every 30s.
- **Design**: reskinned on the Industry design system (blueprint/wireframe
  aesthetic, qualitative lane palette), with a light/dark theme toggle
  persisted per browser. Sidebar repo cards show each repo's own branch and
  dirty state at a glance.

> This list is updated as major features land, not for implementation
> details — see the Git history for that.

Architecture and technical decisions: [docs/PLAN.md](docs/PLAN.md).

## Development

```bash
npm install
npm run dev
```

## Build / run

```bash
npm run build
npm start
```

The server only listens on `127.0.0.1` — no authentication, never expose it
on the network.
