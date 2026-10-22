# Proposition : donner envie de venir, de rester et de revenir

> **En bref** : la feuille de route « vie du jeu », décidée avec le responsable. Une histoire
> (Joshua, un robot doté d’une vraie IA… qui cache un mystère), des **Coins coins** 🦆 gagnés en
> jouant pour se sentir chez soi (jamais achetés, jamais comparés), des secrets avec indices et
> sauvegardés sur le compte, un **jour et une nuit** à l’heure française, des **photos et une
> télé YouTube** dans son studio, un **écran de la communauté** dans le Hub, une **guitare** au
> coin du feu et beaucoup de petits moments à partager. On avance par petits lots (§9).

Statut : **validé dans les grandes lignes** par le responsable (25/10/2026) ; chaque lot sera
détaillé avant d’être codé. Rien de ce document n’est encore dans le jeu, sauf mention contraire.

## 1. Ce qu’on constate aujourd’hui

- Le monde est joli et vivant, mais on en fait vite le tour : **peu de raisons de revenir**.
- Les **10 secrets** existent et sont tous accessibles (vérifié), mais **rien n’aide à les
  chercher**, et ils sont **gardés dans le navigateur seulement** (perdus en changeant
  d’appareil, même avec un compte).
- Entre joueurs : chat, petits signes, invitations. Peu de choses **à faire ensemble**.
- Les sons d’ambiance du hall et de la salle de jeux étaient continus et pénibles : **corrigé**
  (PR #35).

## 2. L’histoire : le mystère de Joshua

**Joshua** est le robot d’accueil de MalinosLand, et il est doté d’une **vraie intelligence
artificielle**. Il a construit la ville pour rassembler les Malinos. Il fonctionne aux
**étincelles** : chaque fois qu’un Malino découvre, partage ou aide, une étincelle s’allume, et
avec assez d’étincelles Joshua peut **rallumer les étages de la Tour** restés dans le noir
(logements, Galerie, salle des événements…).

**Le mystère** : Joshua fait parfois des choses que personne ne lui a apprises. Il fredonne quand
il croit qu’on ne l’écoute pas, ses antennes changent de couleur selon son humeur, il griffonne
dans un carnet… Il commence peut-être à se forger **sa propre personnalité**, son « aura ».

- **Le carnet de Joshua** : chaque secret trouvé en révèle une page (ce qu’il pense de Pixel le
  chat, pourquoi il a enterré une capsule au chantier, ce qu’il regarde au télescope…).
- **La quête « Le mystère de Joshua »** traverse les objectifs, par chapitres : plus la
  communauté rallume d’étages, plus on en apprend. Fin ouverte, et drôle : un jour, Joshua
  choisira peut-être lui-même… la couleur de ses antennes, son plat préféré, ou une blague
  qu’il répète à tout le monde.
- **Clin d’œil** pour les passionnés d’IA : comme l’ordinateur d’un célèbre film des années 80,
  notre Joshua adore les jeux (« On fait une partie ? »).
- **Dans le jeu** : ses **antennes bougent** (quand il parle, quand on s’approche, au repos), et
  leur couleur suit son humeur du moment.
- Ton : humour léger et bienveillant, compréhensible par tous.

## 3. Les Coins coins 🦆

Pas une vraie monnaie : un petit **système d’appartenance** et de **récompense** pour donner
envie de découvrir. Le nom est un clin d’œil au canard.

**Garde-fous**

1. **Jamais d’argent réel** : on ne peut ni en acheter, ni en échanger entre joueurs.
2. **Rien d’essentiel n’est payant** : le catalogue de meubles actuel reste gratuit ; les Coins
   coins débloquent des **bonus**.
3. **Pas de classement** ni de compteur visible par les autres : c’est personnel.
4. **Faciles à gagner**, avec un **plafond par jour** (quotas gratuits respectés).
5. **Rien de repris de DEKODE** (nom, interface, mécanique).

**Comment on en gagne** (chiffres indicatifs, à régler en jouant)

| Action                                                      | Gain       | Limite          |
| ----------------------------------------------------------- | ---------- | --------------- |
| Première visite du jour                                     | 5          | 1 par jour      |
| Temps passé dans le monde (onglet actif, pas « absent »)    | 1 / 10 min | 6 par jour      |
| Objectif rempli                                             | 10         | une fois chacun |
| Secret découvert                                            | 15         | une fois chacun |
| Recevoir un visiteur chez soi / rendre visite à un invité   | 2          | 3 par jour      |
| Moment partagé (§7 : trinquer, check, jouer de la guitare…) | 1          | 5 par jour      |
| Idée envoyée dans la boîte à idées                          | 5          | 1 par jour      |

**À quoi ils servent** : couleurs et meubles spéciaux pour le studio, papier peint et sol,
**agrandir son studio** ; titres et badges à côté du pseudo ; **jetons d’arcade** quand les
mini-jeux arriveront ; décorations de saison. Les Coins coins se gardent **avec un compte** :
une vraie raison de se connecter avec Google.

**Technique** : solde et plafonds tenus **par la base** (Supabase, offre gratuite), jamais par le
navigateur ; temps de présence mesuré par le serveur temps réel. Quelques écritures par joueur et
par jour.

## 4. Les secrets : chercher, comprendre, garder

- **Carnet de Joshua** : une **devinette** pour chaque secret non trouvé (« Là où l’eau fait des
  ronds, quelque chose flotte… ») ; trouvé, il donne sa page d’histoire et des Coins coins.
- **Sauvegarde sur le compte** : secrets et objectifs suivent le joueur partout.
- **Nouveaux secrets** à chaque nouvel espace et un **secret de la semaine** qui change.
- Petit effet de découverte (étincelles, son, message au chat).

## 5. Jour et nuit, à l’heure française

Le ciel et la lumière suivent l’**heure réelle de Paris** : aube rosée, plein jour, coucher de
soleil orangé, nuit bleutée.

- La nuit dehors : lumière bleu nuit, **réverbères et fenêtres allumés**, étoiles, lucioles dans
  la forêt, feu de camp qui éclaire les visages ; les oiseaux dorment, on entend les grillons.
- À l’intérieur : lampes allumées le soir, ambiance plus feutrée.
- Calculé dans le navigateur (aucun coût d’hébergement) ; réglage « toujours de jour » pour qui
  préfère ; doux pour les machines modestes (une teinte et quelques halos, pas d’effet lourd).

## 6. Mon studio, plus personnel

- **Photos en tableaux** : une ou deux photos accrochées au mur. Réduites dans le navigateur
  (environ 60 Ko chacune) et rangées dans le stockage gratuit de Supabase : 1 000 membres × 2
  photos ≈ 120 Mo, bien sous la limite gratuite (1 Go). Visibles seulement par ceux qui peuvent
  entrer, et **signalables** aux modérateurs.
- **Télé YouTube** avec une mini-playlist (jusqu’à 5 liens) : la vidéo est lue **depuis
  YouTube** (rien n’est stocké chez nous), en mode « sans cookie », et seulement quand on appuie
  sur lecture. Plus tard : **regarder ensemble** (lecture et pause synchronisées pour les
  présents, par un tout petit message réseau).
- Les deux seront ajoutés à la politique de confidentialité (photos rangées chez Supabase ;
  YouTube reçoit l’adresse IP de qui lance une vidéo).

## 7. Plus de moments entre joueurs

Déjà prévus : trinquer au café, se taper dans la main, papoter assis, livre d’or du logement,
amis prévenus quand on se connecte, défi collectif « rallumer la Tour ». Et en plus :

- **La guitare du feu de camp** 🎸 : on la prend, on joue des accords (quelques boutons ou les
  touches 1 à 6) ; le son est fabriqué par le jeu (aucun fichier) et **les joueurs autour
  l’entendent**. À plusieurs autour du feu, ça devient un petit concert.
- **L’écran de la communauté** dans le Hub (salle de conférence) : il diffuse une vidéo choisie
  par le responsable ou les modérateurs (un live, la dernière vidéo de Renaud…), par simple lien
  YouTube.
- **Statut** à côté du pseudo : « dispo pour papoter », « je code », « en pause café », « je
  cherche de l’aide ».
- **Tables de discussion** : s’asseoir à une table du coworking ouvre un petit salon de chat
  « autour de la table », sur un thème (IA, code, projets…).
- **La question du jour de Joshua** : une petite question ou devinette sur l’IA ; tous ceux
  qui répondent gagnent un Coin coin, et les réponses s’affichent sur un panneau.
- **Avions en papier** : on écrit un mot court et on le lance, il atterrit quelque part dans le
  Hub et quelqu’un le ramasse (filtré, signalable).
- **Photo de groupe** : à plusieurs devant le panneau MalinosLand, un bouton prend une jolie
  photo souvenir (téléchargée sur son appareil, rien n’est stocké).
- **Parrainage** : faire venir un nouveau Malino rapporte des Coins coins aux deux.
- **Rejoindre un ami** d’un clic (s’il l’accepte), et le **suivre** en marchant.
- **Rendez-vous** : « l’heure du café » à heure fixe, tableau des événements (lives,
  présentations de projets).
- **Applaudir** pendant une présentation, **danser** sur la scène, **faire un vœu** en lançant
  un Coin coin dans la fontaine (le vœu s’affiche un instant).

## 8. Plus tard : des « expériences » à niveaux

Le responsable aimerait, à terme, une plateforme avec **plusieurs niveaux, des quêtes et des
mini-jeux**, dans l’esprit de _The Sandbox_ (mondes en cubes où l’on joue à des expériences
créées par d’autres). À garder de ce modèle : des **expériences** courtes (parcours, énigmes,
mini-jeux) avec niveaux et quêtes, puis des **outils pour que la communauté en crée**. À laisser
de côté : tout ce qui touche aux cryptomonnaies, aux NFT et à la vente de terrains (contraire à
nos principes de gratuité). Ce chantier vient **après** les lots ci-dessous (v1.0 et au-delà),
car il demande un vrai éditeur de niveaux.

## 9. Ordre proposé (petits lots, chacun utile seul)

| Lot | Contenu                                                                                    |
| --- | ------------------------------------------------------------------------------------------ |
| A   | Secrets et objectifs sauvegardés sur le compte ; carnet de Joshua avec devinettes          |
| B   | Joshua vivant : antennes qui bougent, humeur en couleur ; début de la quête de son mystère |
| C   | Jour et nuit à l’heure de Paris                                                            |
| D   | Coins coins : gains, solde, plafonds dans la base (sans rien à dépenser encore)            |
| E   | Guitare du feu de camp ; trinquer, check, papoter                                          |
| F   | Boutique du studio (couleurs, meubles spéciaux, agrandissement) ; titres                   |
| G   | Photos en tableaux et télé YouTube du studio ; écran de la communauté dans le Hub          |
| H   | Amis, statut, livre d’or, question du jour, avions en papier, défi « rallumer la Tour »    |
| —   | Puis v0.4 (étages, Galerie, annuaire) et, plus tard, les expériences à niveaux (§8)        |

## 10. Ce qui ne change pas

Gratuit pour toujours, sans publicité, sans achat, open source, léger, respectueux de la vie
privée.

## 11. Questions encore ouvertes

1. **Photos des studios** : d’accord pour qu’elles soient signalables et retirables par les
   modérateurs (obligatoire pour une communauté ouverte) ?
2. **Écran du Hub** : qui choisit la vidéo — toi seul, ou aussi les modérateurs ?
3. **Communauté Renaud Dekode** : la session n’a pas pu ouvrir le site (accès réservé aux
   membres). Copier-coller sa présentation, ses mots et ses rendez-vous aidera à écrire les
   pages du carnet de Joshua et la question du jour.
