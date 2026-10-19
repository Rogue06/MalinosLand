# Reprise de session

> À lire en premier par toute nouvelle session (humaine ou IA). Mettre à jour à la fin de chaque
> tâche importante.

**Dernière mise à jour : 19/10/2026 — serveur temps réel fusionné (PR #4) ; mise en ligne
préparée (branche `feature/mise-en-ligne-cloudflare`), pas encore lancée.**

> Nouvelle session ? Les consignes sont dans [`AGENTS.md`](../AGENTS.md) ; le mode d’emploi pour
> reprendre sur un autre ordinateur ou un autre outil est dans
> [REPRENDRE_LE_PROJET.md](REPRENDRE_LE_PROJET.md).

## Où en est-on ?

- **`main`** contient la v0.1 (PR #1), le test e2e fiable (PR #2), la portabilité vers tous les
  outils IA (PR #3) et le **serveur temps réel v0.2** (PR #4, DEC-013).
- **Protection de `main` active** : pull request obligatoire, fusion en _squash_ uniquement, ni
  suppression ni push forcé.
- **Hébergement validé (DEC-006)** : Cloudflare + Supabase, offres gratuites sans carte bancaire.
  **Compte Cloudflare créé** par le responsable le 19/10 (connexion Google). Supabase : pas encore.
- Serveur temps réel testé : 77 tests unitaires, 10 vérifications d’intégration avec Wrangler,
  test « deux joueurs en ligne ». CI : 4 jobs (check, e2e, serveur, deux joueurs en ligne).
- **Mise en ligne préparée — branche `feature/mise-en-ligne-cloudflare`** : workflow GitHub
  « Mise en ligne » lancé à la main (DEC-014) et guide [MISE_EN_LIGNE.md](MISE_EN_LIGNE.md).
  Reste au responsable : sous-domaine `workers.dev`, jeton d’API, secrets GitHub, puis clic.
- Anciennes branches distantes déjà fusionnées (`feature/initial-prototype`,
  `fix/casque-et-documentation`, `fix/ci-e2e`, `docs/portabilite-ia`, `feature/v0.2-realtime`) :
  **à supprimer depuis GitHub** (le proxy des sessions Claude interdit leur suppression).

## Dernières sessions

- **19/10 (soir)** — PR #4 fusionnée. Workflow « Mise en ligne » (`deploy.yml`) : vérifie, crée le
  projet Pages si besoin, déduit les adresses via l’API Cloudflare, publie le Worker (origine du
  site seule autorisée) puis le site, vérifie `/health` et le refus d’une origine inconnue. Testé
  seulement à blanc (logique simulée, `wrangler deploy --dry-run`) : **jamais exécuté pour de vrai**.

- **19/10 (après-midi)** — Serveur temps réel v0.2 : `server/src/hub.ts` (règles pures),
  `WorldRoom.ts` (Durable Object, hibernation, compteur quotidien persisté), `index.ts` (routes,
  contrôle d’origine). Côté jeu : `ServerTransport`, `src/config.ts` (`VITE_REALTIME_URL`),
  messages `rate`/`notice`, CSP générée au build (`public/_headers` supprimé, émis par Vite).
  Docs : REALTIME_NETWORK réécrit, DEC-013.
- **19/10 (matin)** — Portabilité (`AGENTS.md`, guide de reprise, secrets stockés en ligne) ; test
  e2e réparé (écouteurs clavier en `useLayoutEffect`, pas de flou en qualité basse).
- **18/10** — v0.1 complète ; casque qui traversait les coiffures corrigé ; documentation pour la
  communauté.

## Ce qui n’est PAS fait (volontairement)

- **Mise en ligne** : workflow prêt, à lancer par le responsable (secrets à configurer).
- Comptes joueurs (Supabase), authentification sur le serveur temps réel, signaler / masquer,
  file d’attente (aujourd’hui : « salle pleine » + nouvel essai automatique), collisions vérifiées
  côté serveur (seule la vitesse et les limites de la carte le sont).
- Galerie, tour, étages, logements : annoncés « bientôt » dans le jeu.

## Points en attente de décision du responsable

1. Relire et fusionner la PR `feature/mise-en-ligne-cloudflare`.
2. Suivre [MISE_EN_LIGNE.md](MISE_EN_LIGNE.md) : sous-domaine `workers.dev`, jeton d’API,
   secrets `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID`, puis **Actions → Mise en ligne**.
3. Ensuite : compte Supabase pour les comptes joueurs.
4. Optionnel : exiger les vérifications de la CI dans la règle de protection.
5. **DEC-009** — licence MIT (ou AGPL-3.0).

## Problèmes connus / limites

- Quotas Cloudflare (≈ 2 millions de messages WebSocket entrants par jour en gratuit, d’où le
  budget de 1,4 million) relevés via la documentation : **à re-vérifier** avant la mise en ligne.
- Le serveur ne vérifie pas encore l’identité des joueurs (pas de comptes) : un pseudo peut être
  repris par quelqu’un d’autre. Acceptable pour une démo, à corriger avec Supabase.
- Le journal complet des jobs GitHub n’est pas lisible depuis une session Claude : les tests
  écrivent leurs étapes en annotations, lisibles via l’API.
- **Performances non mesurées sur du vrai matériel** (seulement en rendu logiciel, sans GPU).
- Phaser ≈ 357 Ko gzip (piste : build allégé, F33). Mobile jouable mais interface non optimisée.

## Prochaines étapes suggérées (dans l’ordre)

1. Première mise en ligne ; en cas d’erreur, lire les annotations du workflow (voir dépannage dans
   MISE_EN_LIGNE.md). Puis ajouter l’adresse du jeu dans le README.
2. Comptes Supabase (lien magique / GitHub), puis authentification sur le serveur temps réel.
3. Signaler / masquer, modération minimale.
4. Mesurer les performances sur 2–3 machines réelles (procédure dans [TESTING.md](TESTING.md)).

## Repères rapides pour reprendre

- Démarrer : `npm install && npm run dev` → http://localhost:5173 (`/art-preview.html` pour les assets).
- Multijoueur local : `npm run server:install` une fois, `npm run server:dev`, `.env.local` copié de
  `.env.example`, puis `npm run dev` dans deux navigateurs.
- Débogage / tests automatisés : ajouter `?debug` à l’URL expose `window.__malinosDebug`
  (`pos()`, `state()`, `walkTo(x, y)`, `teleport(x, y, f)`, `zoom(z)`, `use(id)`, `useType(type)`,
  `seated()`, `peers()`, `fps()`).
- Fichiers centraux : `src/game/scenes/WorldScene.ts` (assemblage), `src/world/WorldModel.ts`,
  `src/world/PlayerController.ts`, `src/content/maps/hub.json`, `src/content/catalog.ts`,
  `src/game/art/objects.ts`, `src/game/art/characters.ts`, `src/multiplayer/NetworkClient.ts`,
  `src/multiplayer/ServerTransport.ts`, `server/src/hub.ts`,
  `src/state.ts`.
