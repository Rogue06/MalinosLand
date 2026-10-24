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

## DEC-024 — Éditeur de décoration : liste de meubles en base, revérifiée par le jeu (24/10/2026)

**Contexte.** v0.3 lot 2 : chacun doit pouvoir meubler son studio simplement, sans pouvoir
gêner ses visiteurs (enfermer quelqu’un, boucher l’ascenseur) ni charger la base.
**Décision.** La décoration est une petite liste JSON de meubles `{ t, x, y, r, v }` (type,
case, rotation, couleur) dans `homes.decor` ; null = studio d’origine. La base vérifie la forme,
les types autorisés et le nombre (40 au plus) ; la lecture passe par `home_decor()`, réservée à
ceux qui peuvent entrer. Les règles de placement (sol du studio, entrée et ascenseur dégagés,
pas de chevauchement sauf un tapis sous un meuble, passage vers l’ascenseur et chaque meuble
utilisable, personne sous un meuble) sont dans `src/world/decor.ts`, pures et testées, et
**revérifiées à chaque chargement** : une liste trafiquée ne peut pas bloquer un visiteur. Les
meubles ne débloquent ni quête ni secret. L’éditeur (`src/game/DecorEditor.ts`) travaille sur un
brouillon ; rien n’est écrit avant « Enregistrer » (une seule requête). Le serveur temps réel
relaie seulement un petit message `decor` du propriétaire aux présents, qui rechargent la liste :
aucune donnée de décoration ne transite par le Durable Object. La salle est remeublée sans
relancer la scène (`WorldRenderer.destroy()`). La barre de l’éditeur est chargée à la demande.
**Conséquences.** Coût négligeable (une écriture par enregistrement, une lecture par entrée
dans un logement). Catalogue extensible : ajouter un type dans `src/content/furniture.ts` **et**
dans la liste de la migration (un test vérifie qu’elles sont identiques).

## DEC-025 — Progression sur le compte : réunion, jamais d’écrasement (25/10/2026)

**Contexte.** Objectifs et secrets n’étaient gardés que dans le navigateur : on les perdait en
changeant d’appareil, même connecté. Lot A de la feuille de route « vie du jeu ».
**Décision.** Une ligne par compte (`player_progress`) ; le navigateur garde sa copie. À la
connexion puis à chaque nouvelle découverte, `merge_my_progress` réunit les deux listes et
renvoie le total : rien n’est jamais retiré par une synchronisation (sauf « Recommencer » les
objectifs, fonction dédiée). La base filtre les identifiants et limite les tailles ; les
visiteurs restent en local. Le **carnet de Joshua** (devinettes, pages d’histoire) est du
contenu pur (`src/content/secrets.ts`).
**Conséquences.** Une écriture par découverte (regroupées par 1,5 s) : négligeable pour les quotas.
Base des futurs Coins coins (même principe : décidé par la base, jamais par le navigateur).

## DEC-026 — La page d’accueil dans un dépôt privé (26/10/2026)

**Contexte.** Le responsable souhaite garder la page d’accueil (la présentation) pour lui, hors
du code partagé ; le jeu, lui, reste public et open source. Il ne veut pas non plus que le site
donne l’adresse du dépôt.
**Décision.** La page d’accueil (`index.html`, `src/landing/`, `public/accueil/`) vit dans le
dépôt **privé** `Rogue06/MalinosLand-accueil`. Dans le dépôt public, ces chemins sont ignorés par
Git ; sans eux, la construction remplace la racine par une simple redirection vers `/jouer/`
(intégration continue et contributeurs non concernés). La mise en ligne récupère le dépôt privé
avec une clé en lecture seule (`ACCUEIL_TOKEN`) et refuse de publier sans elle ; le responsable
l’installe en local avec `npm run accueil`. Plus aucun lien vers GitHub sur le site ni dans le jeu.
**Conséquences.** Aucun coût : le dépôt privé n’a pas d’automatisation (pas de minutes
d’Actions consommées). Les versions de la page publiées entre le 24 et le 26/10 restent dans
l’historique public (choix du responsable : ne pas réécrire l’historique).

