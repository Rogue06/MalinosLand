# Journal des décisions d’architecture

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

## DEC-006 — Infrastructure cible v0.2 : Cloudflare + Supabase (18/10/2026) — **à valider**

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
