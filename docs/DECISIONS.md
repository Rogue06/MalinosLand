# Journal des décisions d’architecture

> **En bref (version simple)** : ce journal explique **pourquoi** chaque grand choix a été fait (moteur, graphismes, hébergement, licence…), pour que tout le monde comprenne et puisse en discuter.

Format : contexte → décision → conséquences. Une décision peut être remplacée par une nouvelle
entrée (ne pas réécrire l’historique). **Les décisions marquées « à valider » attendent l’accord du
responsable du projet.**

---

## DEC-001 — Phaser 4 + TypeScript + Vite (18/10/2026)

**Contexte.** Jeu isométrique 2D/2,5D dans le navigateur, machines modestes, contributeurs de
niveaux variés, développement assisté par IA.
**Décision.** Phaser 4.2 (dernière version stable sur npm), TypeScript strict, Vite.
**Alternatives.** PixiJS (plus léger, mais caméra/entrées/scènes à écrire), Godot web (export de
plusieurs dizaines de Mo), Rust/WASM (aucun goulot CPU mesuré), Three.js (3D inutile).
**Conséquences.** ~357 Ko gzip pour Phaser, isolé dans un fichier mis en cache et chargé après
l’écran d’accueil. Toute la logique de jeu reste hors de Phaser (`core/`, `world/`) : un changement
de moteur ne toucherait que `src/game/`.

## DEC-002 — Graphismes procéduraux « voxel » (18/10/2026)

**Contexte.** Besoin d’une direction artistique cohérente, originale (pas de copie de DEKODE),
légère, et modifiable par la communauté.
**Décision.** Dessiner objets, murs, sols et avatars par le code (`src/game/art/`) avec un petit
moteur de boîtes isométriques (`IsoBuilder`), puis les regrouper en atlas.
**Conséquences.** 0 image à télécharger, variantes de couleurs gratuites, contributions en TypeScript
relues comme du code. Limite : les détails fins (visages expressifs, textures riches) sont plus
difficiles ; l’interface `TextureInfo` permettra d’ajouter des sprites PNG plus tard.

## DEC-003 — Preact pour l’interface (18/10/2026)

**Décision.** Preact (API React, ~6 Ko) pour le HUD et les panneaux ; pas de React complet.
**Conséquences.** Le responsable connaît React : même façon d’écrire les composants. Le jeu
(Phaser) et l’interface communiquent uniquement via `src/state.ts`.

## DEC-004 — Logique pure séparée et testée (18/10/2026)

**Décision.** `src/core/` et `src/world/` n’importent ni Phaser, ni Preact, ni le DOM (règle ESLint).
Collisions, A*, profondeur, validation des cartes, contrôle du joueur et protocole réseau sont
testés avec Vitest sans navigateur.

## DEC-005 — Couche de transport réseau remplaçable (18/10/2026)

**Décision.** Interface `Transport` + `NetworkClient` indépendant du transport. v0.1 : `Offline`
et `BroadcastChannel` (démo locale entre onglets, aucune donnée ne quitte l’ordinateur).
**Conséquences.** Le protocole, la limitation de débit, la dégradation selon un budget de messages
et le filtrage par salle sont déjà en place et testés ; v0.2 ajoutera un transport serveur.

## DEC-006 — Infrastructure cible v0.2 : Cloudflare + Supabase (18/10/2026) — **validée le 19/10/2026**

**Contexte.** Contrainte absolue de gratuité ; voir [FREE_INFRASTRUCTURE.md](FREE_INFRASTRUCTURE.md).
**Proposition.** Cloudflare Pages (site statique), Cloudflare Workers + Durable Objects (temps réel,
offre gratuite qui renvoie des erreurs au-delà des quotas au lieu de facturer), Supabase (comptes,
Postgres avec règles RLS) en offre gratuite.
**Points à valider par le responsable.** Création des comptes, aucune carte bancaire enregistrée,
acceptation des limites (mise en pause de Supabase après 7 jours d’inactivité, quotas journaliers).

