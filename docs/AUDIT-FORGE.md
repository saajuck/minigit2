# Audit — croiser les PR/MR d'une forge avec le graphe de commits

**Date** : 2026-10-08 · **Portée** : étude de faisabilité, aucun code produit.
**Objectif évalué** : fournir un lien de repo (GitHub ou GitLab) et voir, dans le
graphe, les métadonnées des PR/MR attachées aux branches — labels, reviewers,
commentaires.

## Comment lire ce document

Chaque constat porte sa provenance, parce qu'elles n'ont pas la même valeur :

- **[MESURÉ]** — vérifié par une commande exécutée le 2026-10-08, contre
  `saajuck/minigit2` pour GitHub et le projet public `gitlab-org/gitlab`
  (id 278964) pour GitLab. La commande est citée.
- **[DOC]** — comportement documenté par la forge, **non vérifié ici**, avec la
  raison pour laquelle il ne l'a pas été.
- **[HYPOTHÈSE]** — raisonnement non vérifié, signalé comme tel.
- **[AVIS]** — jugement de conception, pas un fait.

Aucune ligne de ce document ne doit être traitée comme acquise si elle est
marquée [DOC] ou [HYPOTHÈSE].

## 1. Réponse courte à la question posée

Oui pour les labels, les reviewers et les commentaires, sur les deux forges.
**[MESURÉ]** Le point dur n'est pas l'accès aux données : c'est de rattacher une
PR à quelque chose qui existe réellement dans le graphe local. Dans un clone
frais de ce repo, **76 des 91 PR fusionnées ont une tête de branche absente du
dépôt local** (section 4). C'est là que se joue la faisabilité, pas dans l'API.

## 2. Ce que GitHub expose

### 2.1 En une requête par page de 100 PR

**[MESURÉ]** `GET /repos/{o}/{r}/pulls?state=all&per_page=100` — chaque élément
de liste porte 36 champs, dont tout ce qui a été demandé sauf les compteurs :

| Besoin | Champ | Présent dans la liste |
|---|---|---|
| Labels | `labels[]` (`name`, `color`, `description`) | oui |
| Reviewers demandés | `requested_reviewers[]`, `requested_teams[]` | oui |
| Assignés | `assignees[]` | oui |
| Branche source | `head.ref`, `head.sha`, `head.repo.full_name` | oui |
| Branche cible | `base.ref`, `base.sha` | oui |
| Commit de merge/squash | `merge_commit_sha` | oui |
| État | `state`, `draft`, `merged_at`, `closed_at` | oui |

**[MESURÉ]** Champs présents sur le `GET` d'une PR seule mais **absents de la
liste** : `comments`, `review_comments`, `commits`, `additions`, `deletions`,
`changed_files`, `mergeable`, `merged`. Les demander par PR, c'est un N+1.

### 2.2 Contourner le N+1 sur les commentaires

**[MESURÉ]** `GET /repos/{o}/{r}/issues?state=all&per_page=100` renvoie les PR
(une PR *est* une issue côté API : champ `pull_request` présent) **avec le
compteur `comments` et les `labels`**. En revanche aucun `head.sha` : il faut
joindre sur `number` avec la liste de 2.1. Deux passes de liste suffisent donc
pour labels + reviewers + compteur de commentaires + ancrage.

**[MESURÉ]** Endpoints en vrac à l'échelle du repo, utiles pour une synchro
incrémentale :
- `GET /repos/{o}/{r}/issues/comments?since=…` — commentaires de conversation,
  tous PR confondues. Vérifié : renvoie des éléments, porte `updated_at`.
- `GET /repos/{o}/{r}/pulls/comments?since=…` — commentaires de revue inline.
  Endpoint vérifié joignable, **mais ce repo n'en contient aucun**, donc le
  schéma n'a pas pu être observé. **[DOC]** chaque élément porte `commit_id`,
  `original_commit_id`, `path`, `line`, `side`, `diff_hunk` — ce qui
  permettrait d'ancrer un commentaire sur un commit *et* un fichier précis du
  graphe. **Non vérifié ici faute de données.**

### 2.3 Ce qui reste irréductiblement par PR en REST

**[MESURÉ]** L'état des revues (`APPROVED`, `CHANGES_REQUESTED`, …) s'obtient
par `GET /pulls/{n}/reviews`. Aucun endpoint REST à l'échelle du repo n'a été
trouvé pour les agréger. Pour 120 PR, cela fait 120 requêtes.

**[DOC]** GraphQL permettrait de récupérer PR + labels + reviewers + revues +
compteurs en une requête paginée. **Non vérifié** : le proxy GitHub de cette
session refuse GraphQL (`GitHub GraphQL is not available through this session's
GitHub proxy`). Cette piste est donc à valider avant d'être retenue.

