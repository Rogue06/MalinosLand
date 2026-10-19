# Reprise de session

> À lire en premier par toute nouvelle session (humaine ou IA). Mettre à jour à la fin de chaque
> tâche importante.

**Dernière mise à jour : 19/10/2026 — v0.1 fusionnée dans `main`, test e2e réparé (PR #2).**

## Où en est-on ?

- **v0.1 (prototype jouable, local) fusionnée dans `main`** le 19/10 (PR #1, en squash).
  Voir [ROADMAP.md](ROADMAP.md).
- **Protection de `main` active** : règle « Protection de la branche principale » sur la branche
  par défaut — pull request obligatoire, fusion en _squash_ uniquement, ni suppression ni push
  forcé. Les branches de travail ne sont pas protégées.
- **PR #2 (`fix/ci-e2e`)** : le test de bout en bout passe désormais sur GitHub et devient
  bloquant. En attente de validation pour fusion.
- `npm run check` : **OK** (62 tests unitaires). Test de bout en bout : **OK** en local (y compris
  avec un processeur 4× et 8× plus lent) et **sur GitHub Actions** (Chrome 155).
- Anciennes branches `feature/initial-prototype` et `fix/casque-et-documentation` : incluses dans
  `main`, **à supprimer depuis GitHub** (le proxy des sessions Claude interdit leur suppression).

## Dernières sessions

- **19/10** — Réparation du test e2e sur GitHub : la cause était le ralentissement des minuteries
  de la page par Chrome sur les serveurs de CI (les attentes de Playwright dans la page ne se
  réveillaient pas). Les attentes sont maintenant sondées depuis Node. Annotations GitHub par étape,
  diagnostic `state()` en cas d’échec, mode `E2E_CPU_THROTTLE`, détection de Chrome.
- **18/10 (soir)** — Casque qui traversait certaines coiffures corrigé (`HAIR_BOUNDS` + test) ;
  documentation réécrite pour la communauté (README illustré, guide du joueur, glossaire, feuille
  de route pédagogique…) ; script `npm run docs:screenshots`.

## Ce qui n’est PAS fait (volontairement)

- Aucun backend, compte, base de données ou déploiement (v0.2, après validation de DEC-006).
- Galerie, tour, étages, logements : annoncés « bientôt » dans le jeu, non implémentés.

## Points en attente de décision du responsable

1. **Fusionner la PR #2** (test e2e bloquant).
2. Optionnel : dans la règle de protection, exiger les vérifications « Types, lint, tests, build »
   et « Test de bout en bout (Chrome) » (_Require status checks to pass_).
3. **DEC-006** — infrastructure v0.2 : Cloudflare (Pages + Workers + Durable Objects) + Supabase,
   comptes gratuits **sans carte bancaire**. Bloquant pour la v0.2 en ligne.
4. **DEC-009** — licence MIT (ou AGPL-3.0).

## Problèmes connus / limites

- **Performances non mesurées sur du vrai matériel** (seulement en rendu logiciel, sans GPU).
- Job CI `e2e` **en échec sur GitHub** (non bloquant). Il passe dans l’environnement de
  développement ; le journal GitHub n’est pas lisible depuis une session Claude (téléchargement
  bloqué). Piste : faire écrire les erreurs du test en annotations (`::error::`) pour les lire via
  l’API, vérifier le chemin de Chrome (`/usr/bin/google-chrome`) et la lenteur du rendu sans GPU.
- Quotas des fournisseurs relevés via un moteur de recherche : **à re-vérifier** avant déploiement.
- Phaser ≈ 357 Ko gzip (piste : build allégé, F33).
- Mobile jouable au toucher mais interface non optimisée.
- La vue d’ensemble `docs/images/hub-vue-ensemble.jpg` n’est pas parfaitement centrée (limites
  de la caméra) : sans gravité.

## Prochaines étapes suggérées (dans l’ordre)

1. Fusionner la PR #2.
2. Préparer la v0.2 (multijoueur) : valider DEC-006 ; le serveur temps réel (Worker + Durable
   Object) peut être développé et testé **en local avec Wrangler, sans compte** ; les comptes
   (Supabase) demandent la création d’un projet gratuit par le responsable.
3. Améliorer le prototype en parallèle : nouvelles salles, objets, animations, version mobile.
4. Mesurer les performances sur 2–3 machines réelles (procédure dans [TESTING.md](TESTING.md)).

## Repères rapides pour reprendre

- Démarrer : `npm install && npm run dev` → http://localhost:5173 (`/art-preview.html` pour les assets).
- Débogage / tests automatisés : ajouter `?debug` à l’URL expose `window.__malinosDebug`
  (`pos()`, `state()`, `walkTo(x, y)`, `teleport(x, y, f)`, `zoom(z)`, `use(id)`, `useType(type)`,
  `seated()`, `peers()`, `fps()`).
- Fichiers centraux : `src/game/scenes/WorldScene.ts` (assemblage), `src/world/WorldModel.ts`,
  `src/world/PlayerController.ts`, `src/content/maps/hub.json`, `src/content/catalog.ts`,
  `src/game/art/objects.ts`, `src/game/art/characters.ts`, `src/multiplayer/NetworkClient.ts`,
  `src/state.ts`.