## DEC-007 — Format de carte JSON versionné et validé (18/10/2026)

**Décision.** Cartes en JSON (`formatVersion: 1`) : légende de tuiles, zones, objets, décors
muraux. Validation stricte au chargement et dans les tests (bornes, chevauchements, ids, zones
accessibles, objets interactifs atteignables).
**Conséquences.** Les contributeurs peuvent modifier une salle sans toucher au moteur ; une carte
cassée est détectée par la CI avant fusion.

## DEC-008 — Atlas de textures et sols par blocs (18/10/2026)

**Contexte.** Profilage : ~1 000 tuiles de sol et ~80 textures distinctes multipliaient les appels
de dessin.
**Décision.** Sols pré-assemblés par blocs de 8×8 tuiles, autres textures regroupées en atlas 2048².
**Conséquences.** +30 % d’images par seconde mesurées en rendu logiciel. Mémoire GPU raisonnable
(sols en résolution ×1,5 en qualité normale).

## DEC-009 — Licence GNU AGPL-3.0 (proposée le 18/10/2026, validée le 21/10/2026)

**Contexte.** Le dépôt contenait une licence MIT proposée, en attente de validation.
**Décision du responsable.** **AGPL-3.0** (`AGPL-3.0-only`) pour le code et les graphismes
générés par le code. MalinosLand est un projet communautaire : les améliorations doivent rester
libres. La GPL classique ne suffit pas pour un jeu en ligne (il n’est jamais « distribué », il est
servi par un serveur) ; l’AGPL oblige aussi les versions **mises en ligne** à publier leur code.
**Conséquences.** Le jeu affiche un lien « Code source (licence AGPL-3.0) » sur l’écran
d’accueil et dans l’aide (article 13 de la licence). Les dépendances (Phaser, Preact, Vite… sous
MIT) sont compatibles. Toute contribution est publiée sous AGPL-3.0. Changement fait avant toute
contribution extérieure, donc sans accord à recueillir.
**Écarté.** MIT : plus simple, mais permet une copie fermée et payante sans rien rendre.

## DEC-010 — Flux Git : `main` protégée (18/10/2026)

**Décision.** Développement uniquement sur des branches (`feature/…`, `fix/…`, `docs/…`),
pull request obligatoire, CI verte, relecture, **fusion uniquement avec l’accord du responsable**.
La v0.1 est développée sur `feature/initial-prototype`.

## DEC-011 — Profil local sans compte en v0.1 (18/10/2026)

**Décision.** Le profil (pseudo + apparence), les réglages et la progression sont stockés dans le
`localStorage`, versionnés et validés à la lecture. Aucune donnée personnelle n’est envoyée.
**Conséquences.** Pas de RGPD à gérer côté serveur en v0.1 ; migration vers les comptes en v0.2.

## DEC-012 — `AGENTS.md`, source unique des consignes pour toutes les IA (19/10/2026)

**Contexte.** Le projet doit pouvoir être repris à tout moment, depuis n’importe quel ordinateur et
avec n’importe quel outil (Claude Code, Codex, Cursor, Copilot…), en local ou dans le cloud.
**Décision.** Les consignes vivent dans `AGENTS.md` (format standard lu par la plupart des outils).
`CLAUDE.md` et `GEMINI.md` l’importent, `.github/copilot-instructions.md` y renvoie. L’état du
travail reste dans `docs/SESSION_HANDOFF.md`, mis à jour à chaque fin de tâche. Un script de
démarrage (`.claude/hooks/session-start.sh`) installe les dépendances dans les sessions cloud de
Claude Code ; `.gitattributes` uniformise les fins de ligne entre Windows, macOS et Linux.
**Conséquences.** Une seule copie des règles à maintenir ; aucune information importante ne dépend
d’une conversation ou d’un ordinateur. Guide humain : `docs/REPRENDRE_LE_PROJET.md`.

