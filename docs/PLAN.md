# MiniGit2 — Git GUI local simplifiée ("GitKraken lite")

## Contexte

Le repo `minigit2` est actuellement vide (0 commit, branche non née). L'objectif :
construire, à partir de zéro, un client Git graphique local minimaliste inspiré
de GitKraken, avec exactement les interactions demandées :

- voir le **graphe des commits/branches**,
- **cliquer** sur un commit → afficher son **diff**,
- **double-cliquer** sur un commit ou une branche → **checkout**.

Contrairement à GitKraken, pas de staging/commit/push/merge/rebase graphiques :
c'est un outil de **visualisation + navigation**, pas d'édition d'historique.
Ce document est lui-même le premier livrable versionné du projet (`docs/PLAN.md`,
premier commit), et sera mis à jour au fil de l'implémentation.

## Décisions de stack (validées)

| Sujet | Choix |
|---|---|
| Plateforme | App web locale : petit serveur + UI dans le navigateur (`127.0.0.1` uniquement, pas d'auth — jamais exposé au réseau) |
| Accès Git | Shell out vers le binaire `git` installé (`execFile`, jamais de concaténation shell) |
| Backend | Node.js + TypeScript, **Express** |
| Frontend | **React + Vite** (TS), state local (`useState`/context), pas de Redux/Query |
| Repos | **Multi-repo** : ajout par chemin absolu local, sélecteur pour changer de repo actif |
| Monorepo | npm workspaces : `server/`, `client/`, `shared/` (types partagés) |
| Diff | **Liste de fichiers dépliable** (comme GitHub), pas un blob unique |
| Graphe | Branches locales **+ tags + `origin/*`** (comme `git log --all`) |

## Architecture

### Extraction des données Git

Historique (une seule commande, tous refs, ordre topologique) :
```
git log --all --topo-order \
  --pretty=format:"%x1f%H%x1f%P%x1f%an%x1f%ae%x1f%ad%x1f%s%x1f%D%x1e" \
  --date=iso-strict
```
`\x1f`/`\x1e` comme séparateurs (évite les collisions avec le contenu réel).
`--decorate=full` si besoin de distinguer proprement `refs/heads/` vs
`refs/remotes/` vs `refs/tags/`.

Diff d'un commit (structuré, par fichier) :
- `git diff --no-color <parent> <hash>` (commit normal)
- commit racine (0 parent) → diff contre l'arbre vide (`4b825dc642cb6eb9a060e54bf8d69288fbee4904`)
- commit de merge (2+ parents) → diff contre le **premier parent** (convention mainline, comme `git log --graph`)
- Parser la sortie en sections par fichier (split sur `diff --git a/... b/...`) pour
  construire `{ path, status: added|deleted|modified|renamed, patch }[]` en un seul
  appel git — pas besoin d'un endpoint par fichier.

Statut repo : `git status --porcelain=v1` (dirty/staged/unstaged/untracked),
`git symbolic-ref --short -q HEAD` (branche courante / détecte le detached HEAD).

Cas limites à gérer explicitement : commit racine, commit de merge (plusieurs
parents → plusieurs arêtes dans le graphe), HEAD détaché, **repo sans aucun
commit** (branche non née — l'échec de `git log` doit être intercepté et
retourner un graphe vide, pas une 500 — c'est littéralement l'état actuel de
ce repo, donc un cas à tester en premier).

### Algorithme de layout du graphe

Le point le plus délicat. Approche gauche-à-droite en une passe :
1. **Lignes (row)** = ordre de sortie de `--topo-order` (déjà topologique, pas de tri à refaire).
2. **Colonnes (lane)** : maintenir un tableau de lanes "attendues" (`lanes[i] = hash du prochain commit attendu dans cette colonne`) et une map `laneOf` pour les commits déjà réservés par un enfant.
   - Le commit prend la lane déjà réservée pour lui, sinon la première lane libre.
   - 0 parent → libère la lane.
   - 1 parent → le parent hérite de la même lane (ligne droite).
   - 2+ parents (merge) → le premier parent continue sur la lane du merge (mainline), les autres parents prennent chacun une nouvelle lane libre.
3. Lanes recyclées dès qu'elles se libèrent (évite un graphe qui grossit indéfiniment).
4. Arêtes : ligne verticale droite si même lane, courbe de Bézier sinon.
5. Couleur = `palette[lane % palette.length]` (couleur par index de colonne, pas par identité de branche).

Fonction pure côté serveur `layoutGraph(rawCommits) -> {nodes, edges}`,
testable unitairement avec des fixtures simples (chaîne linéaire, merge, commit
racine, fork+merge) sans toucher à git ni à l'UI.

### API REST

Toutes les routes sont scopées par repo via `:id` dans l'URL — pas d'état
"repo actif" côté serveur (évite les bugs multi-onglets ; l'onglet actif est
un concept purement côté client, persisté en `localStorage`).

```
GET    /api/repos                          -> { repos: [{id, path, name, addedAt}] }
POST   /api/repos            {path}        -> 201 {repo} | 400/409/422
DELETE /api/repos/:id                      -> 204 (oublie le repo, ne touche jamais au disque)

GET    /api/repos/:id/graph                -> { nodes: [{hash, parents, row, lane, color,
                                                  author, authorEmail, date, subject,
                                                  refs: [{type: branch|tag|remote, name, isHead}]}],
                                                 edges: [{from, to, fromLane, toLane}] }
                                               (repo sans commit -> {nodes:[], edges:[]}, pas 500)

GET    /api/repos/:id/commits/:hash/diff   -> { hash, parentHash,
                                                 files: [{path, status, patch}] }

GET    /api/repos/:id/status               -> { headCommit, branch, detached, dirty,
                                                 staged, unstaged, untracked }

POST   /api/repos/:id/checkout   {ref}     -> 200 {ok, status} | 409 {error:'dirty_worktree', message}
```

Sécurité : chemins toujours passés en argument discret à `execFile`
(`git -C <path> ...`), jamais interpolés dans une string shell. Validation à
l'ajout d'un repo via `git -C <path> rev-parse --is-inside-work-tree`.

Checkout : pas de `--force` en V1 (décision explicite, cf non-objectifs) — le
frontend vérifie `/status` avant et prévient si `dirty`, et `git checkout`
refuse nativement s'il écraserait des changements (erreur remontée en 409).

### Frontend

- **SVG** pour les lignes/nœuds du graphe (cibles de clic natives, pas de
  hit-testing manuel comme il faudrait avec Canvas), superposé à des lignes
  HTML normales pour le texte (hash, auteur, date, message, badges de ref) —
  le clic/dbl-clic se fait sur toute la ligne HTML, pas sur le petit cercle SVG.
- **Panneau de diff** : liste de fichiers modifiés (chemin + statut +/-),
  chaque fichier dépliable affichant son patch dans un `<pre>` coloré
  ligne à ligne selon le préfixe (`+`/`-`/`@@`) — pas de dépendance diff-viewer.
- **Sélecteur de repo** : liste des repos connus + formulaire "ajouter un
  chemin" (saisie texte du chemin absolu en V1, pas de file picker natif).
- **Double-clic** : sur une ligne de commit → checkout détaché ; sur un badge
  de branche → checkout de cette branche, avec confirmation si working tree dirty.

### Structure de fichiers

```
minigit2/
  package.json                    # workspaces: server, client, shared
  docs/PLAN.md                    # ce document
  shared/src/types.ts             # types partagés (CommitNode, DiffResponse, ...)
  server/src/
    index.ts                      # bootstrap Express, listen 127.0.0.1
    routes/{repos,graph,diff,status,checkout}.ts
    git/{exec,log,diff,status,checkout,repoValidation}.ts
    graph/layout.ts                # fonction pure, testée unitairement
    store/repoStore.ts            # persiste la liste des repos connus
  client/src/
    App.tsx, api/client.ts
    components/{RepoSwitcher,AddRepoForm,GraphView,CommitRow,RefBadge,
                 DiffPanel,FileDiff,StatusBar,ConfirmCheckoutDialog}.tsx
```

Liste des repos connus persistée hors de tout repo suivi, dans
`~/.minigit-gui/repos.json` (état global de l'outil, pas du projet).

## Non-objectifs explicites pour la V1

Staging/commit, push/pull/fetch, merge/rebase/cherry-pick/revert par
drag-and-drop, résolution de conflits, stash, création/suppression/renommage
de branche (checkout uniquement), auth/multi-utilisateur, watcher filesystem
(l'auto-refresh est du polling toutes les 30s, pas des événements fs natifs),
force/discard sur checkout, sous-modules, recherche/filtre de commits, blame,
historique par fichier.

Note : le file picker natif et la pagination/virtualisation pour gros
historiques, initialement notés hors-scope V1 ci-dessus, ont finalement été
implémentés (navigateur de dossiers server-side, virtualisation de la liste
de commits) — voir les sections dédiées plus bas dans ce document et
l'historique Git pour le détail.

## Ordre de build (phases indépendamment démontrables)

1. **Scaffold** : workspaces, TS config, Express sert le build Vite, `npm run dev`.
   *Démo : page vide qui répond sur `/api/health`.*
2. **Gestion des repos** : `repoStore`, endpoints repos, `RepoSwitcher`/`AddRepoForm`.
   *Démo : ajouter des repos réels, changer de repo actif, persistance au reload.*
3. **Graphe en lecture seule** : `git/log.ts`, `graph/layout.ts` + tests unitaires
   (linéaire/merge/racine/fork), endpoint `/graph`, `GraphView` en SVG.
   *Démo : graphe complet avec lanes/couleurs/badges de refs, pas encore interactif.*
4. **Panneau de diff** : `git/diff.ts` (racine/merge/normal), endpoint diff
   structuré par fichier, `DiffPanel`/`FileDiff` dépliable, clic câblé.
   *Démo : clic sur un commit → liste de fichiers → diff par fichier.*
5. **Statut + checkout** : endpoint `/status` + `/checkout`, `StatusBar`,
   `ConfirmCheckoutDialog`, double-clic sur commit (détaché) et sur branche.
   *Démo : double-clic sur une branche pour la checkout, double-clic sur un
   commit pour se détacher, avertissement sur working tree dirty vérifié.*
6. **(Bonus) Polish** : bouton refresh, états vides/branche non née, erreurs, loading.

## Vérification

- Tests unitaires sur `graph/layout.ts` (fixtures : chaîne linéaire, merge,
  commit racine, fork+merge) — la pièce la plus délicate, à couvrir en premier.
- Test manuel de bout en bout sur ce repo `minigit2` lui-même une fois qu'il
  aura des commits (cas "repo tout juste initialisé" déjà couvert par
  construction), puis sur un repo avec plusieurs branches/merges réels pour
  valider visuellement le rendu du graphe et les checkouts.
- `npm run build && npm start` pour valider le mode "un seul process" avant
  de considérer une phase terminée.
