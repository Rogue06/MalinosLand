# Personnalisation du nouveau Malino

**En bref :** conserver un premier modèle validé et construire progressivement des éléments
réutilisables. Aucune nouvelle génération lancée pendant l'adoption du rendu, pour préserver
le forfait ChatGPT du responsable.

## Ce qui est disponible

Le modèle « Malino 3D » utilise la tenue validée, quatre orientations et quatre poses.
Le modèle « Classique personnalisable » conserve tous les choix existants. Le passage entre
les deux ne supprime aucun réglage. Les autres joueurs voient le modèle choisi.
L'apparence fixe du nouveau modèle est expliquée dans l'éditeur ; les sélecteurs classiques
ne sont affichés que lorsqu'ils ont un effet.

## Taille du travail

Les sélecteurs actuels contiennent 3 silhouettes, 6 peaux, 8 coiffures, 8 couleurs de cheveux,
10 couleurs de haut, 6 de bas, 4 accessoires et 3 barbes : **829 440 combinaisons**.
À 16 images par combinaison, un pré-rendu exhaustif représenterait 13 271 040 images.
À titre d'ordre de grandeur seulement, 829 440 atlas aussi lourds que l'avatar actuel
(765 345 octets) représenteraient environ 635 Go. Ce n'est pas une solution adaptée au projet.
Il n'existe pas encore de sélecteur de visage ou de coupe de vêtement : ce serait du contenu nouveau.

## Progression proposée

1. Séparer peau, cheveux et vêtements avec des masques de couleur pour varier les palettes
   dans le navigateur ; vérifier la qualité de l'éclairage avant d'adopter cette méthode.
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

Avatar : 765 345 octets ; chêne : 307 495 ; sakura : 307 384. Total : **1 380 224 octets**,
soit environ 1,38 Mo. Le navigateur réutilise les mêmes images pour tous les exemplaires.
Le poids des images ne se multiplie donc pas avec le nombre d'arbres. Les URLs de build sont
versionnées par leur contenu ; aucun fichier Blender n'est publié. L'éclairage et les pétales
sont fixes, et la fluidité sur des appareils physiques modestes reste à mesurer.
