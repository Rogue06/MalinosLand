# Conception du jeu

> **En bref (version simple)** : on se déplace, on utilise des objets, on discute. Pas de monnaie ni de course aux points : les petits objectifs servent seulement à découvrir le lieu. Pour la prise en main, voir le [guide du joueur](GUIDE_DU_JOUEUR.md).

## Expérience recherchée

Un nouvel arrivant doit comprendre en moins d’une minute **où il est**, **comment bouger**,
**comment interagir** et **ce qui arrive bientôt**. L’ambiance est chaleureuse et conviviale :
on vient pour rencontrer, montrer, découvrir, pas pour accumuler des points.

## Commandes

| Action                | Souris / tactile                          | Clavier                                                    |
| --------------------- | ----------------------------------------- | ---------------------------------------------------------- |
| Se déplacer           | Clic sur le sol (chemin calculé)          | ZQSD (AZERTY), WASD (QWERTY), flèches                      |
| Interagir / s’asseoir | Clic sur l’objet (le personnage s’y rend) | `E` ou `Espace` à proximité                                |
| Se lever              | —                                         | `E`, ou se déplacer                                        |
| Discuter              | Champ du chat                             | `Entrée`, puis `Entrée` pour envoyer, `Échap` pour quitter |
| Zoomer                | Molette                                   | —                                                          |
| Fermer une fenêtre    | Clic hors de la fenêtre, ✕                | `Échap`                                                    |

Les touches « haut/bas/gauche/droite » suivent l’écran (haut = vers le fond du bâtiment).

## Mécaniques de la v0.1

- **Déplacement** : 3,4 tuiles/s, glissement le long des obstacles, chemin A* lissé (8 directions,
  sans couper les coins). Indicateur de destination au sol.
- **Interactions** (données dans la carte et le catalogue) :
  - _dialogue_ : personnage ou panneau qui parle (Joshua, chantier, galerie, borne d’arcade…) ;
  - _panneau_ : bienvenue, feuille de route, ascenseur, astuce IA, événements, miroir (avatar) ;
  - _émote_ : café ☕, fontaine ✨ ;
  - _assise_ : chaises, fauteuils, canapés, bancs, transats (places multiples, occupation gérée).
- **Indice contextuel** en bas de l’écran : « E · Parler à Joshua », « E · S’asseoir »…
- **Objectifs « Premiers pas »** (8) : guident la découverte ; aucune récompense marchande.
- **Chat** : un seul fil ; on choisit à qui l’on écrit : _Tout le monde_ (par défaut) ou
  _Autour_ (à moins de 8 cases, bulle au-dessus de la tête ; toute la pièce dans un logement) ;
  anti-spam (5 messages d’affilée puis 1 toutes les 2 s) ; 140 caractères max.
- **Émotes** : 👋 ☕ ✨ 😄 👍 (liste fermée, transmise en démo multi-onglets).
- **Zones** : nom affiché en haut, mini-carte en bas à gauche ; les zones « bientôt » indiquent la
  version prévue.

## Principes d’interface

- HUD minimal : logo et version, zone actuelle, présence, 5 boutons (objectifs, avatar, feuille de
  route, aide, réglages), mini-carte, chat. Les objectifs se masquent.
- Pas de compteur de monnaie, d’abonnés ou de « notoriété » (contrairement à la référence DEKODE).
- Toute fenêtre se ferme avec Échap ; le clavier du jeu est désactivé pendant la saisie.
- Textes en français clair, tutoiement chaleureux.

## Personnalisation de l’avatar

Choix fermés (sécurité et légèreté) : 3 silhouettes, 6 teintes de peau, 8 coiffures, 8 couleurs de
cheveux, 10 hauts, 6 bas, 3 accessoires, plus 6 styles prêts à porter et un tirage au hasard.
Modifiable à tout moment via le miroir du salon ou le bouton 🧑.

## Pistes pour les versions suivantes

- Animation « assis au bureau » avec écran allumé, mini-jeux à la borne d’arcade (v0.5).
- Statut de disponibilité (« disponible », « concentré », « en réunion ») sur la fiche profil (v0.2).
- Fiche profil en cliquant sur un autre joueur ; inviter quelqu’un dans son logement (v0.3).
- Sons d’ambiance légers et désactivables (non prévus en v0.1 pour rester léger).
