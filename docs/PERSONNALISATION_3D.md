# Personnalisation du nouveau Malino

**En bref :** six styles de couleurs sont disponibles pour le Malino 3D, avec peau, cheveux,
veste et pantalon modifiables séparément. Même coupe et même tenue pour cette première série.
Un seul masque de couleur supplémentaire suffit ; aucun service de génération payant.

## Ce qui est disponible

Le modèle « Malino 3D » utilise la tenue validée, quatre orientations et quatre poses.
Le modèle « Classique personnalisable » conserve tous les choix existants. Le passage entre
les deux ne supprime aucun réglage. Les autres joueurs voient le modèle choisi.
Les styles Marine, Forêt, Soleil, Framboise, Lavande et Neige servent de points de départ.
Les palettes proposent 6 peaux, 8 couleurs de cheveux, 10 vestes et 6 pantalons, soit
2 880 combinaisons de couleurs. Les formes ne changent pas : l'éditeur explique que les autres
coiffures et accessoires restent disponibles avec le modèle classique.
Les quatre indices `voxelSkin`, `voxelHair`, `voxelTop`, `voxelBottom` sont indépendants des
anciens réglages. Ils sont sauvegardés et validés côté serveur dans le JSON d'apparence existant.

## Taille du travail

Les sélecteurs actuels contiennent 3 silhouettes, 6 peaux, 8 coiffures, 8 couleurs de cheveux,
10 couleurs de haut, 6 de bas, 4 accessoires et 3 barbes : **829 440 combinaisons**.
À 16 images par combinaison, un pré-rendu exhaustif représenterait 13 271 040 images.
À titre d'ordre de grandeur seulement, 829 440 atlas aussi lourds que l'avatar actuel
(765 345 octets) représenteraient environ 635 Go. Ce n'est pas une solution adaptée au projet.
Il n'existe pas encore de sélecteur de visage ou de coupe de vêtement : ce serait du contenu nouveau.

## Progression proposée

1. **Réalisé :** peau, cheveux, veste et pantalon séparés par un masque de matière. Le navigateur
   recolore les images en conservant leurs ombres et reflets ; les détails blancs restent fixes.
2. Modéliser quelques coiffures et accessoires réutilisables ; tester leur assemblage pour les
   quatre orientations, la marche et la position assise. L'occultation entre éléments demande
   une validation : les calques ne s'assemblent pas correctement par simple superposition.
3. Ajouter ensuite silhouettes, visages et types de vêtements par petits lots validés visuellement.

Blender et les rendus locaux n'impliquent aucun service payant. L'assistance à la conception,
au code et aux corrections consomme néanmoins le forfait ChatGPT ; aucune économie précise
de tokens n'a été mesurée. Réutiliser les composants et limiter chaque lot évite de refaire
un personnage complet à chaque demande. Les rendus automatiques se feront après validation
du lot, avec un compte rendu court.

## Hébergement actuel

Avatar : 765 345 octets ; masque : 315 411 ; chêne : 307 495 ; sakura : 307 384.
Total : **1 695 635 octets**, soit environ 1,70 Mo (+315 Ko pour toute la personnalisation).
Le navigateur réutilise les mêmes images pour tous les exemplaires.
Le poids des images ne se multiplie donc pas avec le nombre d'arbres. Les URLs de build sont
versionnées par leur contenu ; aucun fichier Blender n'est publié. L'éclairage et les pétales
sont fixes, et la fluidité sur des appareils physiques modestes reste à mesurer.

Les textures colorées sont calculées à la demande et partagées par palette, pas à chaque image
du jeu. Elles consomment de la mémoire graphique par palette présente ; aucune mesure sur
téléphone physique n'est encore disponible. L'aperçu de l'éditeur conserve au maximum 96 vues.

## Reproduire le masque et vérifier localement

Avec `npm run dev` ouvert sur le port 5173, puis dans un autre terminal (Blender dans le PATH) :

```sh
npm run prototype:export
blender --background --factory-startup --python-exit-code 1 --python scripts/render-voxel-blender.py -- art-source/voxel-models.json screenshots/avatar-masks avatar mask
npm run prototype:pack -- http://127.0.0.1:5173 mask
npm run check
npm run preview -- --host 127.0.0.1
```

Ouvrir `http://127.0.0.1:4173/jouer/`, puis « Mon avatar » → « Malino 3D ».
`npm run test:baked-art` teste les styles, la sauvegarde, le retour au classique et deux onglets.
`npm run test:online` vérifie aussi les couleurs chez un deuxième joueur via le vrai serveur
local (configuration décrite dans `AGENTS.md`). Les palettes ne lancent aucun rendu Blender.