## DEC-013 — Serveur temps réel : paquet `server/`, une instance, logique pure (19/10/2026)

**Contexte.** v0.2 : relier les joueurs en direct sur l’hébergement validé (DEC-006), sans compte
nécessaire pour développer et tester.
**Décision.**

- Le serveur est un **paquet npm séparé** (`server/`) : Wrangler (≈ 235 Mo installé) et les types
  Cloudflare ne sont installés que par ceux qui travaillent sur le serveur (`npm run server:install`).
- **Un seul Durable Object** (« monde-1 ») avec l’API d’hibernation des WebSockets : simple, pas de
  coût quand personne ne parle ; filtrage par salle à l’intérieur ; 40 joueurs maximum par salle.
- Les règles vivent dans **`server/src/hub.ts`**, sans dépendance à Cloudflare, et réutilisent le
  protocole du client : une seule définition des messages, testée par Vitest.
- **Budget quotidien** compté par le serveur lui-même (70 % du quota gratuit), indépendant des
  tableaux de bord du fournisseur.
- La **CSP est générée au build** (`vite.config.ts`) : `connect-src` autorise l’adresse définie par
  `VITE_REALTIME_URL`, sans l’ouvrir à toutes les adresses.
  **Conséquences.** Tests possibles en local et dans la CI sans aucun compte. Passage à plusieurs
  instances (une par groupe de salles) si un jour 40 joueurs par salle ou le débit d’une instance
  ne suffisent plus. Pas encore d’authentification : à ajouter avec les comptes Supabase.

## DEC-014 — Mise en ligne par un workflow GitHub lancé à la main (19/10/2026)

**Contexte.** Le site (Cloudflare Pages) et le serveur (Worker) doivent être publiés sans que les
clés ne quittent les comptes en ligne, et seulement quand le responsable le décide.
**Décision.** Workflow `.github/workflows/deploy.yml`, déclenché uniquement à la main
(`workflow_dispatch`). Il lit `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` dans les secrets
GitHub, vérifie le projet (`npm run check`), crée le projet Pages s’il manque, déduit les adresses
(site `*.pages.dev`, serveur `*.workers.dev`) depuis l’API Cloudflare, publie le Worker en
n’autorisant que l’origine du site, construit le jeu avec `VITE_REALTIME_URL` puis publie le site.
Plutôt que l’intégration Git de Cloudflare : tout est décrit dans le dépôt, reproductible, et
indépendant de l’outil ou de l’ordinateur utilisé.
**Conséquences.** Aucune clé dans le dépôt ni dans une conversation. Publication manuelle après
chaque fusion (automatisable plus tard sur `push` vers `main` si le responsable le souhaite).

## DEC-015 — Comptes facultatifs : Supabase, GitHub + Google, vérifiés par la base (19/10/2026)

**Contexte.** v0.2 : retrouver son personnage partout et empêcher l’usurpation de pseudo, sans
coût, sans secret dans le Worker, sans alourdir le jeu pour les visiteurs.
**Décision.**

- Comptes **facultatifs** : les visiteurs jouent comme avant. Connexion **GitHub** et **Google**
  (choix du responsable) ; pas d’e-mail (envoi gratuit réservé à l’équipe du projet Supabase).
- Client : `@supabase/auth-js` + `@supabase/postgrest-js` (plutôt que `supabase-js` complet, qui
  embarque temps réel et stockage inutiles), chargés à la demande (≈ 28 Ko gzip), flux **PKCE**.
- Base : table `profiles` (pseudo unique, apparence), RLS, droits par colonne,
  `delete_my_account()` (RGPD), `my_profile()`. Migrations dans `supabase/migrations/`.
- Serveur temps réel : le jeton voyage dans `Sec-WebSocket-Protocol` (jamais dans l’URL) ; le
  Worker le fait vérifier par la base via `my_profile` (aucun secret ni code de cryptographie) ;
  identifiant réseau = UUID du compte sans tirets ; marque `v` ajoutée par le serveur seulement.
