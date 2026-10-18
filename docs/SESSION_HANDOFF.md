# Reprise de session

> À lire en premier par toute nouvelle session (humaine ou IA). Mettre à jour à la fin de chaque
> tâche importante.

**Dernière mise à jour : 18/10/2026 — fin de la session de création de la v0.1.**

## Où en est-on ?

- Branche de travail : **`feature/initial-prototype`** (poussée sur GitHub). `main` ne contient
  qu’un commit d’initialisation vide. **Rien n’a été fusionné dans `main`** : la fusion attend la
  validation du responsable (Rogue06), idéalement via une pull request.
- **v0.1 (prototype jouable, local) : développée et testée.** Voir [ROADMAP.md](ROADMAP.md).
- `npm run check` (types, lint, tests, build) : **OK** à la fin de la session. 53 tests unitaires
  passent. Le test de bout en bout passe sur le serveur de dev et sur le build de production
  (avec CSP) dans Chromium.

## Ce qui a réellement été développé

- Hub isométrique complet (8 zones, dont 2 annoncées « bientôt »), ≈ 40 objets procéduraux.
- Avatars personnalisables, écran de création, éditeur (miroir / bouton 🧑).
- Déplacements clic + clavier, collisions, assises, interactions, objectifs, chat, émotes.
- Démo multijoueur **locale** entre onglets (BroadcastChannel) — pas de serveur.
- Réglages qualité / i/s / animations / noms / statistiques.
- Documentation complète dans `docs/`, `CLAUDE.md`, modèles GitHub, CI.

## Ce qui n’est PAS fait (volontairement)

- Aucun backend, compte, base de données ou déploiement (v0.2, après validation de DEC-006).
- Galerie, tour, étages, logements : annoncés dans le jeu comme « bientôt », non implémentés.

## Points en attente de décision du responsable

1. **DEC-006** — infrastructure v0.2 : Cloudflare (Pages + Workers + Durable Objects) + Supabase.
   Nécessite la création de comptes gratuits **sans carte bancaire**.
2. **DEC-009** — licence MIT (ou AGPL-3.0).
3. Fusion de `feature/initial-prototype` dans `main` (ouvrir une PR, relire, fusionner).
4. Paramétrer la **protection de `main`** sur GitHub (Settings → Branches) : PR obligatoire,
   CI « Types, lint, tests, build » requise, relecture par CODEOWNERS.

## Problèmes connus / limites

- **Performances non mesurées sur du vrai matériel** : seules des mesures en rendu logiciel
  (sans GPU) ont été faites, non représentatives (voir [TESTING.md](TESTING.md)).
- Le job CI `e2e` est **non bloquant** : il n’a pas encore tourné sur les runners GitHub (chemin de
  Chrome supposé `/usr/bin/google-chrome`). Le rendre bloquant une fois validé.
- Quotas des fournisseurs relevés via un moteur de recherche (pages officielles inaccessibles
  directement depuis l’environnement) : **à re-vérifier** avant tout déploiement
  ([FREE_INFRASTRUCTURE.md](FREE_INFRASTRUCTURE.md)).
- Phaser représente ≈ 357 Ko gzip : un build allégé de Phaser pourrait réduire ce poids (F33).
- Mobile : jouable au toucher (clic pour se déplacer) mais l’interface n’est pas optimisée.
- Démo multi-onglets : un onglet en arrière-plan est ralenti par le navigateur (normal).
- Le texte de certains panneaux dessinés est petit en zoom arrière (lisible au zoom par défaut).

## Prochaines étapes suggérées (dans l’ordre)

1. Faire relire et fusionner la v0.1 ; activer la protection de `main` ; vérifier la CI.
2. Mesurer les performances sur 2–3 machines réelles et ajuster la qualité par défaut.
3. Valider DEC-006, créer les comptes gratuits, puis démarrer la v0.2 sur une branche
   `feature/v0.2-auth` : Supabase Auth + profils (migrations SQL, RLS), puis
   `feature/v0.2-realtime` : Worker + Durable Object + `ServerTransport`.
4. Ajouter les compteurs de quotas côté serveur et la politique de saturation.

## Repères rapides pour reprendre

- Démarrer : `npm install && npm run dev` → http://localhost:5173 (`/art-preview.html` pour les assets).
- Débogage / tests automatisés : ajouter `?debug` à l’URL expose `window.__malinosDebug`
  (`pos()`, `walkTo(x, y)`, `use(id)`, `useType(type)`, `peers()`, `fps()`).
- Fichiers centraux : `src/game/scenes/WorldScene.ts` (assemblage), `src/world/WorldModel.ts`,
  `src/world/PlayerController.ts`, `src/content/maps/hub.json`, `src/content/catalog.ts`,
  `src/game/art/objects.ts`, `src/multiplayer/NetworkClient.ts`, `src/state.ts`.
