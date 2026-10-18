# Architecture

> **En bref (version simple)** : le jeu est écrit en TypeScript. Le moteur **Phaser** affiche le monde, **Preact** affiche les menus et le chat, et la « logique » (déplacements, collisions, règles) est rangée à part pour être testée facilement. Le contenu (salles, objets, textes) est séparé du code du moteur, pour que chacun puisse en ajouter sans tout comprendre.

> Dernière mise à jour : v0.1 (prototype local). Les décisions détaillées et leurs motivations sont
> dans [DECISIONS.md](DECISIONS.md).

## 1. Analyse technique et choix de la stack

### Critères (par ordre de priorité)

1. Aucune dépense obligatoire · 2. Fluidité sur machine modeste · 3. Faible consommation réseau ·
2. Simplicité et robustesse · 5. Maintenable par des contributeurs de niveaux variés ·
3. Portabilité de l’hébergement · 7. Facilité d’évolution.

### Moteurs et technologies comparés

| Option                   | Atouts                                                                                                                            | Limites                                                                                                                                | Verdict                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **Phaser 4**             | Framework de jeu complet (scènes, caméra, entrées, tweens, textures, profondeur), WebGL rapide, très documenté, bien connu des IA | Bundle conséquent (~357 Ko gzip), API v4 récente                                                                                       | **Retenu**                                   |
| PixiJS 8                 | Moteur de rendu plus léger (~100–150 Ko gzip), très performant                                                                    | Caméra, entrées, scènes, animations à écrire soi-même → plus de code à maintenir                                                       | Alternative si le poids devient critique     |
| Godot (export web)       | Éditeur visuel puissant                                                                                                           | Export WebAssembly de plusieurs dizaines de Mo, démarrage lent, moins adapté aux connexions modestes, collaboration Git plus difficile | Écarté                                       |
| Rust + WebAssembly       | Performances CPU                                                                                                                  | Aucun goulot CPU mesuré qui le justifie ; complexité et courbe d’apprentissage élevées                                                 | Écarté (à reconsidérer seulement sur mesure) |
| Three.js (3D)            | Vraie 3D                                                                                                                          | Plus lourd en GPU et en contenu, inutile pour une vue isométrique fixe                                                                 | Écarté                                       |
| React (UI)               | Connu du responsable                                                                                                              | ~45 Ko gzip pour l’interface seule                                                                                                     | Remplacé par **Preact** (même API, ~6 Ko)    |
| TypeScript vs JavaScript | Typage, refactorisations sûres, meilleure assistance IA                                                                           | Étape de compilation (gérée par Vite)                                                                                                  | **TypeScript strict**                        |
| Vite                     | Démarrage instantané, build optimisé, découpage du code                                                                           | —                                                                                                                                      | **Retenu**                                   |

### Rendu graphique : procédural « voxel »

Tous les graphismes (objets, murs, sols, personnages) sont **dessinés par le code** au chargement
(`src/game/art/`), dans un style « voxel » isométrique original. Avantages : **0 octet d’image à
télécharger**, cohérence visuelle, variantes et couleurs gratuites, contributions possibles en
TypeScript. Les textures sont ensuite regroupées en **atlas** et les sols en **grands blocs** pour
limiter les appels de dessin. L’interface `TextureInfo` permettra d’utiliser aussi des images PNG.

## 2. Vue d’ensemble des modules

```
                 ┌───────────────────────── src/ui (Preact) ─────────────────────────┐
                 │ Accueil · HUD (zone, objectifs, mini-carte, chat) · panneaux       │
                 └──────────────▲──────────────────────────────┬──────────────────────┘
                     lit les stores                   émet des commandes
                 ┌──────────────┴──────── src/state.ts ────────▼──────────────────────┐
                 │ zoneStore, hintStore, panelStore, chatStore, presenceStore… commands│
                 └──────────────▲──────────────────────────────┬──────────────────────┘
                                │ écrit                         │ écoute
┌─────────── src/game (Phaser) ─┴───────────────────────────────▼──────────────────────────┐
│ WorldScene : boucle, entrées, interactions · WorldRenderer : sols/murs/objets/lumières   │
│ TextureFactory + art/ (dessin procédural) · AvatarView (sprite, nom, bulles)             │
└──────────────┬─────────────────────────────────┬──────────────────────────┬──────────────┘
               │ utilise                         │ utilise                  │ utilise
┌──────────────▼──────────┐   ┌──────────────────▼──────────┐   ┌───────────▼──────────────┐
│ src/world (pur)         │   │ src/multiplayer             │   │ src/services             │
│ WorldModel, validateMap │   │ protocol (validation)       │   │ stockage local versionné │
│ PlayerController, depth │   │ NetworkClient (débit, quota)│   │ profil, réglages,        │
└──────────────┬──────────┘   │ Transport : Offline,        │   │ progression              │
               │              │ BroadcastChannel, (serveur) │   └──────────────────────────┘
┌──────────────▼──────────┐   └─────────────────────────────┘
│ src/core (pur)          │   ┌─────────────────────────────┐
│ iso, collision, A*,     │   │ src/content (DONNÉES)       │
│ rotation, texte, store  │   │ cartes JSON, catalogue,     │
└─────────────────────────┘   │ avatars, objectifs, textes  │
                              └─────────────────────────────┘
```

