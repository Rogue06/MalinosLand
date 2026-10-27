# Chantier des mondes (prototype du bac à sable en cubes)

> **En bref.** Un vrai petit jeu de construction en cubes, à part du Hub : on creuse, on récolte,
> on fabrique ses outils et on bâtit, en **première personne** ou en **vue isométrique** (au
> choix du joueur). Gameplay inspiré des jeux de construction en cubes ; textures, noms et
> dessins propres à MalinosLand. C’est le **palier B0** du
> [cahier des charges](CAHIER_DES_CHARGES_VILLAGE.md) (§13) : un prototype **solo**, gardé dans
> le navigateur, sur une page à part (`/chantier/`) que le jeu ne relie pas encore. Moteur 3D :
> Three.js (DEC-043).

![Écran d’accueil : survie douce ou créatif](images/chantier-accueil.jpg)

## L’essayer

- **En local** : `npm run dev`, puis <http://localhost:5173/chantier/>.
- **En ligne** (si le responsable autorise la mise en ligne de cette page) :
  `https://malinosland.pages.dev/chantier/`. Elle n’est reliée à rien dans le jeu et n’est pas
  indexée par les moteurs de recherche.

Deux modes, deux mondes séparés (ce qu’on obtient en créatif ne passe jamais en survie) :

- **Survie douce** : on part les mains vides. Ni monstres, ni faim, ni perte d’objets.
- **Créatif** : tous les cubes à volonté, on casse en un clic, on peut voler (double Espace ou
  F) et annuler (Ctrl+Z).

## Jouer

Les touches sont celles des jeux de construction en cubes les plus connus (sur un clavier
français, ZQSD remplace WASD automatiquement). Elles se **changent** dans le menu → ⌨️ Touches.
Pour monter sur un cube, il faut **sauter**. Échap met le jeu en pause et ouvre le menu ; en
fermant le sac ou le menu, on reprend la main tout de suite.

| Action                               | Clavier et souris                                                               | Au doigt                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Marcher, sauter, courir, s’accroupir | ZQSD / WASD ou flèches, Espace, Ctrl ou double Z, Maj (on ne tombe pas du bord) | Manette à gauche, ⤒                                      |
| Regarder (1re personne)              | Souris (clic pour « attraper » la souris, Échap pour la libérer)                | Glisser l’écran                                          |
| Creuser                              | Clic gauche **maintenu**                                                        | ⛏ maintenu (1re personne) ; ⛏ puis toucher un cube (iso) |
| Poser (le cube choisi dans la barre) | Clic droit, ou Ctrl + clic                                                      | 🧱 (1re personne) ; 🧱 puis toucher une face (iso)       |
| Choisir dans la barre                | 1 à 9, molette                                                                  | Toucher une case                                         |
| Sac et fabrication                   | E (ou clic droit sur un établi / un four)                                       | 🎒 Sac                                                   |
| Changer de vue                       | F5 ou V                                                                         | 👁                                                        |
| Prendre le cube visé                 | Clic molette                                                                    | —                                                        |
| Voler (créatif)                      | Double Espace ou F ; Espace monte, Maj descend                                  | —                                                        |
| Tourner / zoomer (iso)               | R, molette                                                                      | ⟲ ⟳, deux doigts                                         |

![En première personne](images/chantier-premiere-personne.jpg)

![En vue isométrique](images/chantier-iso.jpg)

En vue isométrique, quand le personnage passe sous un toit ou sous terre, les couches du dessus
disparaissent : on voit toujours son étage (coupe automatique).

## Tutoriel

En survie douce, une carte en haut à gauche guide les premiers pas : regarder, marcher, couper
un tronc, fabriquer des planches puis un établi, la pioche en bois, creuser de la pierre et
construire. Chaque étape se valide toute seule quand on l’a faite. On peut le passer, et le
revoir depuis le menu (« 📘 Revoir le tutoriel »).

## Ce qu’on y fait (survie douce)

1. **Couper un arbre** (clic maintenu sur un tronc) : un petit cube de tronc tombe au sol ; il
   arrive dans le sac (« pop ») quand on passe à côté. Les objets au sol restent tant qu’on ne vient
   pas les chercher.
