# Journal des changements

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versions selon
[SemVer](https://semver.org/lang/fr/).

## [Non publié]

### Corrigé (graphismes)

- Personnages assis : les hanches sont maintenant contre le dossier. Vus de dos, ils semblaient
  assis à côté ou devant le siège (bancs, fauteuils, canapés, chaises, transats).
- Casque audio vu de dos : l’écouteur caché derrière la tête n’est plus dessiné (on avait
  l’impression de le voir à travers le crâne).
- Moteur de dessin : seules les pièces qui se recouvrent à l’écran sont ordonnées entre elles
  (moins d’erreurs d’ordre d’affichage).

### Ajouté (modération)

- Liste des **joueurs connectés** (bouton « N Malinos ») : **masquer** un joueur (avatar, messages,
  bulles et émotes cachés pour soi), **signaler** un joueur (compte nécessaire : motif,
  précisions, derniers messages joints).
- Base : tables `reports` et `moderators`, `is_moderator()`, limite de 10 signalements par jour.
- Page **🛡️ Modération** (Réglages, modérateurs seulement) : signalements à traiter / traités.
- Page de confidentialité complétée (contenu d’un signalement).

### Corrigé (affichage)

- Réglages : les cases à cocher étaient écrasées (conflit avec le style des cases d’objectifs).
- Téléphone : le bouton ⚙️ était caché sous la liste d’objectifs ; barre du haut sur deux lignes,
  objectifs repliés au départ sur petit écran.

### Ajouté (confidentialité)

- Page « Politique de confidentialité » (`/confidentialite.html`), liée depuis l’écran d’accueil et
  le panneau de bienvenue ; nécessaire pour publier la connexion Google.

### Corrigé (multijoueur en ligne)

- Revenir sur l’onglet du jeu après l’avoir quitté : les autres joueurs ne nous voyaient plus, et
  le jeu pouvait passer en « solo » (« déjà connecté dans un autre onglet »). Un joueur silencieux
  reste maintenant visible, et une reconnexion du même onglet remplace l’ancienne connexion.

### Ajouté (comptes joueurs)

- Comptes **facultatifs** avec GitHub ou Google (Supabase) : personnage retrouvé sur tous les
  appareils, pseudo réservé, marque **✓** garantie par le serveur temps réel, déconnexion et
  suppression du compte (Réglages → Compte).
- Base : table `profiles` avec règles d’accès (RLS), `delete_my_account`, `my_profile` ;
  migrations dans `supabase/migrations/`, testées avec PGlite.
- Serveur temps réel : vérification du jeton auprès de la base, identifiant et pseudo du compte
  imposés, identifiants de compte interdits aux visiteurs.
- Workflow quotidien pour garder la base gratuite active ; guide `docs/COMPTES.md`.

### Modifié

- Le robot d’accueil s’appelle désormais **Joshua** (anciennement Malo).
- Badge de version : « v0.2 · prototype ».

### Mis en ligne

- **Le jeu est en ligne** le 19/10/2026 : https://malinosland.pages.dev (Cloudflare Pages) avec le serveur temps réel
  (Cloudflare Worker), en offre gratuite.

### Corrigé (textes)

- Les textes « aucune donnée envoyée » étaient faux en ligne : ils indiquent maintenant ce qui est
  transmis (pseudo, apparence, position, messages, non conservés) selon le mode du jeu.
- Feuille de route du jeu : v0.1 terminée, v0.2 en cours.

### Ajouté (mise en ligne)

- Workflow GitHub « Mise en ligne » (lancé à la main) : vérifie le projet, publie le serveur temps
  réel (Cloudflare Worker) et le jeu (Cloudflare Pages), puis vérifie que tout répond.
- Guide `docs/MISE_EN_LIGNE.md` : sous-domaine `workers.dev`, jeton d’API, secrets GitHub, bouton
  de mise en ligne, dépannage, mise hors ligne.
- CI : préparation à blanc du serveur (`wrangler deploy --dry-run`), sans compte.

### Ajouté (v0.2 — serveur temps réel)

- Serveur temps réel `server/` (Cloudflare Worker + Durable Object, hibernation des WebSockets) :
  présence, déplacements, chat de proximité et général, émotes, changements d’apparence.
- Protections côté serveur : validation de chaque message, identifiant non usurpable,
  anti-téléportation, positions hors carte refusées, limites de débit, 40 joueurs par salle,
  identifiant en double refusé, origines autorisées, budget quotidien de messages (ralentissement
  puis maintenance avant la limite gratuite).
- Côté jeu : `ServerTransport` (reconnexion automatique, refus respectés), messages du serveur
  `rate` et `notice`, badge « En ligne », messages clairs (salle pleine, maintenance…).
- Activation par `VITE_REALTIME_URL` (`.env.example`) ; CSP générée au build en conséquence.
- Tests : règles du serveur (Vitest), intégration avec Wrangler, test « deux joueurs en ligne » ;
  deux nouveaux jobs dans la CI.
- Commandes `server:install`, `server:dev`, `test:online`.

### Ajouté (reprise du projet)

- `AGENTS.md` : consignes communes à toutes les IA (Codex, Cursor, Copilot, Gemini, Claude Code…) ;
  `CLAUDE.md` et `GEMINI.md` l’importent, `.github/copilot-instructions.md` y renvoie.
- Guide `docs/REPRENDRE_LE_PROJET.md` : reprendre le projet sur Windows, macOS ou Linux, avec
  n’importe quel outil, en local ou dans le cloud.
- Démarrage automatique des sessions cloud de Claude Code (`.claude/hooks/session-start.sh`).
- `.gitattributes` : fins de ligne identiques sur tous les systèmes.

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