## 3. Ce que GitLab expose

**[MESURÉ]** `GET /api/v4/projects/{id}/merge_requests?per_page=100` — 51 champs
par élément, strictement plus riches que GitHub pour cet usage :

| Besoin | Champ | Remarque |
|---|---|---|
| Labels | `labels[]` | **noms seulement**, pas les couleurs |
| Reviewers | `reviewers[]` | reviewers réellement assignés |
| Assignés | `assignees[]` | |
| Branche source | `source_branch`, `sha` | |
| Commit de merge | `merge_commit_sha` **et** `squash_commit_sha` | les deux distincts, là où GitHub n'a que `merge_commit_sha` |
| Commentaires | **`user_notes_count`** | **dans la liste** — pas de N+1 |
| Approbations | `approvals_before_merge`, `blocking_discussions_resolved` | |
| Divers | `draft`, `squash`, `upvotes`, `downvotes`, `detailed_merge_status`, `has_conflicts` | |

**[MESURÉ]** `GET /projects/{id}/merge_requests/{iid}/approvals` renvoie 200
sans token sur un projet public.

### 3.1 Asymétrie d'authentification mesurée

**[MESURÉ]** Sur le projet **public** 278964, sans token, le 2026-10-08 :

| Endpoint | Code |
|---|---|
| `projects/278964` | 200 |
| `projects/278964/merge_requests` | 200 |
| `projects/278964/merge_requests/{iid}` | 200 |
| `projects/278964/merge_requests/{iid}/commits` | 200 |
| `projects/278964/merge_requests/{iid}/approvals` | 200 |
| `projects/278964/repository/commits` | 200 |
| `projects/278964/merge_requests/{iid}/notes` | **401** |
| `projects/278964/merge_requests/{iid}/discussions` | **401** |
| `projects/278964/labels` | **401** |

Conséquence directe : sur GitLab, **le contenu des commentaires et les couleurs
de labels exigent un token même pour un projet public**, alors que la liste des
MR n'en demande pas. Les compteurs de commentaires, eux, passent (ils sont dans
la liste).

**[HYPOTHÈSE]** C'est probablement une protection anti-abus propre à
gitlab.com plutôt qu'une règle du produit ; le comportement d'une instance
auto-hébergée peut différer. Non vérifié, faute d'instance self-hosted
accessible.

**[MESURÉ]** `GET /projects/gitlab-org%2Fgitlab` → 200 : le chemin de projet
URL-encodé fonctionne comme identifiant, donc une URL de repo se traduit
directement, sans résolution d'id préalable.

## 4. Le problème central : rattacher une PR au graphe

C'est le constat le plus important de cet audit.

### 4.1 La tête de branche n'existe pas localement

**[MESURÉ]** Clone frais de `saajuck/minigit2` (`git clone`, refspec par défaut
`+refs/heads/*:refs/remotes/origin/*`, 153 commits atteignables), croisé avec
les 91 PR fusionnées de la première page de `/pulls?state=closed&per_page=100` :

| | Présents | Absents |
|---|---|---|
| `head.sha` des PR fusionnées | **15** | **76** |
| `merge_commit_sha` des PR fusionnées | **91** | 0 |

La cause est le squash-merge, que ce repo utilise systématiquement : le commit
de tête de la branche n'entre jamais dans l'historique, et la branche est
supprimée après le merge. **[MESURÉ]** sur la PR #118 de ce repo :
`head.sha = 53f9a764…` n'est pas un ancêtre de `master`, et
`git ls-remote origin refs/heads/claude/…` ne renvoie rien.

Autrement dit : **ancrer une PR sur sa tête de branche ne marche que pour les
PR ouvertes.** Pour 83 % des PR fusionnées de ce repo, l'ancre n'existe pas.

### 4.2 Les deux forges conservent un namespace de refs

**[MESURÉ]** `git ls-remote origin refs/pull/118/*` →
`53f9a764… refs/pull/118/head`. La tête est donc **toujours servie par GitHub
après suppression de la branche**.

**[MESURÉ]** Équivalent GitLab, sur une MR fusionnée de `gitlab-org/gitlab` :
`refs/merge-requests/260595/head` **et** `refs/merge-requests/260595/merge`.

### 4.3 Coût de récupérer ce namespace

**[MESURÉ]** Sur le clone frais,
`git fetch origin "+refs/pull/*/head:refs/remotes/origin/pr/*"` puis `git gc` :

