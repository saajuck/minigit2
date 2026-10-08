# Faisabilité — croiser les PR/MR d'une forge avec le graphe de commits

**Date** : 2026-10-08 · **Périmètre** : GitHub et GitLab, dépôts publics et
privés. **Question traitée** : est-ce possible, et à quelles contraintes pour
l'utilisateur. Ce document ne propose aucune implémentation et ne tranche aucun
choix produit.

**Périmètre précisé par le demandeur (2026-10-08)** : les quatre combinaisons
sont à couvrir, et dans leur variante la plus large — GitHub en dépôts
personnels **et** en organisation sous SAML SSO, GitLab sur gitlab.com **et** en
instance auto-hébergée, et des dépôts cibles qui **mélangent** squash-merge et
commits de merge. Aucune des simplifications possibles n'est donc applicable :
les contraintes des sections 4.3 (SSO), 4.4 (auto-hébergé) et 3 (rattachement)
s'appliquent toutes.

## Comment lire ce document

Les constats n'ont pas tous la même valeur, donc chacun porte sa provenance :

- **[MESURÉ]** — vérifié par une commande exécutée le 2026-10-08. Cibles :
  `saajuck/minigit2` (GitHub, public — `private: false` mesuré),
  `saajuck/test-private` (GitLab, privé), `gitlab-org/gitlab` (GitLab, public).
- **[DOC]** — comportement documenté par la forge, **non vérifié ici**, avec la
  raison.
- **[HYPOTHÈSE]** — raisonnement non vérifié, signalé comme tel.
- **[AVIS]** — jugement, pas un fait.

**Limite de mesure à connaître avant tout le reste** : **[MESURÉ]** tout appel à
`api.github.com` depuis cet environnement est intercepté par un proxy qui
injecte un credential (`X-Ratelimit-Limit: 15000`) et refuse les dépôts hors
périmètre (403). Le comportement **non authentifié** de GitHub, ses limites de
débit réelles et le cas du **dépôt GitHub privé** sont donc hors de portée de
mesure ici. Côté GitLab il n'y a aucun credential dans cette session, donc tout
ce qui exige un token reste également non mesuré.

## 1. Verdict

| | GitHub public | GitHub privé | GitLab public | GitLab privé |
|---|---|---|---|---|
| Labels de la PR/MR | **oui** [MESURÉ] | oui, avec token [DOC] | **oui**, sans token [MESURÉ] | oui, avec token [DOC] |
| Couleurs des labels | **oui** [MESURÉ] | oui, avec token [DOC] | **non sans token** [MESURÉ : 401] | oui, avec token [DOC] |
| Reviewers | **oui** [MESURÉ] | oui, avec token [DOC] | **oui**, sans token [MESURÉ] | oui, avec token [DOC] |
| Nombre de commentaires | **oui** [MESURÉ] | oui, avec token [DOC] | **oui**, sans token [MESURÉ] | oui, avec token [DOC] |
| Contenu des commentaires | **oui** [MESURÉ] | oui, avec token [DOC] | **non sans token** [MESURÉ : 401] | oui, avec token [DOC] |
| État des revues (approuvé / changements demandés) | oui, 1 requête par PR [MESURÉ] | idem, avec token [DOC] | oui (`approvals`), sans token [MESURÉ] | idem, avec token [DOC] |
| Rattacher la PR à un commit du graphe | **oui**, sous conditions — section 3 | idem | idem | idem |

**Réponse courte : oui, c'est possible dans les quatre cas.** Aucun blocage
technique n'a été trouvé du côté des données. Les contraintes réelles sont
ailleurs : elles portent sur ce que l'utilisateur doit fournir ou accepter
(section 4), et sur un problème de rattachement qui n'a rien à voir avec
l'authentification (section 3).

## 2. Ce que les deux forges exposent

**[MESURÉ]** Les trois données demandées — labels, reviewers, commentaires —
existent sur les deux forges. Ce qui diffère, c'est **où** elles vivent, donc
combien de requêtes elles coûtent.

