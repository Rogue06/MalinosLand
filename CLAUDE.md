# CLAUDE.md — Instructions permanentes pour les assistants IA

Ce fichier est lu automatiquement par Claude Code. Il vaut aussi pour tout autre assistant IA
(ChatGPT, Copilot…). **Lis-le en entier avant toute modification.**

## Le projet en bref

MalinosLand : monde virtuel isométrique **gratuit, open source, communautaire**, jouable dans le
navigateur, pour la communauté des « Malinos » (passionnés d’IA). Version actuelle : **0.1,
prototype local** (aucun serveur). Le nom est **MalinosLand** (jamais « MalinoVerse »).

Avant de coder, lis dans cet ordre :

1. `docs/SESSION_HANDOFF.md` — état actuel, travail en cours, prochaines étapes.
2. `docs/ARCHITECTURE.md` — modules et règles de dépendance.
3. Le document du domaine concerné (`docs/WORLD_DESIGN.md`, `docs/REALTIME_NETWORK.md`, …).

## Règles absolues

1. **Gratuité permanente.** Aucune dépense obligatoire, jamais. Ne propose ni n’active de service
   payant, ni de service exigeant une carte bancaire, sans validation explicite du responsable.
   Voir `docs/FREE_INFRASTRUCTURE.md`.
2. **Git.** Ne jamais développer sur `main`. Une branche par fonctionnalité ou correction
   (`feature/…`, `fix/…`, `docs/…`). **Ne jamais fusionner dans `main`** sans l’autorisation
   explicite du responsable du projet (Rogue06). Ne pas pousser de force sur une branche partagée.
3. **Honnêteté.** Ne jamais présenter une fonctionnalité prévue comme terminée. Ne jamais prétendre
   avoir exécuté un test non exécuté. Les zones non développées sont affichées « bientôt ».
4. **Pas de déploiement** sur un compte externe sans autorisation explicite. Pas d’identifiants
   inventés. Aucun secret dans le dépôt (`.env` est ignoré par Git).
5. **Sécurité.** Tout texte venant d’un joueur ou du réseau est non fiable : passer par
   `sanitizeText` / `sanitizeName` / `decodeMessage`. Interdit : `innerHTML`,
   `dangerouslySetInnerHTML`, `eval` (bloqués par ESLint). Les permissions futures seront
   vérifiées côté serveur / base de données, jamais seulement dans l’interface.
6. **Légèreté.** Pas de dépendance superflue. Toute nouvelle dépendance doit être justifiée dans
   `docs/DECISIONS.md`. Le jeu doit rester fluide sur une machine modeste.
7. **Ne pas copier DEKODE** (référence visuelle uniquement) : aucun graphisme, nom, interface ou
   mécanique de monnaie copiés.

## Commandes

```bash
npm install          # dépendances
npm run dev          # http://localhost:5173 (art-preview : /art-preview.html)
npm run check        # types + lint + tests + build — doit passer avant tout commit
npm test             # tests unitaires seulement
npm run build && npm run preview   # build de prod sur http://localhost:4173
npm run test:e2e     # test de bout en bout (avec preview lancé), captures dans screenshots/
npm run docs:screenshots   # régénère docs/images/ (avec preview lancé)
```

Chromium pour Playwright : variable `CHROMIUM_PATH` si le navigateur n’est pas trouvé.

## Architecture (résumé)

```
src/core/        logique pure : iso, collisions, A*, rotation, texte, store, rate limit
src/world/       modèle du monde : types de carte, validation, WorldModel, PlayerController, profondeur
src/content/     DONNÉES : cartes JSON, catalogue d’objets, avatars, objectifs, textes
src/game/        Phaser : art procédural (art/), textures, rendu du monde, scène, avatars
src/multiplayer/ protocole, transports (hors ligne, BroadcastChannel), NetworkClient
src/services/    stockage local versionné : profil, réglages, progression
src/ui/          interface Preact (HUD, panneaux, accueil)
src/state.ts     pont jeu ↔ interface (stores + commandes)
```

Règles de dépendance (vérifiées en partie par ESLint) :

- `core/` et `world/` n’importent **ni Phaser, ni Preact, ni le DOM**.
- `ui/` ne connaît pas Phaser ; elle lit les stores de `state.ts` et émet des `commands`.
- `game/` ne connaît pas Preact.
- Le réseau passe par l’interface `Transport` : on peut changer de fournisseur sans toucher au rendu.

## Conventions

- TypeScript strict. Identifiants en anglais, **commentaires et documentation en français**.
- Prettier (`npm run format`) et ESLint. Messages de commit : Conventional Commits en français
  (`feat: ajoute la salle de jeux`, `fix: …`, `docs: …`).
- Les graphismes sont **procéduraux** (dessinés par le code dans `src/game/art/`). Ajouter un objet :
  entrée dans `src/content/catalog.ts` + dessin dans `src/game/art/objects.ts` + placement dans une
  carte. Les tests vérifient la cohérence.
- Toute carte est validée (`validateMap`) et testée (accessibilité des zones et des objets).

## Documentation

Projet communautaire : la documentation s’adresse aussi à des non-développeurs. Écrire **en
français, simplement**, avec un résumé « En bref » en tête des documents techniques, et des
captures d’écran (`docs/images/`, générées par `npm run docs:screenshots`) quand c’est utile.
Les mots techniques sont expliqués dans `docs/GLOSSAIRE.md`.

## Après chaque tâche importante

1. Mettre à jour la documentation concernée et `docs/CHANGELOG.md`.
2. Mettre à jour `docs/SESSION_HANDOFF.md` : fait / reste à faire / problèmes connus.
3. Ajouter une entrée dans `docs/DECISIONS.md` pour tout choix d’architecture.
4. Lancer `npm run check` et signaler honnêtement le résultat.