- Tests de la base sans compte avec **PGlite** (PostgreSQL en WebAssembly, dépendance de
  développement uniquement, ≈ 22 Mo installés).
- Workflow quotidien pour éviter la pause des projets gratuits.
  **Conséquences.** Les noms d’utilisateurs vérifiés ne peuvent pas être usurpés ; les visiteurs
  peuvent encore prendre n’importe quel pseudo libre (sans ✓). Le pseudo d’un compte se change en
  base, puis le jeu se reconnecte au serveur. Réglages GitHub / Google à faire dans les tableaux de
  bord (secrets hors du dépôt).

## DEC-016 — Masquer côté joueur, signaler avec un compte, modérer en base (20/10/2026)

**Contexte.** Le jeu est public : il faut pouvoir se protéger d’un joueur gênant et prévenir
l’équipe, sans serveur payant ni outil externe.
**Décision.**

- **Masquer** est purement local (liste dans le navigateur) : immédiat, accessible à tous, sans
  serveur. Pour un visiteur, l’identifiant change à chaque visite : le masquage dure jusqu’à sa
  déconnexion (un compte a un identifiant stable).
- **Signaler** exige un compte (limite l’abus) et passe directement par la base (table `reports`,
  RLS) ; 10 signalements par jour et par joueur (déclencheur). Les 5 derniers messages vus du
  joueur sont joints : le serveur temps réel ne conserve rien, c’est le seul contexte disponible.
- **Modérateurs** : table `moderators` sans aucun accès par l’API, gérée à la main dans le SQL
  Editor ; fonction `is_moderator()` utilisée par les règles. Page de modération dans le jeu.
  **Conséquences.** Aucune donnée de modération n’est lisible par les joueurs. Exclure un joueur du
  serveur temps réel viendra ensuite (le Worker devra lire une liste d’exclusion).

## DEC-017 — Boîte à idées et borne à bugs dans le jeu (20/10/2026)

**Contexte.** Les joueurs doivent pouvoir remonter idées et bugs sans compte GitHub, de façon
ludique, et ces retours doivent arriver aux contributeurs.
**Décision.** Deux objets dans le hall (et un bouton 💡) ouvrent un formulaire. Les messages vont
dans la table `feedback` (ouverte à tous, même aux visiteurs, auteur imposé par la base, limites
anti-abus par déclencheur). Les modérateurs les lisent dans la page de modération et créent en un
clic un ticket GitHub prérempli (relu avant publication) : pas de jeton GitHub ni de secret dans le
jeu ou le serveur.
**Conséquences.** Les contributeurs ne voient que les tickets retenus. Une publication automatique
vers GitHub serait possible plus tard (workflow avec un jeton dédié), si le volume le justifie.

## DEC-018 — Sièges en deux calques pour les personnages assis de dos (20/10/2026)

**Contexte.** Chaque objet était une seule image, placée entièrement devant ou derrière un
personnage. Assis de dos, l’assise et les accoudoirs passaient par-dessus lui : il semblait assis
à côté du siège.
**Décision.** Les pièces d’un siège peuvent être marquées `front` (dossier, accoudoir côté
caméra) dans `src/game/art/objects.ts`. Les sièges sont rendus en deux images de même cadrage :
`base` à la profondeur de l’objet, `front` juste au-dessus (+0,5). Un personnage assis de dos se
place entre les deux (+0,25) ; de face, il reste devant tout le siège (+1).
**Conséquences.** Une texture de plus par siège et orientation (faible). Tout nouveau siège doit
marquer son dossier avec `backrest()` dans son dessin.

## DEC-019 — Sons générés, anti-spam sonore et statut « absent » (20/10/2026)