| | GitHub | GitLab |
|---|---|---|
| Endpoint de liste | `GET /repos/{o}/{r}/pulls` — 36 champs | `GET /projects/{id}/merge_requests` — 51 champs |
| Labels dans la liste | oui, avec `color` | oui, **noms seuls** |
| Reviewers dans la liste | `requested_reviewers` (demandés) | `reviewers` (assignés) |
| Compteur de commentaires dans la liste | **non** | **oui** (`user_notes_count`) |
| Ancre de merge | `merge_commit_sha` | `merge_commit_sha` **et** `squash_commit_sha` |
| Branche source | `head.ref` + `head.sha` | `source_branch` + `sha` |

**[MESURÉ]** Côté GitHub, `comments`, `review_comments`, `commits`, `additions`,
`deletions`, `changed_files` et `mergeable` n'existent **que** sur le `GET`
d'une PR seule. Deux contournements existent et ont été vérifiés :
`GET /repos/{o}/{r}/issues?state=all` renvoie les PR avec leur compteur
`comments` et leurs `labels` (mais sans `head.sha`, donc à joindre sur
`number`), et les endpoints en vrac `/issues/comments?since=` et
`/pulls/comments?since=` existent à l'échelle du dépôt.

**[MESURÉ]** L'état des revues GitHub (`APPROVED`, `CHANGES_REQUESTED`) n'a
aucun endpoint REST à l'échelle du dépôt : c'est une requête par PR.
**[DOC]** GraphQL le batcherait ; **non vérifié**, le proxy de cette session
refuse GraphQL (`GitHub GraphQL is not available through this session's GitHub
proxy`). C'est la seule inconnue qui porte sur un volume de requêtes, pas sur
une capacité.

**[MESURÉ]** Sur GitLab, le chemin de projet URL-encodé suffit comme
identifiant (`projects/gitlab-org%2Fgitlab` → 200), y compris avec des
sous-groupes. Une URL de dépôt se traduit donc directement, sans résolution
préalable.

## 3. La contrainte qui ne vient pas de l'authentification

C'est le constat le plus important de cette étude, et il est indépendant de la
forge et du caractère public ou privé.

**[MESURÉ]** Clone frais de `saajuck/minigit2` (refspec par défaut
`+refs/heads/*:refs/remotes/origin/*`), croisé avec ses 91 PR fusionnées :

| | Présents | Absents |
|---|---|---|
| `head.sha` des PR fusionnées | **15** | **76** |
| `merge_commit_sha` des PR fusionnées | **91** | **0** |

Cause : le squash-merge suivi de la suppression de la branche. Le commit de tête
n'entre jamais dans l'historique. **[MESURÉ]** sur la PR #118 : `head.sha` n'est
pas un ancêtre de `master`, et la branche ne figure plus dans `git ls-remote`.

**Conséquence de faisabilité** : sans récupération supplémentaire, une PR
fusionnée n'est rattachable qu'à **son commit de squash** — on peut marquer où
elle a atterri, pas montrer ses propres commits. Les PR **ouvertes** ne sont pas
concernées, leur branche existant encore.