| | Avant | Après |
|---|---|---|
| Taille de `.git` | 3 016 KiB | **3 672 KiB** (+656 KiB, +21,7 %) |
| Commits atteignables | 153 | 251 |
| Refs PR | 0 | 120 |
| Têtes de PR fusionnées présentes | 15 / 91 | **91 / 91** |
| Durée du fetch | — | **1 s** |

**[AVIS]** Pour un repo de cette taille le coût est négligeable et le gain
total. Sur un monorepo à dizaines de milliers de PR, ni la taille ni la durée ne
se déduisent de cette mesure — à remesurer avant d'en faire un comportement par
défaut.

### 4.4 Trois stratégies d'ancrage, et ce qu'elles coûtent

1. **Ancrer sur `merge_commit_sha`.** Toujours présent sur la branche par
   défaut **[MESURÉ : 91/91]**, aucun fetch supplémentaire. Mais le commit de
   squash n'est pas la branche : on ne peut pas montrer les commits de la PR,
   seulement marquer le point d'atterrissage. Les PR ouvertes n'ont pas de
   `merge_commit_sha` et nécessitent l'ancrage 2.
2. **Ancrer sur `head.sha` après fetch de `refs/pull/*` /
   `refs/merge-requests/*`.** Donne les vrais commits de la PR, y compris
   fusionnées. Coûte un fetch supplémentaire et fait grossir le dépôt de
   l'utilisateur **[MESURÉ : +21,7 % ici]** — effet de bord sur *son* repo, pas
   seulement sur l'app.
3. **Ancrer sur la liste de commits de la PR.** **[MESURÉ]**
   `GET /pulls/118/commits` renvoie les 2 SHA de la PR, et
   `GET /projects/{id}/merge_requests/{iid}/commits` fonctionne sans token. Même
   limite que 1 : les SHA renvoyés sont ceux de la branche, donc absents du
   clone si elle a été squashée. Et c'est une requête par PR.

**[AVIS]** Les stratégies 1 et 2 sont complémentaires, pas concurrentes :
1 permet un affichage utile sans rien changer au dépôt, 2 est l'option à
proposer explicitement à qui veut voir les commits des PR fusionnées. Le choix
appartient à l'utilisateur, pas à l'app, parce que l'option 2 modifie son dépôt.

## 5. Coût en requêtes et limites de débit

**[MESURÉ]** Pour ce repo (120 PR), par passe de synchronisation complète :

| Donnée | Requêtes | Comment |
|---|---|---|
| PR + labels + reviewers + ancrage | 2 | `/pulls?per_page=100`, 2 pages |
| Compteurs de commentaires | 2 | `/issues?per_page=100`, 2 pages |
| Commentaires de conversation | 1+ | `/issues/comments?since=` |
| Commentaires de revue inline | 1+ | `/pulls/comments?since=` |
| États de revue | **120** | `/pulls/{n}/reviews`, un par PR |

Soit ~6 requêtes pour tout **sauf** les états de revue, qui à eux seuls coûtent
20× le reste en REST.

**Limites observées et documentées :**

- **[MESURÉ]** GitHub, en-têtes de cette session : `X-Ratelimit-Limit: 15000`.
  C'est le crédit du proxy de cette session, **pas** celui d'un token
  utilisateur.
- **[DOC]** GitHub : 5 000 req/h pour un PAT, 60 req/h sans authentification.
  **Non vérifié ici** — impossible de tester un PAT ou l'anonyme à travers ce
  proxy.
- **[MESURÉ]** GitLab, en-têtes réels sans token :
  `ratelimit-limit: 500`, `ratelimit-name: throttle_unauthenticated_api`, soit
  500 req/min par IP.
- **[DOC]** GitLab authentifié : 2 000 req/min. **Non vérifié ici.**

**[MESURÉ]** Synchronisation incrémentale possible sur les deux :
`/pulls?sort=updated&direction=desc` (vérifié : #120, #119, #118 dans cet
ordre), `/issues?since=` (vérifié : 3 éléments depuis le 2026-10-05),
`/merge_requests?updated_after=` (vérifié : 3 éléments). GitHub expose aussi un
en-tête `Link` avec `rel="next"`/`rel="last"` **[MESURÉ]**, donc la pagination
est connue d'avance.

**[AVIS]** Avec `updated_after`/`since`, le régime permanent coûte 2-3 requêtes
par rafraîchissement, pas 120. La synchro complète n'est le coût réel qu'au
premier chargement.

**[MESURÉ]** Pas de webhooks possibles : l'app tourne en local et ne parle qu'à
`127.0.0.1` (`server/src/index.ts`). Donc polling uniquement, avec la cadence
d'auto-refresh déjà configurable dans les réglages.

## 6. Ce que ça change pour le produit

