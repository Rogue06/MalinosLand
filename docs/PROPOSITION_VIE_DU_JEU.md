# Proposition : donner envie de venir, de rester et de revenir

> **En bref** : document de réflexion **avant tout code**, à valider par le responsable. Il
> propose un petit fil d’histoire (Joshua et les « étincelles »), une récompense douce gagnée en
> jouant (jamais achetée, jamais comparée aux autres), des secrets avec indices et sauvegardés sur
> le compte, et davantage de moments partagés entre joueurs. Rien n’est décidé : les questions
> ouvertes sont à la fin.

Statut : **proposition** (24/10/2026). Aucune ligne de code n’a été écrite pour ce document.

## 1. Ce qu’on constate aujourd’hui

- Le monde est joli et vivant, mais on en fait vite le tour : **peu de raisons de revenir**.
- Les **10 secrets** existent tous et sont tous accessibles (vérifié), mais **rien n’aide à les
  chercher** : le compteur « 0/10 » ne donne aucun indice. Résultat : on a l’impression qu’il en
  manque.
- Secrets et objectifs sont **gardés dans le navigateur seulement** : changer d’ordinateur ou de
  téléphone les fait perdre, même avec un compte.
- Entre joueurs : chat, petits signes, invitations. Peu de choses **à faire ensemble**.
- La connexion Google n’apporte pas encore assez de raisons concrètes (personnage partout,
  logement).

## 2. Un fil d’histoire léger (le « lore »)

Une histoire courte, drôle et bienveillante, qui parle de curiosité et d’IA, et qui donne du sens
à ce qu’on fait dans le jeu. Proposition :

**Joshua et les étincelles.** Joshua, le petit robot d’accueil, a construit MalinosLand pour
rassembler les Malinos. Il fonctionne aux **étincelles** : chaque fois qu’un Malino découvre,
partage ou aide, une étincelle s’allume. Avec assez d’étincelles, Joshua peut **rallumer les
étages de la Tour** (logements, Galerie, salle des événements…), restés dans le noir.

- Chaque secret révèle **une page du carnet de Joshua** : un petit morceau d’histoire (pourquoi
  Pixel le chat dort au salon, qui a enterré la capsule du chantier, ce que voit le télescope…).
- Le jeu raconte la suite **au fil des versions** : l’ouverture d’un nouvel étage devient un
  moment fêté ensemble, pas une simple mise à jour.
- Ton : humour léger, clins d’œil aux passionnés d’IA, jamais moqueur, compréhensible par tous.

> À compléter avec la culture de la communauté Renaud Dekode (vocabulaire, rendez-vous, blagues
> internes) : la session n’a pas pu ouvrir le site (accès réservé), voir les questions §8.

## 3. Une récompense douce : les « étincelles » ✨ (nom à choisir)

L’idée du responsable : des jetons gagnés en jouant, pour personnaliser son logement ou plus tard
jouer aux bornes d’arcade. Cela **change un principe fondateur** (« pas de monnaie ni de course aux
points », GAME_DESIGN.md) : c’est une décision du responsable. Pour en garder l’esprit :

**Garde-fous proposés**

1. **Jamais d’argent réel.** On ne pourra jamais acheter d’étincelles, ni les échanger entre
   joueurs (pas de commerce, pas d’arnaque possible).
2. **Rien d’essentiel n’est payant.** Le catalogue de meubles actuel reste entièrement gratuit ;
   les étincelles ajoutent des **bonus** (couleurs rares, meubles spéciaux, plus grand studio).
3. **Pas de classement** ni de compteur visible par les autres : c’est une récompense
   personnelle, pas une compétition.
4. **Facile à gagner** : quelques jours de visites tranquilles suffisent pour un premier bonus.
5. **Plafond par jour**, pour que personne ne « farme » et que la base reste dans les quotas
   gratuits.
6. **Différent de DEKODE** : aucun nom, interface ou mécanique repris (règle du projet).

**Comment on en gagne** (chiffres indicatifs)

| Action                                                    | Gain       | Limite          |
| --------------------------------------------------------- | ---------- | --------------- |
| Première visite du jour                                   | 5          | 1 par jour      |
| Temps passé dans le monde (onglet actif, pas « absent »)  | 1 / 10 min | 6 par jour      |
| Objectif « Premiers pas » rempli                          | 10         | une fois chacun |
| Secret découvert                                          | 15         | une fois chacun |
| Recevoir un visiteur chez soi / rendre visite à un invité | 2          | 3 par jour      |
| Moment partagé (voir §5 : trinquer, check, papoter assis) | 1          | 5 par jour      |
| Idée envoyée dans la boîte à idées                        | 5          | 1 par jour      |

