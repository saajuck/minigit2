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
  dirty state, ahead/behind counts vs the tracked upstream, manual refresh
  button plus automatic refresh every 30s (new commits found in the
  background surface as a dismissible banner instead of silently
  replacing the list).
- **Compare**: Ctrl/Cmd-click a second commit to diff it against the first
  selected one (not just parent vs child).
- **Keyboard**: Up/Down to move the graph selection, Enter to check it out.
  Click a hash or file path to copy it.
- **Search**: filter the graph by commit message, author, or hash — matches
  highlight in place (no re-fetch, stays fast on large histories), Enter/↑↓
  jump the selection between matches.
- **Design**: reskinned on the Industry design system (blueprint/wireframe
  aesthetic, qualitative lane palette), with a light/dark theme toggle
  persisted per browser. Sidebar repo cards show each repo's own branch and
  dirty state at a glance.
- **Local changes, stash, reflog**: view the working tree's uncommitted diff
  (staged, unstaged, and untracked files) in the same diff panel used for
  commits; read-only lists of stashed changes and the reflog, each with
  copyable hashes.

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
