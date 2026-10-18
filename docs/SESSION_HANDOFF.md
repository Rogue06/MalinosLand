# Reprise de session

> À lire en premier par toute nouvelle session (humaine ou IA). Mettre à jour à la fin de chaque
> tâche importante.

**Dernière mise à jour : 18/10/2026 (soir) — v0.1 terminée, pull request ouverte vers `main`.**

## Où en est-on ?

- Branche de travail : **`feature/initial-prototype`** (poussée sur GitHub).
- Une **pull request vers `main`** a été ouverte à la demande du responsable. **Elle n’est pas
  fusionnée** : la fusion attend sa validation explicite (Rogue06).
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

1. **Relire et fusionner la pull request** de la v0.1 (ou demander des changements).
2. **Protection de `main`** sur GitHub (Settings → Branches) : PR obligatoire, CI
   « Types, lint, tests, build » requise, relecture CODEOWNERS.
3. **DEC-006** — infrastructure v0.2 : Cloudflare (Pages + Workers + Durable Objects) + Supabase,
   comptes gratuits **sans carte bancaire**.
4. **DEC-009** — licence MIT (ou AGPL-3.0).

## Problèmes connus / limites

- **Performances non mesurées sur du vrai matériel** (seulement en rendu logiciel, sans GPU).
- Job CI `e2e` **non bloquant** tant qu’il n’a pas tourné avec succès sur GitHub (chemin de Chrome
  supposé `/usr/bin/google-chrome`). Vérifier son résultat sur la PR, puis le rendre bloquant.
- Quotas des fournisseurs relevés via un moteur de recherche : **à re-vérifier** avant déploiement.
- Phaser ≈ 357 Ko gzip (piste : build allégé, F33).
- Mobile jouable au toucher mais interface non optimisée.
- La vue d’ensemble `docs/images/hub-vue-ensemble.jpg` n’est pas parfaitement centrée (limites
  de la caméra) : sans gravité.

## Prochaines étapes suggérées (dans l’ordre)

1. Vérifier la CI sur la PR, faire valider puis fusionner la v0.1, activer la protection de `main`.
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