**À quoi elles servent** (par ordre de priorité proposé)

1. **Logement** : couleurs exclusives, meubles spéciaux (aquarium, néon, plante géante…),
   papier peint et sol, puis **agrandir le studio** (deuxième pièce, balcon).
2. **Titres et badges** à côté du pseudo, liés à la découverte (« Explorateur », « Chasseur de
   secrets »), sans classement.
3. **Jetons d’arcade** quand les mini-jeux arriveront (v0.5) : une partie = un jeton.
4. Décorations de saison (Halloween, Noël…) pendant un temps limité.

**Avec ou sans compte ?** Les visiteurs voient le principe mais les étincelles ne se gardent
qu’**avec un compte** : c’est une vraie raison de se connecter avec Google.

**Sécurité et quotas** : le solde est tenu **par la base** (Supabase, offre gratuite), jamais
par le navigateur ; chaque gain passe par une fonction de la base qui applique les plafonds. Le
temps passé est mesuré par le serveur temps réel (il le sait déjà pour l’historique des
connexions). Quelques écritures par joueur et par jour : largement dans les quotas gratuits.
Tricher ne rapporterait que des bonus décoratifs, plafonnés.

## 4. Les secrets : chercher, comprendre, garder

- **Carnet de Joshua** (dans la fenêtre des objectifs) : chaque secret non trouvé affiche une
  **devinette** (« Là où l’eau fait des ronds, quelque chose flotte… ») ; trouvé, il donne sa page
  d’histoire.
- **Sauvegarde sur le compte** : secrets et objectifs suivent le joueur sur tous ses appareils.
- **Nouveaux secrets** à chaque nouvel espace, et un **secret de la semaine** qui change (une
  raison de revenir).
- Un petit **effet de découverte** (étincelles, son) et un message au chat : « ✨ Tu as trouvé un
  secret ! »

## 5. Plus de moments entre joueurs

Des interactions simples, qui ne demandent pas de connaissances techniques :

- **Trinquer** au comptoir à café à plusieurs ☕, **se taper dans la main** quand deux joueurs
  font le même signe côte à côte, **papoter** assis ensemble sur un canapé : petites animations
  et une étincelle partagée.
- **Livre d’or du logement** : les visiteurs laissent un petit mot (court, filtré, signalable).
- **Amis** : deux joueurs qui se sont invités deviennent amis ; on est prévenu quand un ami se
  connecte, et on peut le rejoindre d’un clic (s’il l’accepte).
- **Rendez-vous** : « l’heure du café » à heure fixe et un tableau des événements (lives,
  présentations de projets).
- **Défi collectif** : toute la communauté rassemble des étincelles pour rallumer le prochain
  étage de la Tour (barre de progression commune dans le hall).
- Plus tard : **mini-jeux** sur les bornes d’arcade, **Galerie** pour exposer ses projets IA.

## 6. Ordre proposé (petits lots, chacun utile seul)

| Lot | Contenu                                                                            | Taille |
| --- | ---------------------------------------------------------------------------------- | ------ |
| A   | Secrets et objectifs sauvegardés sur le compte ; carnet de Joshua avec devinettes  | petit  |
| B   | Étincelles : gains et solde (sans rien à dépenser encore), plafonds dans la base   | moyen  |
| C   | Boutique du logement : couleurs et meubles exclusifs, puis agrandissement          | moyen  |
| D   | Moments partagés (trinquer, check, papoter) et livre d’or                          | moyen  |
| E   | Histoire : pages du carnet, défi collectif « rallumer la Tour », amis              | moyen  |
| —   | Puis la v0.4 prévue (étages, Galerie, annuaire), qui s’intègre dans cette histoire | grand  |

## 7. Ce qui ne change pas

Gratuit pour toujours, sans publicité, sans achat, open source, léger, respectueux de la vie
privée (aucune nouvelle donnée personnelle : seulement un solde et des secrets trouvés).

## 8. Questions pour le responsable

1. **Monnaie** : d’accord pour revenir sur le principe « pas de monnaie », avec les garde-fous du
   §3 ? Quel nom : **Étincelles**, **Pépites**, **Malicoins**, autre ?
2. **Histoire** : le fil « Joshua et les étincelles » te plaît-il ? Un autre ton (plus mystère,
   plus humour) ?
3. **Communauté Renaud Dekode** : quels mots, rituels, rendez-vous ou blagues internes
   aimerais-tu retrouver dans le jeu ? (copier-coller la présentation de la communauté suffit.)
4. **Priorité** : commencer par le lot A (secrets + carnet, le plus rapide), ou directement les
   étincelles ?
