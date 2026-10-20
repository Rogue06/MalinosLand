# Stratégie de tests

> **En bref (version simple)** : des tests automatiques vérifient à chaque modification que le jeu marche toujours (déplacements, collisions, salles accessibles, réseau…). Un test complet joue aussi au jeu dans un vrai navigateur. Il reste à mesurer la fluidité sur de vrais ordinateurs : toute aide est bienvenue !

## Commandes

| Commande                                   | Contenu                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| `npm test`                                 | Tests unitaires Vitest (`tests/*.test.ts`), sans navigateur                  |
| `npm run typecheck`                        | Vérification TypeScript stricte                                              |
| `npm run lint`                             | ESLint (dont règles de sécurité et de dépendances entre modules)             |
| `npm run format:check`                     | Style Prettier                                                               |
| `npm run build`                            | Types + build de production                                                  |
| `npm run check`                            | Tout ce qui précède (hors format) — à lancer avant chaque PR                 |
| `npm run test:e2e [url] [dossier]`         | Test de bout en bout dans Chromium sur le build servi par `npm run preview`  |
| `npm run docs:screenshots [url]`           | Régénère les captures de `docs/images/` (avec `npm run preview` lancé)       |
| `npm --prefix server run test:integration` | Serveur temps réel lancé avec Wrangler, testé par de vrais clients WebSocket |
| `npm run test:online [url]`                | Deux joueurs (deux navigateurs séparés) connectés au serveur local           |

Le test de bout en bout utilise `playwright-core` (sans téléchargement de navigateur) : il cherche
Chromium dans `/opt/pw-browsers/chromium` ou dans la variable `CHROMIUM_PATH`
(ex. `CHROMIUM_PATH=/usr/bin/google-chrome`).

### Le test de bout en bout dans la CI

- Il tourne sur chaque pull request (job « Test de bout en bout (Chrome) ») et il est **bloquant**.
- Chaque étape réussie et chaque erreur sont écrites en **annotations** GitHub (visibles sur la PR)
  et dans le résumé du job. En cas d’échec, l’état du jeu et de la page est aussi affiché.
- Les serveurs de GitHub n’ont pas de carte graphique (≈ 3 à 6 images/s) : le test tourne en
  **qualité basse**, remplace les longs trajets par une téléportation (les trajets sont vérifiés
  par les tests unitaires) et sonde les conditions depuis Node. `E2E_QUALITY=normal` pour tester
  en qualité normale.
- Cette lenteur a révélé un vrai bug : une touche pressée juste à l’ouverture d’une fenêtre était
  perdue. Le test appuie volontairement vite pour l’empêcher de revenir.
- Pour reproduire une machine lente en local : `E2E_CPU_THROTTLE=4 npm run test:e2e`.

### Les tests du serveur temps réel dans la CI

- Job « Serveur temps réel (Wrangler) » : vérification des types du serveur puis
  `test:integration` (15 vérifications, dont la file d’attente, dont la vérification d’un compte auprès d’une fausse base : santé, refus d’une origine inconnue, présentation,
  mouvements, chat, anti-usurpation, salle pleine, identifiant en double, départ…).
- Job « Deux joueurs en ligne » : lance le serveur, construit le jeu avec
  `VITE_REALTIME_URL=ws://localhost:8787/ws`, puis `npm run test:online` vérifie qu’Alice et Bob
  se voient, se déplacent, discutent, et que le départ de l’un est vu par l’autre.

## Couverture actuelle

| Fichier                        | Ce qui est vérifié                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/core.test.ts`           | Projection iso aller-retour, directions clavier, rotations, collisions (glissement, pas de traversée, bords), A* (chemin valide, sans coin coupé, cible inaccessible), lissage, limiteur de débit, nettoyage des textes et pseudos, profondeur des avatars près d’un meuble long                                                                         |
| `tests/world.test.ts`          | Validation de chaque carte, **accessibilité de toutes les zones ouvertes**, **chaque objet interactif atteignable**, détection des erreurs de carte, assises après rotation, zones, occupation des sièges                                                                                                                                                |
| `tests/player.test.ts`         | Trajet A* jusqu’au coworking, aller parler à Joshua, s’asseoir puis se lever, impossibilité de traverser un mur au clavier                                                                                                                                                                                                                               |
| `tests/network.test.ts`        | Protocole (rejet des messages hostiles, nettoyage), découverte entre clients, débit limité, silence à l’arrêt, dégradation selon le budget, anti-spam, filtrage par salle, départ et pairs fantômes, transport serveur (reconnexion, refus, adresse), ordres `rate` / `notice` du serveur                                                                |
| `tests/realtime-hub.test.ts`   | Règles du serveur : présentation sans écho, relais par salle, téléportation et identifiant usurpé ignorés, positions hors carte, chat local/général, anti-spam, file d’attente (attente invisible, entrée automatique, file pleine), identifiant en double, inondation, budget du jour (ralentir puis maintenance), départ, messages réservés au serveur |
| `tests/database.test.ts`       | Règles de la base (PGlite) : chacun crée/modifie son seul profil, visiteur sans écriture, lecture publique, colonnes protégées, pseudo unique et bien formé, taille de l’apparence, suppression de compte en cascade, `my_profile`                                                                                                                       |
| `tests/server-account.test.ts` | Vérification des comptes par le serveur : jeton lu dans les sous-protocoles, appel à `my_profile`, visiteur si jeton refusé ou base injoignable, en-tête interne                                                                                                                                                                                         |
| `tests/moderation.test.ts`     | Masquer / afficher, validation de la liste enregistrée, contenu d’un signalement (messages joints, nettoyage, compte vérifié)                                                                                                                                                                                                                            |
| `tests/account.test.ts`        | Réconciliation des profils à la connexion, identifiant réseau d’un compte, adresse Supabase, CSP                                                                                                                                                                                                                                                         |
| `tests/sound.test.ts`          | Mentions @pseudo (limites de mots, majuscules), anti-spam sonore : intervalle entre deux sons, joueur qui inonde le chat rendu muet 1 minute, mentions espacées par joueur                                                                                                                                                                               |
| `tests/services.test.ts`       | Stockage versionné robuste, validation du profil et des réglages, bornes des apparences, cohérence contenu ↔ dessins ↔ objectifs, rangement de l’atlas sans chevauchement                                                                                                                                                                                |
| `scripts/smoke-test.mjs`       | Création du personnage, entrée dans le monde, clavier, chat, dialogue avec Joshua, panneau, ascenseur, café, s’asseoir, terrasse, **démo multi-onglets**, **logement** (studio puis retour devant l’ascenseur), **téléphone** (chat replié, bouton d’action au doigt, zoom à deux doigts), aucune erreur JS ni violation CSP                             |
| `scripts/online-test.mjs`      | Deux navigateurs séparés connectés au serveur : badge « En ligne », chacun voit l’autre, déplacement, chat, masquer un joueur, signalement refusé sans compte, mention @pseudo surlignée, statut « absent » (onglet caché 20 s) puis retour, départ                                                                                                      |

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

- v0.2 : autorisations (RLS) avec une base locale, charge simulée (N clients Node). (Durable
  Object avec Wrangler et reconnexion : faits.)
- v0.3 : éditeur de décoration (sérialisation des dispositions, droits du propriétaire).
