# MalinosLand

**Le monde virtuel gratuit, open source et communautaire des Malinos.**

MalinosLand est un univers isométrique accessible depuis un simple navigateur, construit
progressivement par et pour les Malinos, une communauté de passionnés d’intelligence artificielle.
Pas d’abonnement, pas de monnaie à acheter : du partage, de la convivialité et un monde qui
grandit avec ses habitants.

> **État actuel : version 0.1 (prototype jouable, local).** Le jeu fonctionne entièrement dans le
> navigateur, sans serveur ni compte. Le multijoueur en ligne arrive en v0.2
> (voir [la feuille de route](docs/ROADMAP.md)).

## Démarrer en local

Prérequis : [Node.js](https://nodejs.org) 20 ou plus récent (22 recommandé) et Git.

```bash
git clone https://github.com/Rogue06/MalinosLand.git
cd MalinosLand
npm install
npm run dev
```

Ouvre ensuite **http://localhost:5173** dans ton navigateur, crée ton personnage et entre dans le Hub.

| Commande           | Rôle                                                              |
| ------------------ | ----------------------------------------------------------------- |
| `npm run dev`      | Serveur de développement avec rechargement automatique            |
| `npm run build`    | Vérification des types + build de production dans `dist/`         |
| `npm run preview`  | Sert le build de production sur http://localhost:4173             |
| `npm test`         | Tests unitaires (Vitest)                                          |
| `npm run lint`     | Analyse statique (ESLint)                                         |
| `npm run check`    | Types + lint + tests + build : à lancer avant chaque pull request |
| `npm run test:e2e` | Test de bout en bout dans Chromium (nécessite `npm run preview`)  |

Outil pour les graphistes : avec `npm run dev`, la page **http://localhost:5173/art-preview.html**
affiche tous les objets, murs, sols et avatars générés.

## Ce que contient la v0.1

- Le **Hub** en vue isométrique : hall d’accueil, espace coworking, salle de conférence, salon
  détente, galerie (bientôt), jardin, terrasse et chantier de la future tour communautaire.
- Un **avatar personnalisable** (silhouette, peau, coiffure, couleurs, accessoires).
- Déplacement **au clic** (recherche de chemin) ou au **clavier** (ZQSD, WASD, flèches), collisions.
- **Interactions** : robot d’accueil Malo, panneaux, ascenseur, café, miroir, borne d’arcade,
  sièges, canapés et bancs où s’asseoir.
- **Objectifs « Premiers pas »** pour découvrir le Hub, **chat** avec bulles et **émotes**.
- **Démo multijoueur locale** : ouvre le jeu dans plusieurs onglets du même navigateur pour voir
  les avatars se croiser (aucune donnée ne quitte l’ordinateur).
- Réglages de **qualité graphique**, limite d’images par seconde, réduction des animations.

## Documentation

| Document                                               | Contenu                                        |
| ------------------------------------------------------ | ---------------------------------------------- |
| [Vision du projet](docs/PROJECT_VISION.md)             | Pourquoi MalinosLand, pour qui, principes      |
| [Architecture](docs/ARCHITECTURE.md)                   | Choix techniques, modules, flux de données     |
| [Feuille de route](docs/ROADMAP.md)                    | Versions 0.1 → 1.0                             |
| [Contribuer](docs/CONTRIBUTING.md)                     | Rejoindre le développement                     |
| [Infrastructure gratuite](docs/FREE_INFRASTRUCTURE.md) | Fournisseurs, quotas, garde-fous anti-facture  |
| [Sécurité](docs/SECURITY.md)                           | Protection des joueurs, signalement de failles |
| [Reprise de session](docs/SESSION_HANDOFF.md)          | Où en est le travail, quoi faire ensuite       |

Toute la documentation est dans [`docs/`](docs/).

## Contribuer

Toutes les contributions passent par une branche dédiée et une pull request relue avant fusion :
la branche `main` est protégée. Lis le [guide de contribution](docs/CONTRIBUTING.md) pour commencer.

## Licence

Code sous licence [MIT](LICENSE). Les graphismes sont générés par le code et suivent la même licence.