### Séparation demandée → emplacement

| Responsabilité              | Emplacement                                                            |
| --------------------------- | ---------------------------------------------------------------------- |
| Moteur de rendu             | `src/game/` (Phaser) + `src/game/art/` (dessin canvas pur)             |
| Logique du jeu              | `src/core/`, `src/world/` (sans Phaser ni DOM, testée)                 |
| Interfaces utilisateur      | `src/ui/` (Preact)                                                     |
| Données du monde            | `src/content/` (cartes JSON versionnées, catalogue)                    |
| Connexion / comptes         | v0.1 : profil local (`src/services/profile.ts`) ; v0.2 : Supabase Auth |
| Communications multijoueurs | `src/multiplayer/` (interface `Transport` remplaçable)                 |
| Personnalisation            | `src/content/avatars.ts` + éditeur `src/ui/AvatarEditor.tsx`           |
| Persistance                 | `src/services/storage.ts` (local) ; v0.2 : base de données             |
| Modération / administration | prévu v0.2+ (voir SECURITY.md, DATABASE.md)                            |
| Fonctions communautaires    | données dans `src/content/`, panneaux dans `src/ui/panels/`            |

## 3. Flux principaux

**Démarrage.** `main.ts` affiche l’interface Preact (≈ 25 Ko gzip). Si aucun profil n’existe,
l’écran d’accueil propose de créer son personnage. Phaser (le plus gros fichier) n’est chargé
qu’ensuite (`import()` dynamique), puis `WorldScene` construit le Hub.

**Boucle de jeu (WorldScene.update).**

1. Lecture clavier (ignorée si l’interface a le focus) → `PlayerController.update`.
2. Arrivée à destination → exécution de l’action en attente (interagir, s’asseoir).
3. Mise à jour des avatars (cadre d’animation, position, profondeur).
4. Indice d’interaction, zone courante, objectifs.
5. `NetworkClient.updateLocal` : envoi de l’état si nécessaire (débit limité).
6. Synchronisation des stores pour l’interface (10 fois par seconde).

**Profondeur isométrique.** Objets statiques : centre de l’empreinte. Avatars : contraints devant
ou derrière les meubles voisins selon leur position (`src/world/depth.ts`), ce qui gère les meubles
longs. Assis : juste devant ou derrière le siège selon son orientation.

## 4. Performances

| Mesure                                 | Valeur v0.1                                      |
| -------------------------------------- | ------------------------------------------------ |
| JS chargé avant création du personnage | ≈ 25 Ko gzip (+ 3 Ko CSS)                        |
| JS total après entrée dans le monde    | ≈ 400 Ko gzip, dont Phaser 357 Ko (mis en cache) |
| Images téléchargées                    | 0 (graphismes procéduraux)                       |
| Textures du Hub                        | quelques atlas 2048² + ~20 blocs de sol          |

Leviers : qualité basse (textures ×1, sans ombres ni halos, 30 i/s), limite d’images par seconde,
réduction des animations. Voir [TESTING.md](TESTING.md) pour les mesures et leur protocole.

## 5. Ajouter du contenu

- **Un objet** : `src/content/catalog.ts` (empreinte, blocage, assises, interaction, lumière) +
  `src/game/art/objects.ts` (dessin) → visible dans `/art-preview.html`.
- **Une salle / une zone** : modifier ou ajouter une carte JSON dans `src/content/maps/` et
  l’enregistrer dans `src/content/world.ts`. Format décrit dans [WORLD_DESIGN.md](WORLD_DESIGN.md).
- **Un panneau d’interface** : ajouter l’id dans `PANEL_IDS` (`src/world/types.ts`) et le composant
  dans `src/ui/panels/`.

## 6. Évolution prévue (v0.2)

Voir [REALTIME_NETWORK.md](REALTIME_NETWORK.md), [DATABASE.md](DATABASE.md) et
[FREE_INFRASTRUCTURE.md](FREE_INFRASTRUCTURE.md) : Cloudflare Pages (site), Worker + Durable Object
(temps réel, une instance par salle ou groupe de salles), Supabase (comptes, profils, logements,
règles d’accès RLS). La couche `Transport` permet d’ajouter le transport serveur sans modifier le
rendu ni la logique du monde.