2. **Fabriquer** dans le sac : planches, bâtons, puis un **établi** à poser près de soi.
3. À l’établi : **pioche en bois**, puis **pioche en pierre** (on creuse bien plus vite), un
   **four**.
4. Sous terre, dans les **grottes** : du **charbon** (torches, verre et briques au four) et du
   **cristal** (il faut une pioche en pierre), pour la **pioche de cristal** et les blocs
   turquoise. Les grottes et les maisons fermées sont sombres : les **torches** éclairent.
5. **Construire** : 15 sortes de cubes (herbe, terre, pierre, planches, tronc, feuillage, verre,
   sable, briques, turquoise, corail, établi, four…), et les torches.

![Le sac et la fabrication](images/chantier-sac.jpg)

12 recettes au total. Une fabrication vérifie tout avant de retirer quoi que ce soit : elle ne
peut ni dupliquer ni perdre d’objets. Le terrain fait **64 × 64 cubes au sol et 32 de haut**,
avec un socle incassable et une **dalle de départ protégée** au centre (bouton « Revenir au
départ » dans le menu si l’on est coincé).

## Sauvegarde et limites gratuites

- La partie est gardée **dans le navigateur** (rien n’est envoyé) : seules les
  **modifications** du terrain sont enregistrées (le terrain de départ se recalcule à
  l’identique), plus le sac et la position. Quelques centaines de Ko au plus.
- Aucune ressource en ligne n’est utilisée : pas de serveur, pas de base, pas de quota consommé.

## Mesures (prototype)

| Mesure                           | Valeur                     | Remarque                                                                                                              |
| -------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Poids de Three.js                | 531 Ko (132 Ko compressés) | Chargé **seulement** sur `/chantier/`, fichier à part (en cache ensuite)                                              |
| Poids de la page du jeu de cubes | 43 Ko (16 Ko compressés)   | Plus 6 Ko de styles                                                                                                   |
| Images par seconde               | ≈ 14                       | Mesuré **sans carte graphique** (rendu logiciel de la session) : à mesurer sur une vraie machine et un vrai téléphone |
| Triangles affichés               | ≈ 75 000                   | Seules les faces visibles sont dessinées ; le monde est découpé en 16 tranches                                        |

Le menu « 📊 Mesures » affiche ces chiffres en jouant.

## Ce qui n’est pas fait (volontairement, pour ce prototype)

- **Jouer à plusieurs** (B2) et sauvegarde **en ligne** (B1) : le monde est solo et local.
- Eau, nuit, monstres, faim, coffres, objets qui s’usent : rien de tout cela pour l’instant.
- La lumière est simplifiée (ciel, ombre sous les toits, torches à portée), pas une vraie
  propagation.
- Pas de lien depuis le Hub : un portail viendra au palier B4, si le prototype plaît.

## Ce que le responsable a décidé (26/10)

- Vue préférée : la **3D à la première personne** (la vue isométrique reste disponible).
- Graphismes : validés (« top »).
- Intégration future dans le Hub (palier B4) : un **lore** pour faire la transition vers la 3D, en
  rapport avec l’IA. Piste du responsable : les **bornes d’arcade** de la salle de jeux, avec de
  vieux jeux (Pong…) et un décor assorti ; l’une d’elles ouvrirait le Chantier des mondes.

## Questions pour la suite (au responsable)

1. Laquelle des deux vues donne le plus envie : première personne, isométrique, ou les deux ?
2. Le rythme de la survie douce (temps pour casser, recettes) : trop lent, trop rapide ?
3. Prochaine étape : jouer à plusieurs dans le même monde (B1 + B2), ou plus de contenu solo
   (nuit, coffres, nouvelles recettes) ?

## Pour les développeurs

`src/sandbox/` : `world.ts` (terrain, règles, lancer de rayon), `player.ts` (déplacements),
`inventory.ts` (sac et recettes), `mesh.ts` (maillages, lumière) : logique pure, testée par
`tests/sandbox.test.ts`. `textures.ts`, `game.ts` (Three.js, caméras, commandes), `main.ts`
(interface), `sfx.ts` (bruitages Web Audio). Ajouter `?debug` à l’URL expose
`window.__chantier()` (la partie en cours) pour les tests de bout en bout.
