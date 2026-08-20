# Audit — code, perf, dette technique, tests (v0.5.0)

## Contexte

Toutes les phases décrites dans [`docs/PLAN.md`](PLAN.md) sont livrées
(v0.5.0, master). Ce document est un audit à froid du code existant à ce
stade, produit pour être **repris et exécuté par une autre session/modèle**
— chaque item est autonome (fichier:ligne + action concrète), pas besoin de
relire l'historique qui a produit cet audit. Trois passes d'exploration
(serveur, client, CI/packaging/docs) ont servi de base, complétées par une
vérification ciblée sur le cas "gros repo, historique très long, beaucoup
de branches" (voir P1.1bis/P1.1ter) ; les findings sont regroupés par
priorité, pas par thème.

**Portée de ce document** : il n'a été exécuté par aucune des sessions qui
l'ont produit — c'est délibéré, il est versionné tel quel pour qu'une
future session traite les items un par un.

**Comment l'utiliser** : traiter dans l'ordre P0 → P3. Chaque item indique le
fichier concerné, le problème, et l'action attendue. Vérifier
`npm run typecheck && npm run test && npm run build` après chaque item avant
de passer au suivant ; committer/PR par item ou petit groupe cohérent
d'items, pas tout d'un coup.

## P0 — Sécurité (à traiter en premier, avant tout le reste)

### P0.1 — Injection d'arguments git via des refs non filtrées (HIGH)
**Fichiers** : `server/src/git/diff.ts:62-64,74` (et le reste du fichier —
`compare`, `diffFilePatch`), `server/src/git/blame.ts:6`,
`server/src/git/checkout.ts:19,39`.

Les chaînes de ref/hash/base venant de requêtes HTTP (`from`, `to`, `hash`,
`ref`) sont passées en argument positionnel brut à `git diff`/`log`/`blame`/
`checkout`, sans marqueur `--` de fin d'options. Une valeur commençant par
`-` est interprétée comme une option git, pas comme une révision — vérifié
en local : `git diff --no-color --name-status "--output=/path" HEAD` et
`git log -1 --format=%b "--output=/path"` écrivent bien dans `/path`.
`git blame --contents=/etc/shadow` peut faire fuiter le contenu d'un fichier
arbitraire dans la réponse.

Ces endpoints sont des `GET` simples (pas de preflight CORS), donc une page
web malveillante visitée pendant que minigit2 tourne peut déclencher l'écriture
en aveugle (CSRF-via-GET) même si le modèle de menace de l'app repose sur
"127.0.0.1 only, pas d'auth" — ce n'est pas une protection contre une requête
initiée par le navigateur de l'utilisateur lui-même. `:hash` dans l'URL est
aussi exploitable via un `/` encodé (`%2F`) qu'Express décode après le
découpage de route.

**Action** : dans `runGit`/tous les appels construisant un tableau
d'arguments git à partir d'une ref/hash utilisateur, insérer `--` juste avant
la ou les révisions (`["diff", "--no-color", "--name-status", "--", base, head]`
n'est pas suffisant seul — `--` doit précéder les refs, pas les paths ; forme
correcte : `["diff", "--no-color", "--name-status", base, head, "--"]` ne
protège pas non plus `base`/`head` eux-mêmes tant qu'ils sont AVANT tout `--`
— la vraie fix est de rejeter/échapper toute ref commençant par `-`, en plus
d'ajouter `--` avant les paths). Centraliser via un petit helper
`assertSafeRef(ref: string)` dans `server/src/git/exec.ts`, appelé par tous
les endpoints qui reçoivent une ref/hash utilisateur (diff, compare, blame,
checkout, hotspot). Ajouter des tests couvrant une ref commençant par `-`.

## P1 — Correctness/perf haute sévérité

### P1.1 — Virtualisation du graphe non memoïsée et non throttled (HIGH, perf)
**Fichier** : `client/src/components/GraphView.tsx:95-119,162`.

`rowByHash` (Map sur tous les nodes), `maxLane`/`graphWidth`/`totalHeight`,
et le `.filter()` des edges visibles sont recalculés à zéro à **chaque
render** — et `onScroll` appelle `setScrollTop` sans rAF/throttle, donc
chaque tick de scroll natif redéclenche tout ce calcul. Sur un historique de
plusieurs milliers de commits, c'est le point de jank le plus probable de
toute l'app, contrairement à `FileChangeList` (déjà virtualisé proprement via
`@tanstack/react-virtual`, ne remesure que ce qui est visible).

