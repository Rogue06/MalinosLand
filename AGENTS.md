# AGENTS.md — Consignes pour toute IA et tout développeur

Ce fichier est la **source unique** des consignes du projet. Il est lu automatiquement par
Codex, Cursor, GitHub Copilot, Gemini, Claude Code (via `CLAUDE.md`) et la plupart des assistants
de code. Il vaut aussi pour les développeurs humains. **Lis-le en entier avant toute modification.**

Le projet doit pouvoir être repris **à tout moment, depuis n’importe quel ordinateur (Windows, macOS,
Linux) et avec n’importe quel outil** (Claude Code en local ou dans le cloud, Codex, Cursor…) :
tout ce qui compte est dans ce dépôt GitHub, jamais seulement dans une conversation.

## 1. Le projet en bref

MalinosLand : monde virtuel isométrique **gratuit, open source, communautaire**, jouable dans le
navigateur, pour la communauté des « Malinos » (passionnés d’IA). Un hub, des espaces collectifs,
puis une tour où chacun aura son logement et pourra exposer ses projets (galerie). Le nom est
**MalinosLand** (jamais « MalinoVerse »). Dépôt : https://github.com/Rogue06/MalinosLand
Responsable du projet : **Rogue06**.

## 2. Démarrer une session (dans cet ordre)

1. Lire ce fichier.
2. Lire [`docs/SESSION_HANDOFF.md`](docs/SESSION_HANDOFF.md) : état actuel, travail en cours,
   décisions en attente, prochaines étapes.
3. Lire [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) puis le document du sujet traité
   (plan complet : [`docs/README.md`](docs/README.md)).
4. `git checkout main && git pull`, puis `npm install` et `npm run check` pour partir d’une base saine.
5. Créer une branche dédiée avant toute modification (voir §3.2).

## 3. Règles absolues

1. **Gratuité permanente.** Aucune dépense obligatoire, jamais. Hébergement validé : **Cloudflare**
   (Pages, Workers, Durable Objects) et **Supabase**, uniquement en **offres gratuites, sans carte
   bancaire** (DEC-006). Ne jamais proposer ni activer de service payant ou d’option « au-delà des
   quotas » sans validation explicite du responsable. Voir `docs/FREE_INFRASTRUCTURE.md`.
2. **Git.** Ne jamais développer sur `main` (protégée : pull request obligatoire, fusion en
   _squash_). Une branche par sujet : `feature/…`, `fix/…`, `content/…`, `docs/…`.
   **Ne jamais fusionner une pull request sans l’accord explicite du responsable.**
   Pas de push forcé sur une branche partagée.
3. **Honnêteté.** Ne jamais présenter une fonctionnalité prévue comme terminée, ni prétendre avoir
   exécuté un test non exécuté. Les zones non développées sont affichées « bientôt » dans le jeu.
4. **Déploiement et comptes.** Pas de mise en ligne ni de création de ressource sur un compte
   externe sans autorisation explicite. Pas d’identifiants inventés. **Aucun secret dans le dépôt**
   (`.env*` ignorés ; les secrets vont dans les réglages chiffrés de l’hébergeur ou de GitHub).
5. **Sécurité.** Tout texte venant d’un joueur ou du réseau est non fiable : passer par
   `sanitizeText` / `sanitizeName` / `decodeMessage`. Interdits (bloqués par ESLint) : `innerHTML`,
   `dangerouslySetInnerHTML`, `eval`. Les permissions sont vérifiées côté serveur / base de
   données, jamais seulement dans l’interface.
6. **Légèreté.** Pas de dépendance superflue ; toute nouvelle dépendance est justifiée dans
   `docs/DECISIONS.md`. Le jeu doit rester fluide sur une machine modeste.
7. **Originalité.** Le jeu DEKODE n’est qu’une référence d’ambiance : aucun graphisme, nom,
   interface ou mécanique de monnaie copiés.

## 4. Commandes

