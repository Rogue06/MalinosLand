# Stratégie de tests

> **En bref (version simple)** : des tests automatiques vérifient à chaque modification que le jeu marche toujours (déplacements, collisions, salles accessibles, réseau…). Un test complet joue aussi au jeu dans un vrai navigateur. Il reste à mesurer la fluidité sur de vrais ordinateurs : toute aide est bienvenue !

## Commandes

| Commande                           | Contenu                                                                     |
| ---------------------------------- | --------------------------------------------------------------------------- |
| `npm test`                         | Tests unitaires Vitest (`tests/*.test.ts`), sans navigateur                 |
| `npm run typecheck`                | Vérification TypeScript stricte                                             |
| `npm run lint`                     | ESLint (dont règles de sécurité et de dépendances entre modules)            |
| `npm run format:check`             | Style Prettier                                                              |
| `npm run build`                    | Types + build de production                                                 |
| `npm run check`                    | Tout ce qui précède (hors format) — à lancer avant chaque PR                |
| `npm run test:e2e [url] [dossier]` | Test de bout en bout dans Chromium sur le build servi par `npm run preview` |
| `npm run docs:screenshots [url]`   | Régénère les captures de `docs/images/` (avec `npm run preview` lancé)      |

Le test de bout en bout utilise `playwright-core` (sans téléchargement de navigateur) : il cherche
Chromium dans `/opt/pw-browsers/chromium` ou dans la variable `CHROMIUM_PATH`
(ex. `CHROMIUM_PATH=/usr/bin/google-chrome`).

## Couverture actuelle (v0.1)

| Fichier                  | Ce qui est vérifié                                                                                                                                                                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/core.test.ts`     | Projection iso aller-retour, directions clavier, rotations, collisions (glissement, pas de traversée, bords), A* (chemin valide, sans coin coupé, cible inaccessible), lissage, limiteur de débit, nettoyage des textes et pseudos, profondeur des avatars près d’un meuble long |
| `tests/world.test.ts`    | Validation de chaque carte, **accessibilité de toutes les zones ouvertes**, **chaque objet interactif atteignable**, détection des erreurs de carte, assises après rotation, zones, occupation des sièges                                                                        |
| `tests/player.test.ts`   | Trajet A* jusqu’au coworking, aller parler à Malo, s’asseoir puis se lever, impossibilité de traverser un mur au clavier                                                                                                                                                         |
| `tests/network.test.ts`  | Protocole (rejet des messages hostiles, nettoyage), découverte entre clients, débit limité, silence à l’arrêt, dégradation selon le budget, anti-spam, filtrage par salle, départ et pairs fantômes                                                                              |
| `tests/services.test.ts` | Stockage versionné robuste, validation du profil et des réglages, bornes des apparences, cohérence contenu ↔ dessins ↔ objectifs, rangement de l’atlas sans chevauchement                                                                                                        |
| `scripts/smoke-test.mjs` | Création du personnage, entrée dans le monde, clavier, chat, dialogue avec Malo, panneau, ascenseur, café, s’asseoir, terrasse, **démo multi-onglets**, aucune erreur JS ni violation CSP                                                                                        |

## Objectifs de performance

| Objectif                                         | Cible         | Statut                          |
| ------------------------------------------------ | ------------- | ------------------------------- |
| JS avant création du personnage                  | ≤ 40 Ko gzip  | ✅ ≈ 25 Ko                      |
| JS total                                         | ≤ 450 Ko gzip | ✅ ≈ 400 Ko                     |
| Images à télécharger                             | 0             | ✅                              |
| 60 i/s en qualité normale sur GPU intégré récent | à mesurer     | ⬜ non mesuré sur matériel réel |
| ≥ 30 i/s en qualité basse sur machine de ~8 ans  | à mesurer     | ⬜ non mesuré sur matériel réel |

### Mesures réalisées (et leurs limites)

Les seules mesures disponibles ont été faites dans l’environnement de développement, avec Chromium
**en rendu logiciel** (SwiftShader, sans GPU, 4 cœurs virtuels, 1366 × 800) — conditions très
défavorables et **non représentatives** d’un vrai ordinateur :

| Situation                                    | Images/s mesurées     |
| -------------------------------------------- | --------------------- |
| Scène vide (référence de l’environnement)    | ≈ 18                  |
| Hub, qualité normale (avant optimisation)    | ≈ 5                   |
| Hub, qualité normale (atlas + sols en blocs) | ≈ 6,5                 |
| Hub, qualité basse                           | ≈ 27 (moyenne lissée) |

**À faire :** mesurer sur 2–3 machines réelles (portable récent à GPU intégré, ordinateur de
~8 ans, Chromebook ou équivalent) avec « Afficher les performances » activé dans les réglages, et
consigner les résultats ici. Aucun nombre d’images par seconde n’est garanti avant ces mesures.

### Protocole de mesure manuel

1. `npm run build && npm run preview`, ouvrir http://localhost:4173.
2. Réglages → cocher « Afficher les performances », choisir la qualité, limite « Illimité ».
3. Se placer dans le hall, attendre 10 s, relever les i/s ; traverser le jardin, relever à nouveau.

## Tests prévus pour les versions suivantes

- v0.2 : autorisations (RLS) avec une base locale, Durable Object avec Wrangler, charge simulée
  (N clients Node), reconnexion.
- v0.3 : éditeur de décoration (sérialisation des dispositions, droits du propriétaire).
