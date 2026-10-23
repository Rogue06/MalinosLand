# Architecture

> **En bref (version simple)** : le jeu est écrit en TypeScript. Le moteur **Phaser** affiche le monde, **Preact** affiche les menus et le chat, et la « logique » (déplacements, collisions, règles) est rangée à part pour être testée facilement. Le contenu (salles, objets, textes) est séparé du code du moteur, pour que chacun puisse en ajouter sans tout comprendre.

> Dernière mise à jour : v0.2 en cours (serveur temps réel prêt en local, pas encore en ligne). Les décisions détaillées et leurs motivations sont
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

**Évolution validée le 23/10/2026 :** les chênes, sakuras et le modèle « Malino 3D » utilisent
trois atlas PNG précalculés dans Blender, plus un masque de matière (1,70 Mo au total).
`bakedArt.ts` les injecte dans `TextureFactory` ; `voxelTint.ts` applique les quatre couleurs
de l'apparence aux pixels avant la mise en cache par palette (DEC-034) ;
le reste du décor et l'avatar classique restent procéduraux. Les images sont partagées entre
exemplaires, avec repli procédural si le chargement échoue. Le champ borné `look.model` choisit
le modèle (0 classique, 1 Malino 3D par défaut), sans supprimer les autres réglages du profil.
Phaser reste en 2D : aucun `.blend`, modèle 3D ou moteur 3D n'est téléchargé par les joueurs.

À l'origine, tous les graphismes (objets, murs, sols, personnages) étaient **dessinés par le code** au chargement
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
               │              │ BroadcastChannel, Server    │   └──────────────────────────┘
┌──────────────▼──────────┐   └─────────────────────────────┘
│ src/core (pur)          │   ┌─────────────────────────────┐
│ iso, collision, A*,     │   │ src/content (DONNÉES)       │
│ rotation, texte, store  │   │ cartes JSON, catalogue,     │
└─────────────────────────┘   │ avatars, objectifs, textes  │
                              └─────────────────────────────┘
```

### Séparation demandée → emplacement

| Responsabilité              | Emplacement                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Moteur de rendu             | `src/game/` (Phaser) + `src/game/art/` (dessin canvas pur)                                                                      |
| Logique du jeu              | `src/core/`, `src/world/` (sans Phaser ni DOM, testée)                                                                          |
| Interfaces utilisateur      | `src/ui/` (Preact)                                                                                                              |
| Site d’accueil              | Dépôt privé `MalinosLand-accueil` (`index.html` + `src/landing/`), copié à la mise en ligne (DEC-023, DEC-026)                  |
| Données du monde            | `src/content/` (cartes JSON versionnées, catalogue)                                                                             |
| Connexion / comptes         | `src/services/account.ts` (Supabase Auth, chargé à la demande), `src/ui/AccountBox.tsx` ; visiteurs : `src/services/profile.ts` |
| Communications multijoueurs | `src/multiplayer/` (interface `Transport` remplaçable) + `server/`                                                              |
| Personnalisation            | `src/content/avatars.ts` + éditeur `src/ui/AvatarEditor.tsx`                                                                    |
| Persistance                 | `src/services/storage.ts` (local) ; profils en base : `supabase/migrations/`                                                    |
| Modération / administration | prévu v0.2+ (voir SECURITY.md, DATABASE.md)                                                                                     |
| Fonctions communautaires    | données dans `src/content/`, panneaux dans `src/ui/panels/`                                                                     |

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

## 6. Le serveur temps réel (v0.2)

```
navigateur ── WebSocket ──► Worker (server/src/index.ts) ──► Durable Object « monde-1 »
 ServerTransport            /health, /ws, contrôle Origin     (server/src/WorldRoom.ts)
                                                                       │
                                                       RealtimeHub (server/src/hub.ts, pur)
```

- **`server/`** est un petit paquet npm séparé (outil Wrangler et types Cloudflare) : les joueurs
  et les contributeurs qui ne touchent pas au serveur n’installent rien de plus.
- **Une seule instance** du Durable Object pour tout le monde en v0.2 (« monde-1 ») : elle connaît
  la salle de chaque joueur et ne relaie mouvements et chat de proximité qu’à la même salle.
  Découpage par groupe de salles plus tard si besoin.
- **`RealtimeHub`** contient toutes les règles (validation, anti-usurpation, anti-téléportation,
  limites de débit, budget du jour) sans dépendre de Cloudflare : il est testé par Vitest comme
  le reste du jeu. Il réutilise le protocole du client (`src/multiplayer/protocol.ts`).
- **Côté jeu**, `ServerTransport` est choisi seulement si `VITE_REALTIME_URL` est défini
  (`src/config.ts`) ; il se reconnecte tout seul (attente croissante) et respecte les refus du
  serveur (salle pleine, maintenance…). La CSP est générée au build pour autoriser cette adresse.

**Comptes (v0.2).** `src/services/account.ts` charge les clients Supabase (`@supabase/auth-js`,
`@supabase/postgrest-js`, ≈ 28 Ko gzip) **seulement** pour un joueur connecté ou qui se connecte ;
les visiteurs ne les téléchargent pas. Le jeu attend de savoir si le joueur est connecté avant de
démarrer (l’identifiant réseau en dépend), puis le Worker vérifie le jeton auprès de la base.
Voir [COMPTES.md](COMPTES.md).

Détails : [REALTIME_NETWORK.md](REALTIME_NETWORK.md). Restent à venir : Cloudflare Pages (mise en
ligne), Supabase (comptes, profils, logements, règles d’accès RLS) — voir
[DATABASE.md](DATABASE.md) et [FREE_INFRASTRUCTURE.md](FREE_INFRASTRUCTURE.md).
