# Journal des changements

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versions selon
[SemVer](https://semver.org/lang/fr/).

## [Non publié]

### Corrigé

- Une fenêtre ou un dialogue ignorait la touche Échap / E pressée dans l’instant qui suit son
  ouverture (l’écouteur clavier n’était installé qu’à l’image suivante, ce qui se voyait sur les
  machines lentes). Les écouteurs sont maintenant actifs dès l’affichage.
- Le test de bout en bout passe désormais de façon fiable sur GitHub Actions et devient
  **bloquant** (l’échec venait du bug ci-dessus, révélé par la lenteur des serveurs de CI).

### Amélioré

- Qualité graphique « basse » : les panneaux de l’interface n’utilisent plus de flou
  d’arrière-plan (fond opaque à la place). Sans carte graphique, ce flou faisait perdre environ
  35 % d’images par seconde dès qu’une fenêtre était ouverte.
- Test de bout en bout plus robuste : attentes sondées depuis Node, longs trajets remplacés par une
  téléportation, qualité basse, détection automatique de Chrome.

### Ajouté

- Annotations GitHub et résumé du job pour chaque étape et erreur du test de bout en bout ;
  diagnostic de l’état du jeu et de la page en cas d’échec (`window.__malinosDebug.state()`).
- Mode `E2E_CPU_THROTTLE` pour simuler une machine lente en local.
- Actions GitHub mises à jour (fin de l’avertissement Node.js 20).

## [0.1.0] — non publiée (branche `feature/initial-prototype`)

### Ajouté

- Projet Vite + TypeScript strict + Phaser 4.2 + Preact ; ESLint, Prettier, Vitest, CI GitHub Actions.
- Moteur de dessin isométrique procédural (`IsoBuilder`) : boîtes ombrées, cylindres, polygones,
  décors et textes plaqués en perspective, tri de profondeur topologique.
- ≈ 40 objets originaux (bureaux, sièges, canapés, bibliothèques, robot, ascenseur, borne d’arcade,
  arbres, fontaine, chantier…), murs auto-raccordés (enduit, brique, cloisons), 9 sols, décors muraux.
- Avatars « voxel » : 4 orientations, marche, position assise ; 3 silhouettes, 8 coiffures,
  palettes de couleurs, accessoires, 6 styles prêts à porter.
- Carte du Hub (34 × 30) : hall, coworking, conférence, salon, galerie (bientôt), jardin, terrasse,
  chantier de la tour (bientôt). Format JSON v1 validé.
- Déplacement au clic (A* lissé) et au clavier (ZQSD/WASD/flèches), collisions glissantes, caméra
  qui suit, zoom à la molette.
- Interactions : dialogues (Malo…), panneaux (bienvenue, feuille de route, ascenseur, astuce IA,
  événements, miroir), émotes (café, fontaine), assises multiples.
- Objectifs « Premiers pas », chat proximité/général avec bulles et anti-spam, émotes.
- Démo multijoueur locale entre onglets (BroadcastChannel) via une couche `Transport` remplaçable ;
  protocole v1 validé, débit limité et adaptatif, filtrage par salle.
- Réglages : qualité (basse/normale/haute, écrans haute densité), limite d’i/s, animations réduites,
  noms, statistiques, démo multi-onglets.
- Optimisations : Phaser chargé après l’écran d’accueil, atlas de textures, sols par blocs 8×8.
- Sécurité : CSP en production, `public/_headers`, nettoyage des textes, interdiction de
  `innerHTML`/`eval` par ESLint.
- Documentation complète (`CLAUDE.md`, `docs/`), modèles d’issues et de PR, CODEOWNERS.
- Page d’outil `art-preview.html` pour visualiser tous les graphismes.