Prérequis : **Node.js 20 ou plus** (22 recommandé, voir `.nvmrc`) et Git. Les commandes sont les
mêmes sous Windows (PowerShell), macOS et Linux.

```bash
npm install                 # dépendances
npm run dev                 # jeu sur http://localhost:5173 (galerie d’assets : /art-preview.html)
npm run check               # types + lint + tests + build — doit passer avant tout commit
npm test                    # tests unitaires seulement
npm run format              # mise en forme Prettier
npm run build && npm run preview   # version de production sur http://localhost:4173
npm run test:e2e            # test de bout en bout dans Chrome (avec « preview » lancé)
npm run docs:screenshots    # régénère docs/images/ (avec « preview » lancé)
```

Navigateur du test e2e : variable `CHROMIUM_PATH` (ex. `/usr/bin/google-chrome`,
`C:\Program Files\Google\Chrome\Application\chrome.exe`,
`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`).

## 5. Architecture (résumé)

```
src/core/        logique pure : iso, collisions, A*, rotation, texte, store, limiteur de débit
src/world/       modèle du monde : format de carte, validation, WorldModel, PlayerController, profondeur
src/content/     DONNÉES : cartes JSON, catalogue d’objets, avatars, objectifs, textes
src/game/        Phaser : dessin procédural (art/), textures, rendu du monde, scène, avatars
src/multiplayer/ protocole, transports (hors ligne, BroadcastChannel, serveur), NetworkClient
src/services/    stockage local versionné : profil, réglages, progression
src/ui/          interface Preact (HUD, panneaux, accueil)
src/state.ts     pont jeu ↔ interface (stores + commandes)
```

Règles de dépendance (en partie vérifiées par ESLint) : `core/` et `world/` n’importent ni Phaser,
ni Preact, ni le DOM ; `ui/` ne connaît pas Phaser (elle lit `state.ts` et émet des `commands`) ;
`game/` ne connaît pas Preact ; le réseau passe par l’interface `Transport`.

## 6. Conventions

- TypeScript strict. Identifiants en anglais, **commentaires et documentation en français**.
- Prettier + ESLint. Commits : Conventional Commits en français (`feat: …`, `fix: …`, `docs: …`).
- Graphismes **procéduraux** (`src/game/art/`). Ajouter un objet : entrée dans
  `src/content/catalog.ts` + dessin dans `src/game/art/objects.ts` + placement dans une carte.
- Toute carte est validée (`validateMap`) et testée (accessibilité des zones et des objets).
- Fins de ligne LF (voir `.gitattributes`) pour éviter les différences Windows / macOS / Linux.

## 7. Documentation

Projet communautaire : la documentation s’adresse aussi à des non-développeurs. Écrire **en
français, simplement**, avec un résumé « En bref » en tête des documents techniques et des captures
d’écran (`docs/images/`, via `npm run docs:screenshots`) quand c’est utile. Les mots techniques sont
expliqués dans `docs/GLOSSAIRE.md`.

## 8. Terminer une tâche importante

1. Mettre à jour la documentation concernée et `docs/CHANGELOG.md`.
2. Mettre à jour `docs/SESSION_HANDOFF.md` : fait / reste à faire / problèmes connus / décisions
   en attente. **C’est ce fichier qui permet à la session suivante, sur un autre outil ou un autre
   ordinateur, de reprendre exactement où l’on en est.**
3. Ajouter une entrée dans `docs/DECISIONS.md` pour tout choix d’architecture.
4. Lancer `npm run check` et signaler honnêtement le résultat.
5. Pousser la branche et ouvrir une pull request vers `main` (modèle fourni) ; ne pas fusionner
   sans l’accord du responsable.

## 9. Outils de débogage

Ajouter `?debug` à l’URL du jeu expose `window.__malinosDebug` : `pos()`, `state()`,
`walkTo(x, y)`, `teleport(x, y, orientation)`, `zoom(z)`, `use(id)`, `useType(type)`, `seated()`,
`peers()`, `fps()`. Utilisé par les tests de bout en bout et les captures de documentation.
