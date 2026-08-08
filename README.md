# minigit2

Client Git graphique local et minimaliste, façon "GitKraken en plus simple" :
un graphe de commits/branches, un clic pour voir le diff, un double-clic pour
faire un checkout.

Voir [docs/PLAN.md](docs/PLAN.md) pour l'architecture, le scope de la V1 et
l'ordre de build.

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
