# Conception du monde

> **En bref (version simple)** : le monde est un grand bâtiment communautaire, le Hub, entouré d’un jardin. Chaque salle est décrite dans un fichier de données facile à lire (JSON) : une grille de sol, des murs, des zones et des objets placés. De nouveaux étages et salles s’ajouteront au fil des versions.

![Vue d’ensemble du Hub](images/hub-vue-ensemble.jpg)

## 1. Principe : un complexe communautaire, pas une ville vide

Le cœur de MalinosLand est un **bâtiment principal** (le Hub) entouré d’un jardin, qui s’étend
par ajouts successifs : étages de la Tour communautaire, terrasses, nouvelles ailes. On commence
petit et dense, puis on ouvre de nouvelles zones au fil des versions.

## 2. Le Hub (v0.1) — carte `hub`

Repère : **x** vers le bas-droite de l’écran, **y** vers le bas-gauche. Carte de 34 × 30 tuiles.

```
  x →  0         1         2         3
       0123456789012345678901234567890123
y  0   BBBBBBBBBBBBB#############gggggggg      B/# murs hauts (brique / enduit)
   1   Bwwwwwwwwwww=cccccccccccc=gggggggg      =   cloisons basses
   .   B   coworking  =  conférence   =  dddd  w   parquet (coworking)
   8   Bwwwwwwwwwww=cccccccccccc=gddddddg      c   moquette (conférence)
   9   B========hhhh==hh=========gddddddg      h   dalles (hall)
  10   #llllll=hhhhhhhhh=aaaaaaa=gddddddg      l   parquet chaud (salon)
   .   # salon  hhhh hall hhhh galerie  =      a   béton ciré (galerie)
  18   #llllll=hhhhhhhhh=aaaaaaa=gggppggg      d   terrasse en bois
  19   ============hh============gggppggg      g   herbe · p chemin · s chantier
  22   ggppppppppppppppppppppppppppppppgg
  25   gssssssssgggppgggppppggggggggggggg
  29   gggggggggggggggggggggggggggggggggg
```

| Zone (id)                          | Statut           | Contenu                                                                                             |
| ---------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------- |
| Hall d’accueil (`hall`)            | ouvert           | Joshua le robot, comptoir, panneau de bienvenue, tableau « Roadmap », ascenseur, tapis MalinosLand  |
| Espace coworking (`coworking`)     | ouvert           | 4 bureaux doubles, poste « Astuce IA du jour », table ronde, bibliothèques, fenêtres, tableau blanc |
| Salle de conférence (`conference`) | ouvert           | Scène, pupitre, écran géant, rangées de sièges (événements : v0.5)                                  |
| Salon détente (`lounge`)           | ouvert           | Canapés, fauteuils, comptoir à café, borne d’arcade, miroir, livres                                 |
| Galerie des Malinos (`gallery`)    | **bientôt v0.4** | Visible derrière une barrière à corde : socles, cimaises                                            |
| Terrasse (`terrace`)               | ouvert           | Tables à parasol, chaises, transats                                                                 |
| Chantier de la Tour (`site`)       | **bientôt v0.3** | Échafaudages, plots, panneau explicatif                                                             |
| Jardin (`garden`)                  | ouvert           | Fontaine, bancs, jardinières, arbres, réverbères, totem MalinosLand                                 |

Point d’apparition : devant l’entrée principale, face au bâtiment.

## 3. Format des cartes (v1)

Fichiers JSON dans `src/content/maps/`, typés par `MapFile` (`src/world/types.ts`) et validés par
`validateMap` (`src/world/validateMap.ts`).