**[MESURÉ]** Le serveur fait **déjà** des appels réseau : `server/src/git/fetch.ts`
lance `git fetch --all --prune` avec `GIT_TERMINAL_PROMPT=0`. Le réseau n'est
donc pas une nouveauté.

**[MESURÉ]** En revanche il n'existe **aucune gestion de secret** dans le code :
`grep -rniE "token|secret|credential|api_key|authorization"` sur
`server/src`, `client/src`, `shared/src` ne renvoie que des variables du parseur
de diff. Stocker un token de forge serait donc entièrement nouveau, et pose des
questions qu'aucun code existant ne tranche : où il est écrit, avec quelles
permissions de fichier, s'il transite par le client, ce qu'il devient dans les
logs (le serveur logue déjà ses erreurs git sur stderr), et ce qui se passe à la
désinstallation.

**[MESURÉ]** Le README positionne l'app comme « A fast, **local** Git graph
client … running as a real desktop window on your own machine ». L'en-tête
`local · read-only` a d'ailleurs été retiré de l'UI dans un cycle précédent.
**[AVIS]** Lire une forge distante ne contredit pas « local » (le dépôt reste
local), mais stocker un credential d'écriture-potentielle change la nature du
produit et mérite une décision explicite plutôt qu'un glissement. Un token en
lecture seule à portée minimale limite l'exposition sans supprimer la question.

## 7. Identifier le repo depuis une URL

**[MESURÉ]** Le remote de ce repo est `https://github.com/saajuck/minigit2`.
Formes à reconnaître, et pièges :

- `https://host/owner/repo(.git)?` et `git@host:owner/repo.git` — deux syntaxes
  sans rapport, à normaliser.
- GitLab autorise les **sous-groupes** : `gitlab.com/groupe/sous-groupe/projet`.
  Un découpage naïf en deux segments casse. **[MESURÉ]** l'API accepte le chemin
  complet URL-encodé (`projects/gitlab-org%2Fgitlab` → 200), donc la bonne
  approche est de garder le chemin entier, pas de le découper.
- Self-hosted : GitHub Enterprise et GitLab auto-hébergé n'ont pas le host
  public, donc le type de forge **ne se déduit pas du nom de domaine**. Il faut
  soit le demander, soit le sonder.
- Plusieurs remotes, ou un fork dont `head.repo.full_name` diffère du repo
  cible : **[MESURÉ]** le champ existe sur la PR #118 et vaut
  `saajuck/minigit2`, mais rien ne garantit l'égalité dans le cas général.

## 8. Ce qui n'a pas pu être vérifié

Liste explicite, pour qu'aucune de ces lignes ne soit reprise comme acquise :

1. **GraphQL GitHub** — refusé par le proxy de cette session. C'est la seule
   piste connue pour éviter les 120 requêtes d'états de revue ; sa validation
   conditionne le coût réel de cette fonctionnalité.
2. **Schéma des commentaires de revue GitHub** (`commit_id`, `path`, `line`) —
   endpoint joignable mais ce repo n'a aucun commentaire inline. C'est pourtant
   le champ qui permettrait d'ancrer un commentaire sur un commit du graphe.
3. **Commentaires et couleurs de labels GitLab** — 401 sans token, aucun token
   GitLab disponible dans cette session.
4. **Limites de débit réelles d'un token utilisateur**, GitHub comme GitLab.
5. **Comportement d'une instance auto-hébergée**, des deux forges.
6. **Coût du fetch de `refs/pull/*` sur un gros repo** — mesuré seulement sur
   ce repo (120 PR, 3 Mo).
7. **Bitbucket, Gitea, Forgejo** — hors périmètre demandé, non examinés.

## 9. Questions à trancher avant tout code

Ce sont des décisions produit, pas techniques, et elles ne m'appartiennent pas :

1. **Jusqu'où va le croisement ?** Marquer les commits concernés par une PR est
   un travail d'une autre ampleur qu'afficher les fils de commentaires inline
   dans le panneau de diff. Les deux sont possibles ; leurs coûts n'ont rien de
   comparable.
2. **A-t-on le droit de modifier le dépôt de l'utilisateur** en fetchant
   `refs/pull/*` ? Sans ça, les PR fusionnées ne sont ancrables que sur leur
   commit de squash.
3. **Où vit le token**, et accepte-t-on qu'une app décrite comme locale en
   détienne un ?
4. **Que montre-t-on hors ligne ou sans token ?** Le graphe doit rester
   utilisable : la dégradation doit être un choix, pas un effet de bord.
5. **Une forge d'abord, ou les deux ?** GitLab donne plus en moins de requêtes
   (compteurs dans la liste, `squash_commit_sha` distinct) mais exige un token
   pour les commentaires, même en public. GitHub est l'inverse.
