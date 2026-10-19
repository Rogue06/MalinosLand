# Reprise de session

> À lire en premier par toute nouvelle session (humaine ou IA). Mettre à jour à la fin de chaque
> tâche importante.

**Dernière mise à jour : 19/10/2026 — v0.1 terminée, PR #1 prête à être fusionnée dans `main`.**

## Où en est-on ?

- Branche de travail : **`feature/initial-prototype`** (poussée sur GitHub).
- La **PR #1** (`fix/casque-et-documentation` → `main`) contient tout le travail de la v0.1. Le
  responsable a validé sa fusion le 19/10 ; elle se fait par **« Squash and merge »** depuis GitHub.
  `feature/initial-prototype` est une ancienne branche (incluse dans la PR #1) : à supprimer après fusion.
- **Protection de `main` active** (corrigée le 19/10) : règle « Protection de la branche principale »
  sur la branche par défaut — pull request obligatoire, fusion en _squash_ uniquement, ni
  suppression ni push forcé. Les branches de travail ne sont pas protégées.
- `main` ne contient qu’un commit d’initialisation vide.
- **v0.1 (prototype jouable, local) : terminée et testée.** Voir [ROADMAP.md](ROADMAP.md).
- `npm run check` : **OK** (62 tests unitaires). Test de bout en bout : **OK** en développement
  et sur le build de production (avec CSP).

## Dernière session (18/10, soir)

- Corrigé : le casque audio traversait certaines coiffures. Il s’appuie maintenant sur le volume
  déclaré de chaque coiffure (`HAIR_BOUNDS`), vérifié par `tests/avatar.test.ts`.
- Documentation réécrite pour la communauté : README illustré, guide du joueur, glossaire,
  plan de la doc, feuille de route pédagogique, guide de contribution simplifié, résumés
  « En bref ». Captures dans `docs/images/` (script `npm run docs:screenshots`).
- Ajouts de débogage : `teleport(x, y, orientation)` et `zoom(z)` dans `window.__malinosDebug`.

## Ce qui n’est PAS fait (volontairement)

- Aucun backend, compte, base de données ou déploiement (v0.2, après validation de DEC-006).
- Galerie, tour, étages, logements : annoncés « bientôt » dans le jeu, non implémentés.

## Points en attente de décision du responsable

1. **Fusionner la PR #1** (bouton « Squash and merge » sur GitHub).
2. Optionnel : rendre la vérification « Types, lint, tests, build » obligatoire dans la règle
   de protection (_Require status checks to pass_).
3. **DEC-006** — infrastructure v0.2 : Cloudflare (Pages + Workers + Durable Objects) + Supabase,
   comptes gratuits **sans carte bancaire**.
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

1. Après la fusion : corriger le test de bout en bout sur GitHub (branche `fix/ci-e2e`), puis le
   rendre bloquant.
2. Mesurer les performances sur 2–3 machines réelles (procédure dans [TESTING.md](TESTING.md)).
3. Valider DEC-006 et créer les comptes gratuits, puis démarrer la v0.2 sur des branches dédiées :
   `feature/v0.2-auth` (Supabase Auth, profils, migrations SQL, RLS) puis
   `feature/v0.2-realtime` (Worker + Durable Object + `ServerTransport`).
4. Compteurs de quotas côté serveur et politique de saturation.

## Repères rapides pour reprendre

- Démarrer : `npm install && npm run dev` → http://localhost:5173 (`/art-preview.html` pour les assets).
- Débogage / tests automatisés : ajouter `?debug` à l’URL expose `window.__malinosDebug`
  (`pos()`, `walkTo(x, y)`, `teleport(x, y, f)`, `zoom(z)`, `use(id)`, `useType(type)`,
  `seated()`, `peers()`, `fps()`).
- Fichiers centraux : `src/game/scenes/WorldScene.ts` (assemblage), `src/world/WorldModel.ts`,
  `src/world/PlayerController.ts`, `src/content/maps/hub.json`, `src/content/catalog.ts`,
  `src/game/art/objects.ts`, `src/game/art/characters.ts`, `src/multiplayer/NetworkClient.ts`,
  `src/state.ts`.
