# Mondes de jeu (dépôt privé)

> **En bref.** Les « mondes de jeu » reliés à MalinosLand — d’abord le **Chantier des mondes**
> (monde en cubes, `/chantier/`), puis d’autres mini-jeux — sont développés dans un dépôt GitHub
> **privé**, `Rogue06/MalinosLand-mondes` (DEC-050). Le Hub (MalinosLand en 2D isométrique)
> reste ici, open source. À la mise en ligne, le site va chercher les mondes dans le dépôt privé,
> comme il le fait pour la page d’accueil.

## Ce qui est où

| Ici (public, `MalinosLand`)                                     | Dépôt privé (`MalinosLand-mondes`)                             |
| --------------------------------------------------------------- | -------------------------------------------------------------- |
| Le Hub, le serveur temps réel (`server/`), les comptes, le site | Le jeu de chaque monde (`src/sandbox/`, `chantier/`)           |
| L’adresse `/chantier` du serveur, sa configuration              | Le serveur de chaque monde (`server/src/mondes/`)              |
| Les outils de test (bout en bout, en ligne, intégration)        | Les tests de chaque monde (`tests/mondes/`, `scripts/mondes/`) |
| Ce document                                                     | La documentation des mondes (`docs/`)                          |

Les fichiers des mondes sont **copiés** dans ce projet aux mêmes chemins, où Git les ignore
(`.gitignore`) : ils ne peuvent pas partir par erreur dans le dépôt public.

## Travailler sur un monde

```bash
git clone https://github.com/Rogue06/MalinosLand-mondes.git ../MalinosLand-mondes
npm run mondes                 # copie le dépôt privé ici (ignoré par Git)
npm run dev                    # http://localhost:5173/chantier/
npm run check                  # les tests des mondes passent avec ceux du Hub
npm run mondes -- --rendre     # renvoie les fichiers modifiés ici vers le dépôt privé
```

Puis on commite **dans le dépôt privé** (`cd ../MalinosLand-mondes && git status`). Sans le
dépôt privé, tout le reste fonctionne : pas de page `/chantier/`, et le serveur garde une
version « en attente » de chaque monde (créée par `npm install`).

## Mise en ligne

Le workflow « Mise en ligne » récupère le dépôt privé avec le secret `MONDES_TOKEN` (clé en
lecture seule, voir [REPRENDRE_LE_PROJET.md](REPRENDRE_LE_PROJET.md)), l’installe, puis
construit et met en ligne le site et le serveur. Sans ce secret, il s’arrête (pour ne jamais
mettre en ligne un serveur sans ses mondes).