**Action** : mémoïser `rowByHash`/`graphWidth`/`totalHeight` avec `useMemo`
(deps `[nodes]`), throttler `onScroll` via `requestAnimationFrame`. Envisager
de migrer `GraphView` sur `@tanstack/react-virtual` comme `FileChangeList`
plutôt que garder l'implémentation maison — `ROW_HEIGHT = 34` fixe (lignes
8, 103-107, 122) est aussi la seule hypothèse de hauteur fixe qui bloquerait
la migration. **Même racine côté minimap** : `client/src/components/GraphMinimap.tsx:78-96`
refiltre `nodes` (tags + matches) en entier à chaque render, et `scrollTop`
(passé par `GraphView`) change à chaque tick de scroll — donc chaque pixel
scrollé refiltre deux fois tout le tableau de commits, en plus du recalcul
déjà décrit côté `GraphView`. À corriger ensemble (même throttle rAF pour
`scrollTop`, mémoïser les listes tags/matches avec `useMemo(..., [nodes, matchHashes])`).

### P1.1bis — Aucun rafraîchissement incrémental du graphe : re-walk + re-transfert + re-render complets à chaque poll/SSE (HIGH, perf — spécifique gros historique)
**Fichiers** : `server/src/routes/graph.ts` (route entière, ~15 lignes),
`server/src/git/log.ts:19-27` (`git log --all --topo-order`, sans `-n` ni
pagination), `client/src/App.tsx:187-266` (poll 30s + listener SSE).