**Contexte.** Le responsable a validé : un son discret à l’arrivée d’un message (mais pas pour
quelqu’un qui inonde le chat), un son par mention @pseudo, un statut « absent » automatique quand
l’onglet est caché et une ambiance sonore selon le lieu.
**Décision.** Tous les sons sont **générés en code** avec Web Audio (`src/services/audio.ts`) :
aucun fichier audio, aucune dépendance, rien à télécharger. La règle anti-spam est une logique
pure et testée (`src/core/soundGate.ts`). Le statut « absent » passe par un nouveau message du
protocole, `away` (`on: true/false`), et un champ `a` dans `hello` ; le serveur ne relaie qu’un
vrai changement. Le joueur passe « absent » après 20 s d’onglet caché (pas de clignotement pour un
simple coup d’œil ailleurs).
**Conséquences.** Le navigateur n’autorise le son qu’après un premier clic ou une touche : le
jeu « débloque » l’audio à ce moment-là. Les anciens clients ignorent simplement `away`. Réglages
ajoutés : sons, ambiance, volume.

## DEC-020 — Anti-robots de la boîte à idées : Turnstile vérifié par une fonction Edge (21/10/2026)

**Contexte.** La boîte à idées et la borne à bugs sont ouvertes aux visiteurs sans compte, avec une
limite globale de 30 messages par heure : un robot pouvait atteindre cette limite et bloquer les
vrais joueurs. Le responsable a créé un widget Cloudflare Turnstile (gratuit).
**Décision.** Les visiteurs passent par une **fonction Edge Supabase** (`supabase/functions/
feedback`, logique pure dans `handler.ts`, testée) qui vérifie le jeton Turnstile avec la clé
secrète (`TURNSTILE_SECRET_KEY`, secret des fonctions Edge) puis écrit avec la clé serveur ; le
rôle anonyme perd le droit d’écrire dans `feedback`. Les joueurs connectés écrivent directement,
sans vérification (ils sont déjà identifiés par GitHub ou Google). Le script Turnstile n’est
chargé que lorsqu’un visiteur ouvre la boîte ; la CSP n’autorise `challenges.cloudflare.com` que
si une clé publique est configurée. Écarté : la protection CAPTCHA de Supabase Auth (elle ne
protège que les formulaires de connexion, pas une table) et les connexions anonymes Supabase
(un utilisateur créé par visiteur).
**Conséquences.** Aucune nouvelle dépendance (le widget est chargé depuis Cloudflare). La fonction
est mise en ligne à part (pas par le workflow « Mise en ligne »). La migration doit être appliquée
après la mise en ligne du jeu qui utilise la fonction.

## DEC-021 — Logements : un studio par compte, entrée vérifiée par la base (22/10/2026)

**Contexte.** v0.3 « chez soi ». Choix du responsable : on rejoint son logement par l’ascenseur
(« Mon logement »), un studio meublé de base, accès « personne / sur invitation / tout le monde »
vérifié côté serveur. Ce qui s’écrit dans un logement ne doit être lu que par ceux qui y sont.
**Décision.**

- Un logement par compte, salle `home-<identifiant réseau du compte>` ; tous utilisent le même
  gabarit de carte (`src/content/maps/studio.json`) en v0.3. Tables `homes` (mode d’accès) et
  `home_invites` (invitations), migration `20261022090000_homes.sql`, règles RLS.
- **Le droit d’entrer est décidé par la base** : le serveur temps réel appelle
  `can_enter_home(propriétaire)` avec le jeton du joueur (ou sans jeton pour un visiteur), comme
  pour `my_profile` : le serveur n’a toujours **aucun secret**. Le propriétaire entre chez lui sans
  appel à la base. À la reconnexion dans le logement d’un autre, la présentation porte le jeton et
  le droit est revérifié.
- Le serveur refuse les déplacements vers un logement sans autorisation, limite un logement à
  12 personnes, n’autorise la sortie que devant l’ascenseur du Hub, et laisse le propriétaire
  **mettre à la porte** un joueur présent (message `evict`). Retirer une invitation ou fermer son
  logement : le jeu du propriétaire fait sortir les personnes qui n’y ont plus droit.
