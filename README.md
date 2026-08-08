# minigit2

Client Git graphique local : visualiser un historique et naviguer dedans,
sans l'éditer.

## Fonctionnalités

- **Multi-repo** : ajoute un repo par chemin absolu ou via un navigateur de
  dossiers intégré, bascule entre les repos ajoutés.
- **Graphe de commits** : branches locales, tags et branches distantes
  (`origin/*`), avec badges de refs (dont HEAD, y compris en détaché). Liste
  virtualisée : ne monte que les lignes visibles, tient sur de gros
  historiques.
- **Diff par commit** : clique un commit pour voir la liste de ses fichiers
  modifiés ; chaque fichier se déplie et charge son patch à la demande.
  Panneau redimensionnable (glisser la bordure).
- **Checkout** : double-clique un commit pour un checkout détaché, ou un
  badge de branche pour checkout cette branche. Confirmation si le working
  tree a des modifications non commitées ; le refus natif de `git` reste le
  filet de sécurité final (pas de force/discard).
- **Statut** : barre affichant branche courante / HEAD détaché / working
  tree dirty, bouton de rafraîchissement manuel.

> Cette liste est mise à jour au fil des fonctionnalités importantes, pas
> des détails d'implémentation — voir l'historique Git pour le détail.

Architecture et décisions techniques : [docs/PLAN.md](docs/PLAN.md).

## Développement

```bash
npm install
npm run dev
```

## Build / lancement

```bash
npm run build
npm start
```

Le serveur écoute uniquement sur `127.0.0.1` — pas d'authentification, à ne
jamais exposer sur le réseau.