**[MESURÉ]** Les deux forges conservent un namespace de refs qui restitue ces
commits, y compris après suppression de la branche :
`refs/pull/{n}/head` (GitHub, vérifié sur la PR #118) et
`refs/merge-requests/{iid}/head` ainsi que `/merge` (GitLab, vérifié sur une MR
fusionnée de `gitlab-org/gitlab`).

**[MESURÉ]** Coût de les récupérer, sur ce dépôt (120 PR, 3 Mo) :

| | Avant | Après |
|---|---|---|
| Taille de `.git` | 3 016 KiB | **3 672 KiB** (+656 KiB, +21,7 %) |
| Têtes de PR fusionnées présentes | 15 / 91 | **91 / 91** |
| Durée | — | **1 s** |

**[AVIS]** Négligeable à cette échelle. **[HYPOTHÈSE]** Ni la durée ni la taille
ne se déduisent de cette mesure pour un dépôt à plusieurs milliers de PR.

**[MESURÉ]** Le chiffre de 76/91 est propre à un dépôt qui squashe
systématiquement. Un dépôt en commits de merge a ses têtes de PR comme ancêtres
de la branche par défaut, donc présentes sans aucune récupération
supplémentaire. **La contrainte dépend de la façon de merger, pas de la forge.**

**Conséquence du périmètre précisé** : les dépôts cibles mélangeant les deux
stratégies, le taux d'ancres manquantes **varie d'un dépôt à l'autre et ne se
déduit pas** — il se mesure (annexe). La contrainte doit donc être considérée
comme présente : il existera des dépôts où une partie des PR fusionnées n'est
rattachable qu'à son commit de squash sans récupération supplémentaire, et
d'autres où la question ne se pose pas.

## 4. Contraintes pour l'utilisateur

### 4.1 Dépôt public

**[MESURÉ]** Sur GitHub, tout est accessible. Sur GitLab, la liste des MR, leur
détail, leurs commits et leurs approbations répondent **sans token** ; mais
`/notes`, `/discussions` et `/labels` répondent **401 même sur un projet
public**. Donc : les compteurs de commentaires et les noms de labels passent
sans rien, leur **contenu** et leurs **couleurs** non.

**[HYPOTHÈSE]** C'est probablement une protection anti-abus propre à
gitlab.com plutôt qu'une règle du produit ; une instance auto-hébergée peut se
comporter autrement. Non vérifié.

### 4.2 Dépôt privé

L'utilisateur doit fournir un **token de lecture**. Il n'y a pas d'alternative :
**[DOC, confiance élevée]** aucune API de forge n'accepte une session de
navigateur. C'est la contrainte principale de ce périmètre.

**[MESURÉ]** Scopes GitLab adaptés, annoncés par l'instance : `read_api` (les
métadonnées de MR) et `read_repository` (le git). **[DOC]** Côté GitHub, un
token à portée fine avec « Pull requests : read ».

**[MESURÉ]** Le code actuel ne gère **aucun secret** :
`grep -rniE "token|secret|credential|api_key|authorization"` sur `server/src`,
`client/src` et `shared/src` ne renvoie que des variables du parseur de diff.
Détenir un token serait donc une capacité entièrement nouvelle pour cette app.

**[MESURÉ]** En revanche le réseau n'est pas nouveau, et surtout **git et l'API
ont des chemins de credentials séparés** : le serveur lance déjà
`git fetch --all --prune` avec `GIT_TERMINAL_PROMPT=0`
(`server/src/git/fetch.ts`), donc il s'appuie sur le credential helper ou la clé
SSH **déjà configurés par l'utilisateur**. La récupération des refs de la
section 3 en hériterait sans que l'app détienne quoi que ce soit. Conséquence :
même si l'API est inaccessible, le rattachement des PR fusionnées reste
possible — on perd labels, reviewers et commentaires, pas la topologie.

### 4.3 SSO

### « Un SSO ne suffit pas ? »

Si, pour l'utilisateur — non, pour le transport. La distinction est la clé de
toute cette section, donc elle mérite d'être posée nettement.

**[DOC, confiance élevée]** Le SSO authentifie une **session de navigateur** :
l'IdP émet une assertion vers la forge, la forge pose un cookie de session
valable pour son interface web. Une app locale qui appelle `/api/v4` ou
`api.github.com` n'est pas ce navigateur : elle n'a pas ce cookie, et les deux
forges ne contractualisent pas l'accès API par cookie de session. Le SSO ne
*transporte* donc rien jusqu'à l'API.

Mais le SSO reste parfaitement suffisant comme **mécanisme de connexion**, à
condition qu'il aboutisse à un token. C'est exactement ce que fait OAuth :
l'utilisateur clique, se connecte avec son identité d'entreprise dans son
navigateur habituel, et la forge émet un token à l'app. De son point de vue, il
« s'est connecté en SSO » et n'a manipulé aucun secret. La contrainte n'est donc
pas « le SSO ne marche pas », c'est « le SSO doit se terminer par un token ».