- **Discussion privée** : dans un logement, tout message (même « général ») n’est relayé qu’aux
  personnes présentes. Le chat général du Hub, lui, y arrive toujours.
  **Conséquences.** Une requête à la base par demande d’entrée d’un invité ou d’un visiteur
  (limitée comme le chat). Le jeton de connexion transite dans les messages `enter` / `hello` sur
  la WebSocket chiffrée, n’est jamais relayé ni enregistré. L’éditeur de décoration (disposition
  enregistrée) viendra dans un lot suivant.

## DEC-022 — Historique des connexions, visible par le responsable seulement (22/10/2026)

**Contexte.** Le responsable veut savoir si des Malinos se connectent depuis l’ouverture.
Jusqu’ici rien n’était conservé : impossible de le savoir pour les visiteurs.
**Décision.** Le serveur temps réel note **une ligne par visite** (pseudo, compte ou visiteur,
heures d’arrivée et de départ) dans le SQLite de son Durable Object (`server/src/visits.ts`) ;
une reconnexion de moins de 2 minutes continue la même visite ; tout est **effacé au bout de
90 jours** (choix du responsable). Ni adresse IP, ni position, ni message. Lecture par
`GET /visits` sur le Worker : le jeton doit être celui du **responsable du site**, vérifié par la
base (`is_site_owner`, table `site_owners`, migration `20261022120000_site_owner.sql`) — rôle
distinct des modérateurs, pour que l’historique reste privé si l’équipe s’agrandit. Affichage :
onglet « 📋 Connexions » de la page de modération, pour le responsable seulement.
**Conséquences.** Deux écritures par visite dans le Durable Object (limite gratuite : 100 000
par jour). Page de confidentialité et texte de l’écran d’accueil mis à jour. Rien n’existe pour
les visites avant le 22/10/2026.

## DEC-023 — Site d’accueil à la racine, le jeu dans /jouer/ (24/10/2026)

**Contexte.** Des Malinos visitent le jeu sans se connecter : l’intérêt d’un compte n’était
expliqué nulle part, et les boutons de connexion étaient discrets (« facultatif »). Le
responsable estime que presque tous préfèrent Google à GitHub.
**Décision.** Une vraie page d’accueil à la racine du site (`index.html` + `src/landing/`) :
elle donne envie, donne du sens au projet et propose d’abord **« Continuer avec Google »**
(GitHub en second, visiteur en lien). Le jeu passe dans `jouer/index.html` (build Vite à deux
pages). La connexion part du site et revient directement dans le jeu (`/jouer/`, couvert par
l’adresse de retour `https://malinosland.pages.dev/**` déjà autorisée dans Supabase). Style
« fait main » (feutrine, coutures, carton, photos scotchées, nuages à spirales), inspiré de
l’ambiance « bricolée » de certains jeux mais sans rien en reprendre : personnages et objets
sont dessinés par **notre** générateur (`src/game/art/`). La page reste légère : ni Phaser ni
Preact ; Supabase n’est téléchargé qu’au clic sur un bouton de connexion. Dans le jeu aussi,
Google passe en premier et en évidence.
**Dépendance ajoutée.** `@fontsource-variable/fredoka` (police ronde Fredoka, licence OFL) :
servie par notre site (aucune requête vers Google Fonts, donc rien à changer à la CSP ni à la
confidentialité) ; seul le fichier latin (30 Ko) est téléchargé. Utilisée par le site d’accueil
seulement.
**Conséquences.** Les anciens liens vers la racine arrivent sur l’accueil (un bouton
« Reprendre ma visite » pour ceux qui sont déjà connectés). Les tests de bout en bout et les
scripts de captures visent `/jouer/` ; le test e2e vérifie aussi l’accueil. Image d’aperçu des
partages : `public/accueil/partage.jpg` (régénérée par `npm run docs:screenshots`).