## DEC-027 — Rôles visibles : statut doré et modérateurs, donnés depuis le jeu (26/10/2026)

**Contexte.** Lot B2 : Renaud (fondateur de la communauté) doit être reconnaissable, et le
responsable veut nommer des modérateurs sans passer par la base à la main. Choix du
responsable : titre « Le Décodeur en chef », statut donné depuis le jeu, badge 🛡️ visible pour
les modérateurs, aucun signe distinctif pour lui-même.
**Décision.** Le rôle vit dans la base : table `gold_members` (statut doré) et table
`moderators` existante. `account_role(uuid)` (public, comme le pseudo) donne `gold`, `mod` ou
rien (jamais `mod` pour le responsable). Seul le responsable appelle `set_gold` /
`set_moderator` (vérifié par la base). Le serveur temps réel lit le rôle avec le profil
(`my_account`, nouvelle fonction : `my_profile` reste pour l’ancien serveur) et l'ajoute aux messages `hello` / `look` (`r`), comme la marque « vérifié » : un
client ne peut pas se l'attribuer. Après un changement, le jeu du responsable envoie `role` ; le
serveur relit le rôle dans la base et l'annonce à tous, sans reconnexion.
**Conséquences.** Une requête à la base par changement de rôle : négligeable. Hors serveur
(démo entre onglets), les rôles des autres ne s'affichent pas. Les options d'avatar barbe et
micro sont ouvertes à tous (champ `beard` ajouté à l'apparence, absent = « aucune »).

## DEC-028 — Jour et nuit à l’heure de Paris, calculés dans le navigateur (26/10/2026)

**Contexte.** Lot C : le monde doit suivre l’heure réelle de Paris (aube, jour, crépuscule,
nuit), sans coût d’hébergement et sans alourdir le jeu sur une machine modeste.
**Décision.** `src/core/daylight.ts` (logique pure, testée) lit l’heure de Paris avec le fuseau
`Europe/Paris` (heure d’été comprise) et calcule le lever et le coucher du soleil selon la saison
(formule astronomique simplifiée, à quelques minutes près). `src/game/life/DayNight.ts` applique
le résultat avec **un seul rectangle teinté en multiplication** sur l’écran (rosé, orangé, bleu
nuit ; plus doux à l’intérieur), des halos de lampes plus vifs, des étoiles et des lucioles
(qualité normale et haute seulement). Les oiseaux dorment et les grillons chantent la nuit. Le
ciel est recalculé toutes les 20 secondes. Réglage « Toujours de jour ».
**Conséquences.** Aucun message réseau ni requête : chacun voit la même heure parce que tout le
monde lit l’horloge de Paris. Coût d’affichage : un quadrilatère plein écran. Les fenêtres
allumées la nuit ne sont pas encore faites.

## DEC-029 — Panneau « Que faire maintenant ? » calculé dans le navigateur (23/10/2026)

**Contexte.** Plan d’évolution (PR 2) : une fois les objectifs « Premiers pas » finis, le joueur
ne savait plus quoi faire. Il faut lui proposer des idées sans solliciter le serveur.
**Décision.** `src/world/activities.ts` (logique pure, testée) choisit au plus 5 idées, dans cet
ordre : prochain objectif, Malinos présents dans une zone, secret à chercher (devinette du
carnet), studio ouvert à visiter, balade selon l’heure de Paris, puis son studio (ou la connexion
pour en avoir un). Les lieux sont des identifiants d’objets de la carte (`src/content/activities.ts`,
vérifiés par un test). « Y aller » réutilise le déplacement existant : l’avatar marche jusqu’à
l’objet et s’en sert (depuis un logement, retour au Hub d’abord). Les présents par zone sont
calculés par la scène une fois par seconde, seulement quand ils changent.
**Conséquences.** Aucune requête à l’arrivée ; une seule lecture des studios ouverts
(`visitable_homes`, déjà existante) à l’ouverture du panneau, gardée 5 minutes. Le quiz et le
musée viendront s’y ajouter (PR 5 et 11). Le panneau s’ouvre aussi depuis un écran-borne
dessiné à l’entrée du hall (`board_activities`, PR 3), hors du passage ; le hall a été agrandi
de deux rangées vers le sud pour lui faire de la place et dégager l’accès à la conférence.

## DEC-031 — Atelier voxel isolé, avec essai Blender local (23/10/2026)

**Contexte.** Le responsable souhaite juger un avatar et deux arbres inspirés de ses illustrations
avant toute adoption. Après un premier rendu trop simple, il demande une piste de modélisation
3D gratuite ; Blender 4.4.3 est déjà installé et fonctionne en local.

**Décision expérimentale.** Garder Phaser et la projection 2:1. Décrire les volumes en TypeScript
avec `IsoBuilder`, puis proposer dans une galerie de développement soit leur dessin procédural,
soit des images rendues une fois dans Blender (arêtes adoucies et éclairage). Un export des mêmes
volumes permet de régénérer les 24 vues ; aucun MCP ou service de génération externe n'est requis.
`TextureFactory` reçoit un fournisseur facultatif, avec un espace de noms distinct pour les
textures de comparaison. Le jeu normal ne passe aucun fournisseur alternatif.

**Conséquences.** Galerie et images exclues du build public ; aucune dépendance ajoutée. Environ
1,4 Mo d'images pour l'essai Blender, contre aucune image téléchargée pour le procédural.
Éclairage figé, une tenue seulement, occultation du feuillage élargi et performances dans le vrai
Hub restant à valider. **Ce choix ne vaut pas adoption du rendu Blender dans le jeu.** Le responsable
doit choisir la direction artistique avant une intégration distincte. Voir [PROTOTYPE_VOXEL.md](PROTOTYPE_VOXEL.md).

**Retour artistique du 23/10.** Le sakura reste trop différent de l'illustration. Une étude
indépendante (`scripts/sakura-study.py`) utilise des branches inclinées et de vraies fleurs en
relief, avec une présentation réduite à une image. Ses proportions sont à valider avant toute
conversion en atlas Phaser ; l'ancien export TypeScript ne reproduit pas ce nouveau modèle.

## DEC-032 — Essai graphique dans le vrai Hub, uniquement local (23/10/2026)

**Contexte.** Le responsable demande maintenant à marcher dans le jeu avec les modèles avant
de décider d'une mise en ligne.

**Décision.** `/jouer/?prototype=voxel`, uniquement en développement sur localhost, injecte un
fournisseur de textures dans `WorldScene`. Trois arbres existants changent d'image, sans changer
la carte ni les collisions. La nouvelle sculpture du sakura est convertie en quatre vues PNG,
à projection 2:1 ; Phaser conserve son moteur 2D et ses règles de profondeur. Avatar fixe à 16 cadres.

**Isolation.** Import dynamique sous `import.meta.env.DEV`, supprimé du build public ; services
distants désactivés et transport solo. Stockage séparé (`malinosland:prototype:`) et profil
d'essai créé en mémoire pour ouvrir directement le jardin. Aucun fichier Blender servi au jeu,
aucune dépendance ajoutée. Trois atlas totalisent environ 1,38 Mo, réutilisés entre exemplaires.
Le test navigateur couvre le Hub et le retour d'un studio ; validation artistique, autres
meubles et performances sur appareils réels restent à confirmer. Aucune adoption en production.

## DEC-030 — Quiz IA des Malinos : questions dans le jeu, scores dans le navigateur (23/10/2026)

**Contexte.** Plan d’évolution (PR 4) : une activité jouable tout de suite, même seul, sans API
d’IA payante ni écriture en base (décision du responsable pour la v0.35).
**Décision.** Les questions sont du **contenu du dépôt** (`src/content/quiz.ts`) : 4 choix, une
explication, une source si possible, des notions durables plutôt que l’actualité. **Chaque
question est relue par le responsable ou un modérateur avant publication.** Le moteur
(`src/core/quiz.ts`, pur et testé) tire 5 questions du plus facile au plus difficile, mélange
l’ordre des choix, et calcule le **défi de la semaine** à partir du numéro de semaine ISO : le
même pour tous, sans serveur. Les questions du défi **tournent sans répétition** (avec 60
questions : 12 semaines de suite sans en revoir une), puis un nouveau cycle dans un autre ordre. Les scores (`src/services/quizStats.ts`) restent **uniquement
dans le navigateur** ; un test vérifie qu’aucun appel réseau ni à Supabase n’y figure. Un test
vérifie aussi que la bonne réponse ne se devine pas à sa longueur.
**Conséquences.** Zéro coût d’hébergement. Pas de classement ni de scores sur le compte pour
l’instant (évolution possible, non développée). Ajouter des questions = une pull request relue.

## DEC-033 — Adoption des atlas et conservation du choix classique (23/10/2026)

**Contexte.** Le responsable valide le rendu dans le Hub et autorise sa mise en ligne. Il veut
conserver du forfait ChatGPT pour la suite ; les variantes doivent être développées progressivement.

**Décision.** Publier seulement les trois atlas déjà validés (avatar, chêne, nouveau sakura),
1,38 Mo au total, partagés entre instances et mis en cache. Remplacer tous les chênes et sakuras,
conserver les sapins. Charger ces images dans Phaser et utiliser le rendu procédural en repli.
Le champ borné `look.model` vaut 1 pour le Malino 3D, 0 pour le modèle classique personnalisable.
Sans champ (ancien profil), le nouveau rendu s'affiche ; les autres choix du profil sont conservés.
Le sélecteur de modèle restaure les contrôles classiques. Aperçu et rendu distant respectent ce choix.

**Conséquences.** Aucun nouveau moteur, service ou modèle généré. Pas de migration SQL : le champ
reste dans le JSON d'apparence existant, validé côté client et serveur. Une seule tenue 3D disponible,
annoncée dans l'éditeur ; personnalisation ultérieure par composants, pas 829 440 atlas complets.
Le choix artistique autorise maintenant la publication ; il remplace la restriction provisoire
de DEC-031/032. Les galeries de développement et le stockage d'essai restent isolés.

## DEC-034 — Palettes 3D avec un masque de matière partagé (23/10/2026)

**Contexte.** Le responsable demande plusieurs choix pour le nouveau personnage et leur
publication, avec un budget de travail et d'hébergement limité.

**Décision.** Conserver l'atlas validé et produire un masque de ses 16 cadres avec la même
géométrie et caméra Blender : rouge peau, vert cheveux, bleu veste, blanc pantalon, noir
détails fixes. Recolorer dans Canvas une fois par palette à la création de la texture Phaser.
Interpolation noir/couleur/blanc pour conserver les ombres et reflets ; alpha original inchangé.
Six styles de départ et quatre palettes bornées, distinctes des réglages classiques ; les deux
modèles restent disponibles. L'interface annonce les limites de forme et de coiffure.

**Conséquences.** +315 Ko pour 2 880 combinaisons, aucune dépendance ni migration. Le JSON du
profil et le protocole commun transportent quatre petits indices validés. Textures calculées
à la demande et mises en cache, vignettes limitées à 96 entrées. Pas de recalcul à chaque frame.
Éclairage précalculé et recoloration approchée, sans nouvelle géométrie. Mémoire graphique liée
aux palettes utilisées ; performances sur appareils physiques modestes restant à mesurer.

## DEC-035 — Musée des Malinos : projets validés par la base, signalements dédiés (24/10/2026)

**Contexte.** Plan d’évolution, v0.4 (PR 7) : les membres exposent leurs créations ; il faut une
modération avant publication, sans coût ni risque pour MalinosLand.
**Décision.** Table `projects` (texte seulement : l’affiche est dessinée par le jeu). Les droits
sont vérifiés **par la base** : lecture publique des seuls projets validés, proposition en son
nom et forcément « en attente », aucune modification directe (fonctions `update_my_project`,
`withdraw_my_project`, `moderate_project`, `set_project_embed`). Les adresses sont vérifiées par
`valid_project_url` (https, vrai nom de domaine, ni IP, ni port, ni identifiants, ni adresse
locale, ni MalinosLand ni Supabase). Plafonds anti-abus. Colonne `thumbnail` prévue pour une
miniature future, toujours vide. **Écart avec le plan** : les signalements de projets ont leur
propre table `project_reports` au lieu de réutiliser `reports` (pensée pour des joueurs, avec
des colonnes obligatoires sans objet ici) ; la migration reste purement additive. Comme pour
les joueurs, signaler demande un compte.
**Conséquences.** ≈ 1 Ko par projet ; une lecture paginée (20) à l’entrée du musée. La démo
intégrée (PR 10) s’appuiera sur `embed`, que seul un modérateur règle.

## DEC-036 — Affiches du musée dessinées en Canvas 2D, partagées par l’interface et le jeu (24/10/2026)

**Contexte.** PR 8 du plan : le formulaire « Exposer mon projet » doit montrer l’affiche avant
l’envoi, et la salle du musée (PR 9) doit montrer la même. Le responsable veut une affiche
soignée, sans stocker d’image.
**Décision.** `src/game/art/posters.ts` dessine l’affiche avec l’API Canvas 2D du navigateur,
**sans importer Phaser** : l’interface Preact l’utilise pour l’aperçu (elle ne connaît toujours
pas Phaser), et le jeu pourra en faire une texture. Le dessin est déterministe (même projet →
même affiche, motif varié par un hachage du numéro et du titre). L’affiche est donc avancée de la
PR 9 à la PR 8. La vérification du formulaire (`src/core/museum.ts`) reprend exactement les
règles d’adresse de la base ; une même liste d’adresses est testée côté jeu et côté base.
Côté services, les fonctions s’appellent `moderateProject` (au lieu de `setStatus` dans le plan).
**Conséquences.** Aucune image, aucun service ni dépendance en plus ; quelques kilo-octets de
code. Le texte est dessiné (`fillText`), jamais interprété. Les données reçues de la base sont
relues : une adresse invalide n’est jamais affichée comme lien.

## DEC-037 — Salle du musée : affiches plaquées sur le mobilier, liste lue en approchant (24/10/2026)

**Contexte.** PR 9 du plan : ouvrir la galerie comme Musée des Malinos, avec des stands qui
montrent les projets validés. Les objets du jeu sont des images précalculées par `IsoBuilder`.
**Décision.** `IsoBuilder.image()` plaque une image sur une face verticale, en perspective
(transformation affine du canevas). Cimaises et stands (`src/game/art/museum.ts`) reçoivent
l’affiche de `posters.ts` ; quand la liste arrive, le jeu recalcule l’image de chaque stand (même
cadrage, clé de cache par projet) et la remplace (`WorldRenderer.setObjectTexture`). Nouvelle
interaction `stand` (place 0 = projet le plus récent), validée par `validateMap`. La liste est
lue par `museum_projects` **en approchant** (zones hall ou musée), gardée 5 minutes ; la borne
réutilise cette lecture. Les signalements de projets ont leur onglet de modération.
**Conséquences.** Aucune image stockée ni service ajouté ; une requête légère par visite du Hub
(le hall est un passage fréquent, choix assumé pour ne jamais montrer des stands faussement
vides). Un visiteur sans compte télécharge le client Supabase en approchant (comme pour les
logements). Les affiches restent lisibles en zoomant ; la fiche donne tous les détails.