Vérifié en relisant le code : `/api/repos/:id/graph` refait **systématiquement**
un `git log --all` complet (aucune limite, aucun cache, aucun ETag/If-None-Match)
puis un `layoutGraph()` complet sur tout le résultat, à chaque appel — et cet
appel est déclenché par : le poll 30s (`App.tsx:241-256`), **chaque** événement
SSE `"changed"` (`App.tsx:262-290`, déclenché par n'importe quel changement
de ref n'importe où dans le repo, pas seulement un nouveau commit), et le
bouton Refresh manuel. Sur un repo à historique très long et beaucoup de
branches actives, ça veut dire : recalcul serveur complet + retransfert JSON
complet (potentiellement plusieurs Mo, sans compression — pas de middleware
`compression` dans `server/src/index.ts`) + reparse JSON + rerender client
**toutes les 30 secondes**, même si rien n'a changé depuis le dernier poll.

Ça compose aussi avec un problème d'identité côté client : chaque poll
produit un tout nouvel objet `graph` (nouveau parse JSON), donc même quand
le contenu est strictement identique, tous les `useMemo` qui en dépendent
(`focusedNodes`, `focusedEdges`, `matchingNodes`, `branchFilterHashes`...
dans `App.tsx`) sont invalidés et recalculés — pas de partage structurel/
diffing pour préserver l'identité des commits inchangés entre deux polls.

**Action** (la plus impactante de tout l'audit pour le cas "gros repo/long
historique/beaucoup de branches" explicitement visé) :
1. Court terme : réduire l'intervalle de poll n'a aucun sens tant que le coût
   par poll reste O(historique complet) — plutôt réduire la fréquence par
   défaut sur un repo détecté comme gros, ou rendre l'auto-refresh
   désactivable par l'utilisateur pour ces repos.
2. Moyen terme : incrémental côté serveur — `git log --all <dernier-hash-connu>..` (ou
   comparer juste les tips de refs via `git for-each-ref` avant de décider
   s'il faut vraiment refaire un `git log` complet) pour détecter "rien n'a
   changé" sans repayer le coût du `layoutGraph` complet.
3. Plus structurel : un cache serveur par repo (dernier `{nodes,edges}`
   calculé + hash des refs tips) invalidé uniquement par le signal fs-watch
   existant (`server/src/routes/watch.ts`), retourné tel quel si les tips de
   refs n'ont pas bougé depuis le dernier calcul — évite de recalculer le
   layout à chaque poll si rien n'a changé, ce qui est le cas la majorité du
   temps sur un repo peu actif.
4. Ajouter `compression` (middleware Express `compression`) au minimum, en
   attendant l'incrémental — gain limité en localhost (pas de vrai goulot
   réseau) mais réduit le volume à parser côté client.

### P1.1ter — `layoutGraph`: attribution de lane en O(n·L) (MEDIUM-HIGH, perf — spécifique beaucoup de branches)
**Fichier** : `server/src/graph/layout.ts:57-64` (`firstFreeLane`).

Scan linéaire du tableau `lanes` à chaque commit et à chaque parent
supplémentaire d'un merge, pour trouver la première lane libre — coût
`O(L)` par appel où `L` = nombre de lanes concurrentes (branches actives en
parallèle à un instant donné de l'historique). Sur un repo avec beaucoup de
branches longue durée ouvertes simultanément, `L` peut monter dans les
centaines, donnant un total `O(n·L)` qui peut représenter plusieurs dizaines
de millions d'itérations sur un historique de 50k+ commits — pas
catastrophique en JS pur mais mesurable, et ce coût est repayé en entier à
chaque poll tant que P1.1bis n'est pas traité (les deux se cumulent).

**Action** : remplacer le scan linéaire par une structure qui retrouve la
première lane libre en O(log L) ou O(1) amorti (ex. une min-heap des index
de lanes libres, ou un `Set`/tableau trié). Mesurer d'abord sur un vrai gros
repo (fixture ou repo réel type `altered`) avant d'optimiser à l'aveugle —
`L` reste probablement petit (< 50) sur la plupart des repos réels même
"gros", donc à valider que ça vaut le coût de complexification avant de le
faire.

**Mesuré (2026-08-19)** : sur `altered` (~5600 commits, plusieurs branches
longue durée réelles), `max(node.lane)` = 3, soit `L` ≤ 4 — très loin du
seuil où `O(n·L)` devient un problème réel. **Décision : ne pas
implémenter.** Le risque (introduire un bug dans un algorithme de coloration
déjà source de deux bugs réels cette session) dépasse le gain incertain. À
re-mesurer si un repo avec un vrai historique massivement multi-branches
(centaines de branches longue durée simultanées) apparaît un jour.

### P1.2 — Zéro test côté client (HIGH)
**Constat** : `package.json` racine — `"test"` ne lance que `-w server`.
Aucun fichier `*.test.*`/`*.spec.*` dans `client/`, aucune config
vitest/jest côté client.

**Action** : ajouter vitest + `@testing-library/react` au workspace client
(config similaire à `server/vitest.config.ts` si présent, sinon
`client/vitest.config.ts` neuf), brancher `"test"` racine pour lancer les
deux workspaces. Prioriser la couverture sur la logique pure à haut risque
(pas les composants présentationnels) :
- `client/src/search/query.ts` (parsing des opérateurs de recherche)
- `client/src/search/ancestors.ts` (walk d'ancêtres, utilisé par focus branche
  ET par `branch:`/`file:`)
- `client/src/git/linkifyMessage.tsx` (regex URL/`!123`)
- `client/src/git/remoteUrl.ts` (host-sniffing SCP/URL pour 3 forges)
- La logique `matchingNodes` et la récupération sur commit stale dans
  `client/src/App.tsx:393-420`.

### P1.3 — Aucun lint en CI (HIGH, process)
**Constat** : pas de `.eslintrc*`/`eslint.config.*`/prettier config nulle
part dans le repo, pas de script `lint` dans aucun des 4 `package.json`.
`.github/workflows/ci.yml` ("verify") ne fait que typecheck + vitest + build
— `tsc --noEmit` seul ne détecte pas les variables inutilisées, le code mort,
ni les incohérences de style.

**Action** : ajouter eslint (+ plugin React/hooks côté client, plugin TS
partagé) et prettier, scripts `lint`/`format:check` dans chaque workspace +
racine, étape dédiée dans `ci.yml`.

### P1.4 — Aucun test e2e/navigateur (HIGH)
**Constat** : ni `ci.yml` ni les jobs de `release.yml` ne lancent de test
navigateur ; aucune dépendance Playwright/Cypress/Testing-Library dans
aucun `package.json`, alors que le client est une SPA React avec rendu de
graphe, navigation clavier, flux de checkout — les régressions sur ces flux
ne sont détectées qu'en test manuel (`docs/PLAN.md:186-191`).

**Action** : ajouter Playwright (déjà utilisé en vérification manuelle
pendant le dev de cette app — voir les scripts `check_colors.mjs`/
`perf_check.mjs` de sessions précédentes, non committés), un dossier
`client/e2e/` ou `tests/e2e/` avec un scénario minimal (ouvrir un repo, cliquer
un commit, voir le diff, checkout), câblé dans `ci.yml` après le build.

### P1.5 — `docs/PLAN.md` : non-objectifs obsolètes (HIGH, docs)
**Fichier** : `docs/PLAN.md:149-156`.

Liste encore "recherche/filtre de commits" et "blame" comme non-objectifs V1
explicites, alors que les deux sont livrés depuis (recherche :
`server/src/routes/search.ts` + README ; blame/hotspot :
`server/src/git/blame.ts`, `routes/diff.ts:44-66`, UI dans
`DiffPanel.tsx`/`FileChangeList.tsx`). Le doc a déjà une note de correction
similaire (lignes 158-162, pour le file picker/la virtualisation) mais n'a
pas été repassé pour recherche/blame. Un modèle qui lit ce doc pour
comprendre le scope actuel du projet serait induit en erreur.

**Action** : repasser la section non-objectifs, déplacer
recherche/filtre/blame vers les fonctionnalités livrées (avec renvoi vers
les extensions correspondantes plus haut dans le doc), même chose pour le
stash (P3.5 ci-dessous).

## P2 — Sévérité moyenne

### P2.1 — Hotspot : pas de cache, re-walk complet à chaque requête (MEDIUM, perf)
**Fichier** : `server/src/git/hotspot.ts:31`. Chaque ouverture de diff
relance `git log --all --name-only` sur **tout** l'historique, sans aucun
cache. Sur un repo à 5000+ commits, naviguer commit par commit dans le
graphe re-walk toute l'historique à chaque clic — la fix de batching déjà
en place (un seul call au lieu d'un par fichier) n'amortit rien entre deux
requêtes différentes.
**Action** : cacher, par repo, la map fichier→{commits,authors} en mémoire
process, invalidée via le signal fs-watch déjà existant
(`server/src/routes/watch.ts`) plutôt que recalculée à chaque requête.

### P2.2 — `repoStore.ts` : race sur lecture-modification-écriture (MEDIUM)
**Fichier** : `server/src/store/repoStore.ts:19-22,36-47,49-55`. Fichier
JSON lu puis réécrit sans verrou — deux `addRepo`/`removeRepo` concurrents
(double-clic, deux onglets) se perdent l'un l'autre (lost update). Aucun
test.

**Investigation (traité)** : `addRepo`/`removeRepo` sont des fonctions
synchrones sans aucun `await` entre leur `load()` et leur `save()`. La
boucle d'événements Node étant single-thread et non préemptive, cette
séquence lecture-modification-écriture s'exécute donc toujours d'un bloc
avant qu'un autre handler de requête n'ait la main — même si deux `POST
/api/repos` concurrents peuvent se doubler jusqu'au point où ils appellent
`addRepo` (chacun attend d'abord `assertValidRepoPath`, qui est async), le
read-modify-write lui-même ne peut pas s'entrelacer. **Décision : pas de
mutex/verrou fichier ajouté** — le risque décrit ne se reproduit pas dans
la conception actuelle (un seul process serveur). Un vrai risque résiduel,
plus étroit, existe seulement entre deux process serveur distincts pointant
sur le même `~/.minigit-gui/repos.json` (ex. deux `npm run dev` en
parallèle) — non traité, jugé hors scope pour un outil desktop mono-process.
Ajouté à la place : `MINIGIT2_CONFIG_DIR` (override testable) +
`repoStore.test.ts`, dont un test de concurrence qui simule l'écart async
réel (20 `addRepo` lancés via `Promise.all` avec un délai variable avant
chacun) et vérifie qu'aucune écriture n'est perdue — ce test échouerait si
l'invariant "pas d'`await` entre `load()` et `save()`" était cassé par un
futur changement (ex. passage à `fs/promises`).

### P2.3 — Double comptage des "nouveaux commits" (MEDIUM)
**Fichier** : `client/src/App.tsx:160-179,241-250,257-266`.
`refetchGraphWithNewCommitsCount` capture `previousHashes` depuis le cache
avant `fetchQuery`. Le poll 30s et le listener SSE l'appellent chacun de
leur côté ; comme le `fetchRemote` du poll peut lui-même déclencher
l'événement SSE côté serveur, les deux peuvent capturer le même
`previousHashes` obsolète, dédupliquer la requête réseau sous-jacente via
React Query, puis chacun ajouter le même `newCount` au compteur — gonflant
le bandeau "N nouveaux commits".
**Action** : dédupliquer au niveau applicatif (ex. un flag "refresh en
cours" partagé entre les deux déclencheurs, ou dériver `newCommitsCount`
d'une comparaison faite une seule fois après resolution, pas capturée deux
fois avant).

### P2.4 — Listes non virtualisées restantes (MEDIUM, perf)
**Fichiers** : `client/src/components/FileDiff.tsx:132-138` (patch, un
`<div>` par ligne), `:148-180` (blame, idem), `ReflogDialog.tsx:26-34`,
`StashDialog.tsx:31-35`, `BranchesDialog.tsx:99-136` — tous `.map()` sans
fenêtrage. Le reflog en particulier peut être non borné sur un repo actif.
**Action** : au minimum windower le blame (souvent plus long qu'un diff) et
le reflog ; le patch diff a déjà un compromis documenté
(`FileChangeList.tsx:97-99`) qu'on peut laisser tel quel sauf signal contraire.

### P2.5 — `colorGroup` potentiellement `undefined` sur clone shallow (MEDIUM)
**Fichier** : `server/src/graph/layout.ts:95` (et le node correspondant).
Une arête de merge vers un hash jamais visité par aucun walk first-parent
(ex. frontière de clone shallow atteinte seulement via un second parent)
laisse `colorGroupOf.get(parentHash)` à `undefined` ; le cast `as number`
masque le problème et `res.json` droppe silencieusement la clé, violant le
contrat `GraphEdge.colorGroup: number`. Non couvert par `layout.test.ts`.
**Action** : fallback explicite (nouveau groupe) au lieu du cast aveugle,
+ test de fixture "clone shallow" (parent hash absent de `commits`).

### P2.6 — Trous de couverture de tests serveur (MEDIUM)
- `parseNameStatus` (`server/src/git/diff.ts:84-102`) : zéro test (seul
  `parseNumstat` est testé dans `diff.test.ts`) alors qu'il pilote les
  badges added/deleted/renamed.
- `parseRefDecorations` (`server/src/git/log.ts:69-102`) : zéro test alors
  qu'il pilote tout le parsing HEAD/tag/remote/multi-décoration du graphe.
- `resolveCheckoutTarget` (`server/src/git/checkout.ts:63-78`) : zéro test
  sur le cas d'ambiguïté nom-de-remote-avec-slash.
**Action** : un fichier de test par fonction, fixtures directes (pas besoin
de repo git réel, ce sont des parseurs purs).

### P2.7 — CI : logique verify triplée (MEDIUM)
**Fichiers** : `ci.yml:22-29`, `release.yml:71-77`, `release.yml:118-125` —
chacun retape les mêmes 3 commandes npm (typecheck/test/build) ; seul le
calcul du tag (`determine-tag`) a été centralisé délibérément. Un nouveau
step de vérification ajouté dans un job doit être dupliqué manuellement dans
les deux autres.
**Action** : extraire une reusable workflow (`.github/workflows/verify.yml`
appelée via `workflow_call`) ou une composite action, utilisée par les 3
jobs.

### P2.8 — Pas de champ `engines` malgré une dépendance dure à Node 22 (MEDIUM)
**Constat** : `packaging/linux/build-sidecar.sh:20` et
`packaging/windows/build-sidecar.sh:22` ciblent `--target=node22` ; CI pin
`node-version: 22` à 3 endroits différents (`ci.yml:17`, `release.yml:49,111`)
— mais aucun `package.json` (racine, client, server) ne déclare
`engines.node`. Un build local sur un Node différent échoue silencieusement
au niveau SEA/postject plutôt qu'avec une erreur npm claire.
**Action** : ajouter `"engines": { "node": ">=22 <23" }` (ou la contrainte
exacte voulue) dans les `package.json` concernés.

### P2.9 — `App.tsx` trop gros, aucune extraction en hooks (MEDIUM, dette)
**Fichier** : `client/src/App.tsx` (720 lignes). Porte la sélection de repo,
le fetch + filtrage du graphe (focus/ancestors), le parsing/matching de
recherche, le routage de mode diff, l'auto-refresh (poll+SSE), le
redimensionnement, et l'état ouvert/fermé de 5 dialogs — 42 sites
`useCallback`/`useMemo`/`useEffect`/`useState`/`useRef` sur tout le fichier.
Le vrai coût est cognitif : un seul fichier mélange fetching, filtrage et
orchestration UI.

**Décision : ne pas implémenter.** Contrairement à P2.10 (pure extraction de
markup, sans risque), les effets ici sont réellement interdépendants — le
correctif P2.3 de cette même session (dédup du double-comptage entre le poll
30s et l'écouteur SSE via `refreshInFlightRef`) est un exemple concret de
cette interdépendance : extraire `useGraphData` sans reproduire exactement
ce genre de couplage entre effets serait facile à faire subtilement de
travers (closures obsolètes, tableau de dépendances d'effet incorrect), et
il n'existe aucun test au niveau de `App.tsx` lui-même (seul le test e2e
Playwright, qui ne couvre pas recherche/focus/auto-refresh) qui détecterait
une régression de ce type. Le gain est purement cognitif, pas un bug corrigé
ni un gain de perf — risque disproportionné par rapport au payoff mesuré.
Revisiter si `App.tsx` continue de grossir ou si une régression réelle sur
l'auto-refresh/la recherche apparaît.

### P2.10 — Dialogs dupliqués (MEDIUM, dette) — traité
**Fichiers** : `BranchesDialog.tsx`, `StashDialog.tsx`, `ReflogDialog.tsx`,
`RepoPathBrowser.tsx`, `ConfirmCheckoutDialog.tsx`, `AddRepoDialog.tsx` (6
sites au total, pas seulement les 3 initialement repérés) — chacun
réimplémentait le même échafaudage backdrop/dialog-box/titre/fermeture.

Factorisé en un composant `Dialog` partagé
(`client/src/components/Dialog.tsx`, prop `wide` pour la variante
`.browser-dialog`), utilisé par les 6. Contrairement à `useEntryListQuery`
évoqué dans l'action d'origine, le contenu (loading/error/empty/liste) reste
propre à chaque dialog — les formes de données diffèrent trop (liste plate
pour Reflog/Stash, `{local, remote}` pour Branches, navigation de dossier
pour le browser) pour un hook générique sans complexifier plus qu'il ne
simplifie ; seul le shell visuel commun a été extrait. Vérifié en live
(Playwright + captures d'écran) sur les 5 dialogs cliquables + lecture du
6ème (markup identique, non testé en live).

### P2.11 — Signature de code Windows absente (MEDIUM, packaging)
**Fichier** : `docs/DEPLOY.md:30-32` documente l'avertissement SmartScreen
comme "attendu" — c'est une dette de packaging réelle (pas de certificat, pas
de config de signature dans `tauri.conf.json`), pas juste une note à laisser
telle quelle indéfiniment.
**Action** : évaluer un certificat de signature de code (coût, process) ou
documenter explicitement que c'est un choix assumé à long terme plutôt
qu'un TODO silencieux.

## P3 — Sévérité basse / polish

- **P3.1** — traité : `respondGitError` extrait dans
  `server/src/routes/errorResponse.ts`, utilisé par `diff`/`compare`/
  `checkout`/`branches`/`reflog`/`stash`/`status`/`localDiff`/`search`.
  `fetch.ts` normalisé sur 500 (gardant son propre code `fetch_error`,
  intentionnellement distinct de `git_error` — c'est cette string, pas le
  status HTTP, que `SILENT_CODES` côté client utilise pour ne pas toaster).
  `diff.ts`'s `hotspot_error` laissé tel quel, même raison, déjà commenté
  dans le code.
- **P3.2** — traité : `resolveClientDist` (`server/src/index.ts`) logue un
  `console.warn` avant de retourner `""` sur le chemin d'échec silencieux.
- **P3.3** — vérifié plutôt que corrigé : relecture ligne par ligne des deux
  `build-sidecar.sh` (Linux/Windows) — chaque variable de chemin
  (`ROOT_DIR`/`OUT_DIR`/`OUT_BIN`/`WORK_DIR`) est déjà entre guillemets à
  chaque usage, aucune fragilité réelle trouvée. Commentaire ajouté en tête
  de chaque script pour que ce ne soit pas re-vérifié à l'aveugle par un
  futur audit.
- **P3.4** — **Décision : ne pas implémenter.** `client/src/index.css` fait
  maintenant 1148 lignes. Un découpage par composant sans risque
  fonctionnel demanderait soit une vraie migration CSS Modules/Sass (gros
  chantier, tous les composants à toucher), soit un simple split en
  plusieurs fichiers `.css` importés dans l'ordre (risque faible mais réel
  de rupture de cascade si l'ordre n'est pas parfaitement reproduit, sur
  ~157 sélecteurs à catégoriser correctement) — pour un gain purement de
  navigation, aucun bug ni gain de perf. Même calcul risque/payoff que
  P1.1ter/P2.9 : skip documenté plutôt que tenté. Revisiter si le fichier
  continue de grossir significativement.
- **P3.5** — traité (voir plus haut : `docs/PLAN.md` déjà corrigé avec P1.5).
- **P3.6** — traité : `CopyableText.tsx` a maintenant un `.catch` sur
  `navigator.clipboard.writeText(...)`, toast "Couldn't copy to clipboard."
  sur échec au lieu d'un silence total.
- **P3.7** — traité, en corrigeant le vrai bug plutôt qu'en le documentant
  seulement : nouveau `client/src/search/dateBoundary.ts`
  (`parseDateBoundary`, testé) — une valeur `YYYY-MM-DD` nue est désormais
  interprétée comme minuit **local** (début de journée pour `after:`, fin de
  journée pour `before:`) plutôt que minuit UTC (comportement natif de
  `new Date("YYYY-MM-DD")`), qui excluait silencieusement les commits de la
  soirée dans tout fuseau à l'ouest d'UTC.
- **P3.8** — traité : `.github/dependabot.yml` ajouté (écosystèmes `npm` et
  `github-actions`, hebdomadaire). `typescript@^5.6.3` triplé dans les 3
  `package.json` laissé tel quel comme demandé — non-triviale à centraliser
  proprement dans des npm workspaces sans risquer une divergence de version
  entre workspaces au build.
- **P3.9** — traité : commentaire ajouté dans `server/src/routes/fs.ts`
  reliant explicitement son `path.resolve` ouvert par design au modèle de
  menace CSRF-via-GET de P0.1 (aucun changement de comportement — sévérité
  déjà jugée basse, juste pour qu'un futur audit ne le re-découvre pas comme
  un finding séparé).

## Non-findings notés (pour éviter qu'un futur audit les re-signale)

- Pas d'auto-updater Tauri, pas de build macOS packagé : **confirmé
  intentionnel et déjà documenté** (`tauri.conf.json`, `docs/DEPLOY.md:44-69`),
  pas une lacune silencieuse.
- Le job `build-windows` a un smoke-test runtime du sidecar
  (`release.yml:134-152`) que `build-appimage` n'a pas — asymétrie mineure,
  pas une régression (Windows est le plus récent des deux) ; ajouter le même
  smoke-test côté Linux serait cohérent mais bas risque.
- La migration React Query est **complète** : aucun pattern `fetch`+`useEffect`
  résiduel trouvé en dehors de `api/client.ts`.