**[HYPOTHÈSE, et c'est une mauvaise piste à écarter explicitement]** Cette app
*est* un webview (Tauri) : elle pourrait techniquement afficher la page de
connexion, faire le SSO et conserver le cookie. Trois raisons de ne pas y
compter : l'app détiendrait la session **à tous les droits** de l'utilisateur au
lieu d'un token en lecture seule — strictement moins sûr que le problème qu'on
cherchait à éviter ; l'accès API par cookie n'est pas une interface contractuelle
et peut casser à n'importe quelle mise à jour de la forge ; et les protections
CSRF et same-origin la rendent fragile. Non vérifié, et non souhaitable.

Reste donc, concrètement, l'un de ces deux chemins :

1. **Un token créé à la main** après connexion SSO. Le SSO sert à obtenir le
   token, puis n'intervient plus. Fonctionne partout, mais l'utilisateur
   manipule un secret.
2. **OAuth** : l'app ouvre le navigateur, le navigateur fait la danse SSO,
   l'app reçoit un token. L'utilisateur ne manipule aucun secret, et l'app ne
   voit jamais l'IdP.

**[MESURÉ]** La découverte OIDC de gitlab.com confirme que les deux variantes
utilisables par une app de bureau existent : `grant_types_supported` contient
`authorization_code` **et `device_code`** (plus `refresh_token`), et
`code_challenge_methods_supported` contient **`S256`** (PKCE).

**[MESURÉ — réserve qui conditionne l'option 2]**
`token_endpoint_auth_methods_supported` vaut `client_secret_basic` et
`client_secret_post`. **`none` en est absent.** Une app distribuée est un client
public : elle n'a nulle part où garder un secret. Rien ici ne confirme qu'un
échange PKCE sans secret aboutit. Si un secret est exigé, l'embarquer dans un
binaire téléchargeable n'en fait pas un secret, et il ne reste que l'option 1.

**[DOC, confiance moyenne]** Les groupes sous SAML SSO imposé ajoutent des
contraintes sur les tokens : session SAML active, politiques d'expiration, et
possibilité pour l'administrateur d'**interdire la création de PAT**. Je ne
connais pas ces règles avec assez de certitude pour les énoncer précisément, et
elles diffèrent entre gitlab.com et l'auto-hébergé.

**Correction d'une première version de ce document**, qui affirmait qu'une
interdiction des PAT combinée à la réserve PKCE ne laisserait « aucun chemin ».
C'était trop fort : au moins deux autres porteurs de credential existent.
**[DOC, non vérifié]** les tokens de projet ou de groupe, qui ne sont pas des
tokens personnels et peuvent relever d'une politique différente ; et une
application OAuth créée par l'utilisateur lui-même, dont le `client_id` et le
secret vivraient sur sa machine — exposition équivalente à un PAT, donc ni
meilleure ni pire, mais un chemin distinct qu'une interdiction de PAT ne couvre
pas forcément. **[AVIS]** « Impossible » n'est donc défendable que si *tous* ces
chemins sont fermés, ce qui n'est pas établi et dépend d'une politique
d'organisation, pas de la technique.

**[DOC]** GitHub a la même famille de contrainte : avec SAML SSO sur une
organisation, un token doit être **explicitement autorisé** pour cette
organisation, sinon ses ressources répondent comme si elles n'existaient pas.
Un token valide ne suffit pas.

### 4.4 Instance auto-hébergée

**[MESURÉ]** `/api/v4/version`, `/api/v4/metadata` et `/api/v4/user` répondent
**401** sur gitlab.com. On ne peut donc pas identifier l'instance avant d'être
authentifié ; et le type de forge ne se déduit pas du nom de domaine, un GitHub
Enterprise et un GitLab auto-hébergé n'ayant ni l'un ni l'autre le host public.
L'utilisateur devra donc dire à quelle forge il parle, ou l'app sonder après
authentification.

**[MESURÉ]** Deux magasins de confiance TLS distincts, qui est le piège le plus
spécifique aux instances internes : le serveur lance `git` en sous-processus
(`server/src/git/exec.ts`, OpenSSL, magasin système) et tourne lui-même comme
binaire Node SEA (`packaging/linux/build-sidecar.sh`, magasin Node,
`NODE_EXTRA_CA_CERTS`). **[HYPOTHÈSE]** Sur une instance à CA interne, un dépôt
qui `git fetch` parfaitement peut produire un appel API qui échoue en
vérification TLS, sans que le symptôme oriente vers la cause. Même dédoublement
pour les proxys d'entreprise : `git` honore `http.proxy`, Node honore
`HTTPS_PROXY`.

**[DOC, non vérifié]** Une application OAuth doit exister côté instance. Un
administrateur peut en déclarer une pour toute l'instance ; **[DOC, confiance
moyenne]** un utilisateur peut aussi en créer une dans ses propres réglages, ce
qui fournirait un `client_id` sans dépendre de l'admin.

### 4.5 « Privé » et « inexistant » sont indistinguables

**[MESURÉ]** Vérifié contre un projet GitLab privé réel (`saajuck/test-private`)
comparé à un chemin inexistant :

| Appel, sans credential | Projet privé existant | Projet inexistant |
|---|---|---|
| `GET /api/v4/projects/{path}` | `404 {"message":"404 Project Not Found"}` | identique |
| `GET …/{path}/merge_requests` | `404` | identique |
| `git ls-remote https://…` | `fatal: could not read Username for 'https://gitlab.com': terminal prompts disabled` | identique |

Identiques à l'octet près, **sur les deux chemins d'accès**. C'est délibéré :
répondre 403 divulguerait l'existence du projet. **Contrainte utilisateur
directe** : face à un échec, il ne pourra jamais être renseigné précisément — il
faudra lui présenter les deux hypothèses, « dépôt privé sans token » et « URL
erronée ». **[DOC]** GitHub se comporte de la même manière pour un dépôt privé ;
non vérifiable ici (section « Comment lire »).

### 4.6 Débit : est-ce tenable ?

**[MESURÉ]** GitLab sans token : `ratelimit-limit: 500`,
`ratelimit-name: throttle_unauthenticated_api`, soit 500 req/min par IP.
**[DOC]** GitLab authentifié : 2 000 req/min ; GitHub : 5 000 req/h pour un
token personnel, 60 req/h sans authentification. **Non vérifiés** — le proxy de
cette session masque les limites réelles de GitHub.

**[MESURÉ]** Pour ce dépôt (120 PR), une passe complète coûte ~6 requêtes pour
les labels, reviewers, ancrages et compteurs de commentaires — et **120
requêtes** pour les seuls états de revue GitHub. **[MESURÉ]** La synchronisation
incrémentale fonctionne sur les deux forges (`/pulls?sort=updated`,
`/issues?since=`, `/merge_requests?updated_after=`, tous vérifiés), donc le
régime permanent coûte quelques requêtes, pas une passe complète.

**[AVIS]** Même dans le pire cas mesuré, on est loin des plafonds. Le débit
n'est pas un obstacle de faisabilité ; il le deviendrait sur un dépôt à
plusieurs milliers de PR si les états de revue devaient rester en REST.

**[MESURÉ]** Pas de webhooks : l'app ne parle qu'à `127.0.0.1`, donc aucune
adresse publique où recevoir une notification. Interrogation périodique
uniquement.

## 5. Ce qui n'est pas vérifié

Liste explicite, pour qu'aucune de ces lignes ne soit reprise comme acquise :

1. **Tout le cas GitHub privé**, et le comportement non authentifié de GitHub :
   le proxy de cette session intercepte chaque appel.
2. **Les limites de débit réelles** d'un token utilisateur, sur les deux forges.
3. **GraphQL GitHub** — refusé par le proxy. Seule piste connue pour éviter une
   requête par PR sur les états de revue.
4. **Schéma des commentaires de revue GitHub** (`commit_id`, `path`, `line`) —
   endpoint joignable, mais ce dépôt n'a aucun commentaire inline, donc le
   schéma n'a pas pu être observé.
5. **Tout ce qui demande un token GitLab** — aucun credential GitLab dans cette
   session.
6. **PKCE sans secret client** — `none` absent de la découverte OIDC de
   gitlab.com ; conditionne l'option OAuth.
7. **Contraintes des groupes SAML sur les PAT** — énoncées de mémoire, confiance
   moyenne ; seul cas identifié pouvant rendre la réponse « non ».
8. **Comportement d'une instance auto-hébergée**, des deux forges.
9. **Validation TLS vers une CA interne** depuis le sidecar Node *et* depuis
   `git`.
10. **Coût de la récupération des refs sur un gros dépôt** — mesuré seulement
    sur 120 PR / 3 Mo.
11. **Bitbucket, Gitea, Forgejo** — hors périmètre demandé.

## 6. Questions dont la réponse change les conclusions

Je n'ai pas les éléments pour les trancher moi-même :

**Répondu le 2026-10-08** : les quatre combinaisons sont au périmètre, GitHub
sous SAML inclus, GitLab auto-hébergé inclus, stratégies de merge mélangées.
Ces réponses sont intégrées ci-dessus et ne sont plus ouvertes.

**Encore ouvert :**

1. **La politique de l'organisation autorise-t-elle la création d'un token à
   portée lecture ?** Réponse en attente. C'est la question la plus
   conditionnante : si les PAT sont interdits, la faisabilité du cas privé
   repose entièrement sur des chemins non vérifiés (PKCE sans secret, token de
   projet ou de groupe, application OAuth créée par l'utilisateur — section 4.3).
2. **Usage personnel, ou plusieurs utilisateurs ?** Avec plusieurs utilisateurs,
   chacun doit fournir son propre credential : la contrainte n'est plus
   technique mais d'adoption, et elle n'a pas la même réponse selon qu'on équipe
   une personne ou une équipe.
3. **La fonctionnalité doit-elle marcher sans aucune configuration ?** Si oui,
   le cas « dépôt privé » est hors d'atteinte, par construction et non par
   limitation d'implémentation.

## Annexe — commandes qui lèveraient les points non vérifiés

À exécuter sur l'instance concernée. **Coller les sorties, jamais le token** :
un token collé dans une conversation est un token à révoquer.

**Lève le point 6** — OAuth sans secret est-il jouable ?

```bash
curl -s https://<instance>/.well-known/openid-configuration \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d["token_endpoint_auth_methods_supported"], d["grant_types_supported"], d["code_challenge_methods_supported"])'
```

**Lève le point 5** — ce qu'un token `read_api` débloque réellement :

```bash
read -rs GL_TOKEN                      # saisie masquée
PROJ="saajuck%2Ftest-private"
for ep in "projects/$PROJ" "projects/$PROJ/merge_requests" "projects/$PROJ/labels"; do
  printf "%s  %s\n" "$(curl -s -o /dev/null -w '%{http_code}' -H "PRIVATE-TOKEN: $GL_TOKEN" "https://gitlab.com/api/v4/$ep")" "$ep"
done
curl -s -D - -o /dev/null -H "PRIVATE-TOKEN: $GL_TOKEN" "https://gitlab.com/api/v4/projects/$PROJ" | grep -i '^ratelimit'
unset GL_TOKEN
```

**Lève le point 7** — les PAT sont-ils autorisés ? Pas une commande : essayer
d'en créer un à portée `read_api` dans les réglages utilisateur. Un refus ou une
expiration imposée, c'est la politique du groupe SAML qui parle.

**Mesure le taux d'ancres manquantes sur un dépôt donné** (nécessaire puisque
les stratégies de merge sont mélangées, section 3) :

```bash
cd <un-clone-du-depot>
gh api "repos/<owner>/<repo>/pulls?state=closed&per_page=100" \
  | python3 -c 'import sys,json; [print(p["head"]["sha"]) for p in json.load(sys.stdin) if p["merged_at"]]' \
  | while read -r sha; do git cat-file -e "$sha^{commit}" 2>/dev/null && echo present || echo absent; done \
  | sort | uniq -c
```

**Lève le point 10** — coût réel sur un dépôt interne :

```bash
cd <un-clone-du-depot-interne>
du -sk .git
git fetch origin "+refs/merge-requests/*/head:refs/remotes/origin/mr/*" && git gc --prune=now
du -sk .git
```
