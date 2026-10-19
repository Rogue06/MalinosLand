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

## DEC-009 — Licence MIT (18/10/2026) — **à valider**

**Proposition.** MIT pour le code ; les graphismes étant générés par le code, ils suivent la même
licence. Simple et permissive, adaptée à un projet communautaire.
**Alternative.** AGPL-3.0 si l’on veut obliger les forks hébergés à publier leurs modifications.

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