```jsonc
{
  "formatVersion": 1,
  "id": "hub", // [a-z0-9-], unique
  "name": "Le Hub — rez-de-chaussée",
  "width": 34,
  "height": 30,
  "spawn": { "x": 12.9, "y": 21.5, "facing": "ny" },
  "legend": { "h": { "floor": "hall" }, "=": { "wall": "low", "floor": "hall" } },
  "tiles": ["…une chaîne par ligne y, un caractère par colonne x…"],
  "zones": [
    {
      "id": "hall",
      "name": "Hall d’accueil",
      "rect": { "x": 7, "y": 9, "w": 10, "h": 11 },
      "status": "open",
      "description": "…",
    },
  ],
  "objects": [
    {
      "type": "robot",
      "x": 11,
      "y": 15,
      "id": "joshua",
      "label": "Joshua",
      "rot": 0,
      "variant": 0,
      "interaction": { "kind": "dialog", "label": "Parler à Joshua", "lines": ["…"] },
    },
  ],
  "wallDecor": [{ "type": "window", "x": 2, "y": 0, "side": "py" }],
}
```

- **Sols** : `wood`, `lounge`, `hall`, `carpet`, `gallery`, `grass`, `path`, `deck`, `dirt`.
- **Murs** : `tall` (enduit, 2,6 de haut), `brick` (brique), `low` (cloison basse 0,8). Les murs se
  raccordent automatiquement à leurs voisins (et aux objets `connectsWalls` comme l’ascenseur).
- **Zones** : la première zone contenant le joueur gagne (mettre les zones précises avant la zone
  « fourre-tout » du jardin). `status: "soon"` + `plannedFor` pour les zones annoncées.
- **Objets** : `type` du catalogue, coin haut de l’empreinte en `x, y`, `rot` 0–3 (0 = regarde +y,
  1 = +x, 2 = −y, 3 = −x). Un objet interactif doit avoir un `id`.
- **Interactions** : `dialog` (lignes de texte), `panel` (ouvre un panneau d’interface), `emote`
  (émote + message). Champ `quest` facultatif pour valider un objectif.
- **Décors muraux** : uniquement sur une tuile de mur, face visible `py` (murs du haut) ou `px`
  (murs de gauche). Les décors larges sont ancrés sur leur tuile la plus à droite.

Évolution du format : toute modification incompatible incrémente `formatVersion` et ajoute une
fonction de migration ; les anciennes cartes restent lisibles.

### Vérifications automatiques (tests)

- Dimensions, caractères de légende, types d’objets, rotations, ids uniques.
- Aucun objet bloquant sur un mur ni sur un autre objet ; rien hors de la carte.
- Point d’apparition libre ; **toutes les zones ouvertes accessibles** depuis le départ.
- **Chaque objet interactif atteignable** (case d’approche libre et accessible).

## 4. La Tour communautaire (v0.3–v0.4) — conception prévue

- « Tour infinie » = **extensibilité logique** : chaque étage est une carte indépendante
  (`tower-1`, `tower-2`, …) chargée **à la demande** quand on l’atteint par l’ascenseur. Un seul
  étage est en mémoire à la fois.
- Un étage = un couloir + N logements (ex. 6). 100 membres ≈ 17 étages, sans coût tant qu’ils ne
  sont pas visités.
- Le logement d’un membre est une **petite carte** générée à partir d’un gabarit de pièce + une
  disposition de meubles stockée en base (JSON compact, voir [DATABASE.md](DATABASE.md)).
- L’ascenseur liste uniquement les étages et espaces **accessibles** (publics ou sur invitation) ;
  l’annuaire n’expose jamais les logements privés.
- Côté réseau, chaque étage/logement est une **salle** séparée : aucun trafic de mouvement entre
  salles.

## 5. Ajouter une zone ou une salle

1. Modifier `hub.json` (ou créer une nouvelle carte et l’enregistrer dans `src/content/world.ts`).
2. Ajouter la zone dans `zones` avec un statut honnête (`open` ou `soon`).
3. Placer objets et décors ; lancer `npm test` (validation + accessibilité).
4. Vérifier visuellement avec `npm run dev`.
5. Documenter le changement ici et dans le CHANGELOG.
