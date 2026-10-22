# Plan d’évolution : donner envie de venir, de rester et de revenir

> **En bref (version simple)** : un audit de ce qui existe, puis un plan en **petites pull
> requests** pour trois priorités qui vont ensemble : un **panneau « Que faire maintenant ? »**
> près de Joshua (savoir quoi faire), un **Quiz IA** sur une borne d’arcade (s’amuser tout de
> suite, même seul) et le **Musée des Malinos** (découvrir les créations de la communauté). Tout
> reste gratuit : les deux premiers ne touchent ni au serveur ni à la base. **Rien n’est codé
> avant la validation du responsable** (§9 : décisions à prendre).

Rédigé le 22/10/2026 à la demande du responsable (Rogue06), à partir de `AGENTS.md`,
`SESSION_HANDOFF.md`, `PROJECT_VISION.md`, `ROADMAP.md`, `FEATURE_BACKLOG.md`,
`PROPOSITION_VIE_DU_JEU.md`, `FREE_INFRASTRUCTURE.md`, du code et de la carte du Hub, et des pistes
proposées par ChatGPT (panneau, quiz, musée, coworking, feu de camp, agenda, mesures).

---

## 1. Audit : ce qui existe aujourd’hui

### 1.1 Fonctionnalités en ligne

| Domaine        | Ce qui marche                                                                                                                              | Ce qui manque pour la rétention                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Monde          | Hub 48 × 38, 12 zones, 302 objets, ambiance sonore, vie du décor (oiseaux, fontaine), **jour et nuit à l’heure de Paris**                  | Beaucoup d’objets n’ont qu’une phrase (« prévu en v0.5 ») : rien à refaire    |
| Accueil        | Joshua (humeurs, répliques, visite guidée), 8 objectifs « Premiers pas », panneau de bienvenue, charte                                     | **Une fois les objectifs finis, plus aucune piste** : c’est le trou principal |
| Secrets        | 10 secrets, **carnet de Joshua** avec devinettes, sauvegarde sur le compte                                                                 | Aucun renouvellement : une fois trouvés, terminé                              |
| Social         | Multijoueur, chat (tout le monde / autour), émotes, absent, mentions, masquer / signaler, rôles visibles (doré, 🛡️)                        | Peu d’actions à faire **ensemble** ; rien qui donne un rendez-vous            |
| Studios (v0.3) | Logement par compte, accès privé / invitation / public, invitations en direct, éditeur de décoration (21 meubles), visites par l’ascenseur | Les studios ouverts sont peu visibles (seulement dans l’ascenseur)            |
| Contribution   | Boîte à idées, borne à bugs, modération (signalements, idées)                                                                              | **Aucun moyen de montrer ses créations** dans le monde                        |
| Activités      | Ronde des champignons (danse, musique), feu de camp (secret), ping-pong / baby-foot / échecs / arcade = **une phrase d’attente**           | Aucune activité rejouable                                                     |
| Mesures        | Historique des connexions sur 90 jours (responsable seulement)                                                                             | Aucun résumé (retours à 7 jours, durée des sessions)                          |

### 1.2 Les lieux et leur potentiel (sans construire de salle vide)

| Lieu (zone)                        | Aujourd’hui                                                              | Proposition                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Hall (`hall`)                      | Joshua, tapis, panneau de bienvenue, tableau de la feuille de route      | **Écran « Que faire maintenant ? »** près du tapis et de Joshua                              |
| Salle de jeux (`games`)            | 2 bornes d’arcade « INSERT COIN », jeux de table « v0.5 »                | **Borne 1 → Quiz IA** ; la seconde garde le code secret                                      |
| Galerie (`gallery`, « bientôt »)   | Salle **déjà construite** à côté du hall : 4 socles, 3 cimaises, cordons | **Première salle du Musée des Malinos** (v0.4) : pas de nouvelle salle à remplir             |
| Chantier (`site`, « bientôt »)     | Barrières, échafaudages ; texte périmé (« futurs logements »)            | **Promesse visible** : « Futur Bâtiment des créations » (agrandissement du musée)            |
| Coworking (`coworking`)            | 4 ordinateurs, 3 étagères : phrases d’attente                            | Ordinateurs → **fiches de ressources** choisies par la communauté (contenu du dépôt)         |
| Forêt et feu de camp (`forest`)    | Feu, rondins (sans interaction), ronde des champignons, lucioles la nuit | S’asseoir sur les rondins, **histoires de Joshua** qui changent, guitare (lot E déjà validé) |
| Salle de conférence (`conference`) | Scène, 14 sièges, panneau « aucun événement »                            | Reste « **Événements — bientôt (v0.5)** » ; agenda préparé, pas ouvert                       |

### 1.3 Écarts relevés dans la documentation (à corriger en PR 1)

- `ROADMAP.md` et `FEATURE_BACKLOG.md` ne mentionnent ni le carnet, ni Joshua vivant, ni les
  rôles, ni le jour et la nuit (F34 est fait, F23 en partie).
- Zone `site` : « Les futurs logements des Malinos (v0.3) » alors que les logements existent ;
  panneau du chantier et télescope parlent encore de la Tour en v0.4.
- `SESSION_HANDOFF.md` : la liste « Prochaines étapes » date de la v0.3.

### 1.4 Ce qui joue en notre faveur

- Le jeu sait déjà **guider un avatar** jusqu’à un objet (`walkTo`, chemin A\*) : un bouton
  « Y aller » ne demande rien de neuf.
- Les **panneaux** (Preact), la **modération** (🛡️), les **rôles** et la base testée par PGlite
  sont réutilisables tels quels pour le musée.
- Le **quiz** et le **panneau** peuvent fonctionner entièrement dans le navigateur.

---

## 2. Ressources gratuites : ce que coûte chaque idée

Quotas relevés dans `FREE_INFRASTRUCTURE.md` (à re-vérifier avant chaque mise en ligne) :
Workers 100 000 requêtes/jour ; Durable Objects 100 000 requêtes/jour (messages entrants comptés
1 pour 20) et 13 000 Go·s/jour ; Supabase 500 Mo de base, ≈ 1 Go de fichiers, ≈ 5 Go de sortie
par mois, 50 000 utilisateurs actifs/mois. Sur ces offres, un dépassement **bloque** au lieu de
facturer.

| Fonctionnalité                   | Serveur temps réel                        | Base Supabase                                                      | Fichiers                        | Verdict                             |
| -------------------------------- | ----------------------------------------- | ------------------------------------------------------------------ | ------------------------------- | ----------------------------------- |
| Panneau « Que faire ? »          | 0                                         | 1 lecture à l’ouverture (studios ouverts, nouveautés), cache 5 min | 0                               | Très léger                          |
| Quiz IA solo                     | 0                                         | 0 (questions dans le jeu ; meilleur score dans le navigateur)      | +≈ 15 Ko de questions           | Très léger                          |
| Musée : fiches                   | 0                                         | ≈ 1 Ko par projet (1 000 projets = 1 Mo sur 500) ; listes de 20    | 0 (affiches dessinées)          | Léger                               |
| Musée : miniatures (option)      | 0                                         | 0                                                                  | ≈ 40 Ko WebP : 25 000 sur 1 Go  | À surveiller (sortie mensuelle)     |
| Musée : démo intégrée            | 0                                         | 0                                                                  | 0 : servi par le site du membre | Gratuit pour nous ; vie privée (§6) |
| Ressources du coworking          | 0                                         | 0 (fichier du dépôt, proposé par pull request ou boîte à idées)    | +≈ 10 Ko                        | Très léger                          |
| Feu de camp (histoires, rondins) | 0                                         | 0                                                                  | 0                               | Très léger                          |
| Guitare entendue par les autres  | 1 message court par note jouée (plafonné) | 0                                                                  | 0                               | À plafonner                         |
| Mesures de fréquentation         | 0 de plus                                 | 0 (calculées depuis l’historique des 90 jours existant)            | 0                               | Aucun coût                          |

**Règle de conception** (reprise telle quelle) : aucune opération périodique côté serveur si un
calcul local, un cache ou une action du joueur suffit ; ne jamais affaiblir le budget quotidien,
la file d’attente ni le mode maintenance.

---

## 3. Liste priorisée des fonctionnalités

Complexité : **S** (≤ 1 jour de travail), **M** (2–3 jours), **L** (une semaine). Priorités du
responsable : **P1** le trio panneau + quiz + musée ; **P2** valoriser l’existant ; **P3** préparer.

| #   | Fonctionnalité                                                      | Version | Prio | Complexité | Dépend de    | Backend touché            |
| --- | ------------------------------------------------------------------- | ------- | ---- | ---------- | ------------ | ------------------------- |
| 1   | Finitions v0.3 et remise à jour de la documentation                 | 0.3     | P1   | S          | —            | Non                       |
| 2   | Panneau « Que faire maintenant ? » (écran du hall + bouton 🧭)      | 0.35    | P1   | M          | 1            | Lecture seule existante   |
| 3   | Quiz IA des Malinos (borne d’arcade, solo, défi de la semaine)      | 0.35    | P1   | M          | —            | Non                       |
| 4   | Mesures de fréquentation pour le responsable                        | 0.35    | P2   | S          | —            | Non                       |
| 5   | Musée : base des projets (soumission, modération, retrait)          | 0.4     | P1   | M          | rôles (fait) | Migration Supabase        |
| 6   | Musée : formulaire « Exposer mon projet » + onglet modération       | 0.4     | P1   | M          | 5            | Non                       |
| 7   | Musée : ouverture de la galerie, stands, fiche, démo sécurisée      | 0.4     | P1   | L          | 5, 6         | En-tête de sécurité (CSP) |
| 8   | Chantier = « Futur Bâtiment des créations » ; nouveautés au panneau | 0.4     | P2   | S          | 2, 7         | Non                       |
| 9   | Coworking : ressources de la communauté sur les ordinateurs         | 0.45    | P2   | S          | 2            | Non                       |
| 10  | Feu de camp : rondins, histoires de Joshua, guitare                 | 0.45    | P2   | M          | —            | 1 message réseau plafonné |
| 11  | Secret de la semaine (rotation locale, indice au carnet)            | 0.45    | P2   | S          | 2            | Non                       |
| 12  | Studios ouverts mis en avant (panneau, ascenseur)                   | 0.45    | P2   | S          | 2            | Non                       |
| 13  | Agenda : modèle préparé, annoncé « Bientôt (v0.5) »                 | 0.5     | P3   | S          | 2            | Non (pas encore)          |
| 14  | Coins coins 🦆 (bonus cosmétiques)                                  | 0.6     | P3   | M          | 3, 7         | Migration Supabase        |

> **Coins coins** : le lot D était le suivant prévu. Je propose de le **décaler en v0.6** : les
> joueurs ont d’abord besoin de quelque chose à faire (panneau, quiz, musée), et les Coins coins
> n’auront de sens qu’avec des choses à débloquer. À confirmer (§9).

---

## 4. Détail et critères d’acceptation

### 4.1 Finitions v0.3 (PR 1)

- Textes périmés corrigés (zone `site`, panneau du chantier, télescope, bornes et jeux « v0.5 »
  harmonisés) ; `ROADMAP.md`, `FEATURE_BACKLOG.md` et `SESSION_HANDOFF.md` à jour (v0.35 / v0.4).
- Liste de **tests à faire en ligne par le responsable** (jamais faits par la session) :
  décoration vue par un 2ᵉ compte, Turnstile en navigation privée, rôles entre deux comptes.

**Accepté si** : aucun texte du jeu n’annonce une chose déjà faite ou datée à tort ; documentation
cohérente ; `npm run check` et le test de bout en bout passent.

### 4.2 Panneau « Que faire maintenant ? » (PR 2, PR 3)

- **Où** : un écran mural dessiné (nouvel objet `board_activities`, style du jeu) près du tapis
  MalinosLand et de Joshua, et un bouton 🧭 dans la barre du haut. Joshua y renvoie : « Tu ne sais
  pas quoi faire ? Regarde l’écran à côté de moi. »
- **Contenu** : **4 à 5 suggestions au plus**, calculées dans le navigateur par une fonction pure
  et testée (`suggestActivities`) à partir de ce que le jeu sait déjà :
  1. le défi de la semaine du quiz, s’il n’est pas fait ;
  2. le prochain objectif « Premiers pas » non rempli, sinon un secret non trouvé (avec sa
     devinette) ;
  3. les studios ouverts à la visite (lecture existante `visitable_homes`, en cache) ;
  4. « N Malinos sont au feu de camp / dans la salle de jeux » (présence déjà connue) ;
  5. un clin d’œil selon l’heure (« Il fait nuit : les lucioles sont sorties dans la forêt ») ;
  6. plus tard : nouveautés du musée, prochain événement (« bientôt » tant qu’il n’y en a pas).
- **Action** : chaque suggestion a un bouton **« Y aller »** (l’avatar marche jusqu’à l’objet,
  ou l’ascenseur pour un studio) ou **« Ouvrir »** (quiz, carnet).

**Accepté si** : un nouveau joueur voit au moins 3 suggestions utiles dès son arrivée ; un joueur
qui a tout fini voit encore le quiz, les studios ou les présents ; chaque bouton mène au bon
endroit (test de bout en bout) ; utilisable au clavier et au doigt ; aucune requête réseau en
plus à l’arrivée (seulement à l’ouverture, au plus une toutes les 5 minutes).

### 4.3 Quiz IA des Malinos (PR 4, PR 5)

- **Où** : la borne `arcade-jeux-1` de la salle de jeux devient « Quiz IA ». La seconde garde le
  code secret de la borne. La borne du salon reste décorative.
- **Partie** : 5 questions à 4 choix, une **explication** après chaque réponse, score et petite
  animation de fin. Deux modes : **partie libre** (tirage au hasard) et **défi de la semaine**
  (les mêmes 5 questions pour tout le monde, choisies d’après le numéro de la semaine : rien à
  stocker, aucun serveur).
- **Questions** : fichiers de contenu dans le dépôt (`src/content/quiz/`), environ **60 pour
  commencer**, en français, sur des notions durables (histoire de l’IA, vocabulaire, bons usages,
  outils, culture numérique) plutôt que sur l’actualité qui vieillit vite. Chaque question a une
  explication et, si possible, une source. **Rédigées par la session, à relire par le responsable
  et les modérateurs** avant d’être publiées ; la communauté peut en proposer par pull request.
- **Scores** : meilleur score et défi fait gardés dans le navigateur (et sur le compte avec la
  progression déjà existante). Pas de classement public au départ (§9).

**Accepté si** : jouable seul en moins de 2 minutes, au clavier (touches 1 à 4), à la souris et
au doigt ; lisible par un lecteur d’écran (questions et résultat annoncés) ; le défi de la
semaine est identique pour tous et change le lundi ; tests du tirage et du défi ; aucune requête
réseau pendant la partie.

### 4.4 Mesures de fréquentation (PR 6, petite)

Dans la page « Historique des connexions » du responsable, un résumé calculé depuis le journal de
90 jours **déjà existant** : visiteurs uniques par jour, part des joueurs revenus après 7 jours,
durée médiane des visites. Aucune nouvelle collecte, aucun outil externe, aucune donnée de
déplacement ni de conversation.

**Accepté si** : les chiffres correspondent à un jeu d’essai (tests) ; rien de nouveau n’est
enregistré ; seul le responsable y a accès (déjà vérifié par le serveur).

### 4.5 Musée des Malinos (PR 7 à PR 10)

**Où** : la **galerie déjà construite** à côté du hall (4 socles, 3 cimaises) ouvre comme
première salle du musée. Le chantier reste en travaux et annonce le **Futur Bâtiment des
créations**, qui accueillera l’agrandissement quand il y aura assez de projets. Ainsi, pas de
grande salle vide.

**Exposer un projet** (compte obligatoire) : titre (60 caractères), résumé (280), adresse
`https://` uniquement, catégorie (site, application, outil IA, jeu, création, open source),
3 mots-clés au plus. Au plus 3 projets en attente et 10 exposés par membre. Le projet part **en
attente de validation** ; l’auteur le retire quand il veut.

**Modération** (onglet du panneau 🛡️ déjà existant) : valider, refuser (avec un motif court),
retirer, cocher « démo intégrable » après l’avoir essayée. Les visiteurs peuvent **signaler** un
projet.

**Visiter** : chaque stand affiche une **affiche dessinée par le jeu** (couleur de la catégorie,
icône, titre) : aucune image à héberger. Une borne « Toutes les créations » liste et filtre par
catégorie. La fiche montre titre, auteur, catégorie, résumé, et :

- **« Ouvrir le site »** dans un nouvel onglet (avec avertissement « site externe ») ;
- **« Essayer ici »** seulement si un modérateur l’a marqué intégrable : la démo se charge **sur
  clic uniquement**, dans une fenêtre isolée (`sandbox`, aucune information de provenance), avec
  un rappel que le site tiers reçoit l’adresse IP du visiteur. Beaucoup de sites refusent d’être
  intégrés : ils restent en « Ouvrir le site ».

**Sécurité** (règles de la base, testées comme le reste) : seuls les projets validés sont visibles
de tous ; l’auteur voit les siens ; seuls les modérateurs changent le statut ; adresses vérifiées
(https, pas d’adresse locale ni d’IP privée) ; MalinosLand n’est **jamais** un intermédiaire
(pas de proxy, pas de copie de site).

**Accepté si** : un membre expose un projet, un modérateur le valide, tout le monde le voit sur un
stand et dans la liste ; un projet refusé ou retiré disparaît ; un visiteur ne peut rien écrire ;
la démo ne se charge jamais sans clic ; tests de la base (droits, limites, adresses) et test de
bout en bout (stand → fiche → lien).

### 4.6 Valoriser l’existant (PR 11 à PR 14)

- **Coworking** : les ordinateurs ouvrent la **ressource du jour** et un petit catalogue (outils
  IA, tutoriels, logiciels libres) tiré d’un fichier du dépôt ; propositions via la boîte à idées
  ou une pull request. Rien de généré par IA, rien de récupéré automatiquement sur Internet.
- **Feu de camp** : s’asseoir sur les rondins ; **histoires de Joshua** qui changent chaque jour
  (suite de son mystère, en petits chapitres) ; la guitare du lot E (notes entendues par les
  présents, plafonnées).
- **Secret de la semaine** : un secret « mis en lumière » chaque semaine avec un indice au
  carnet, sans stockage.
- **Studios ouverts** : mis en avant dans le panneau et l’ascenseur.

**Accepté si** : chaque lieu propose une action qui change d’un jour ou d’une semaine à l’autre,
sans requête réseau supplémentaire (sauf la guitare, plafonnée par le serveur).

### 4.7 Agenda (préparé, pas ouvert)

La salle de conférence et le panneau affichent « Événements communautaires — bientôt (v0.5) ».
Le modèle (titre, date, lien de visio externe, organisateur autorisé, validation) est décrit dans
ce document, **sans migration** tant que la communauté ne le demande pas.

---

## 5. Découpage en petites pull requests

Chaque PR est indépendante, testée (`npm run check`, test de bout en bout), documentée
(CHANGELOG, SESSION_HANDOFF) et **fusionnée seulement avec l’accord du responsable**.

| PR  | Contenu                                                                             | Taille | Backend                   |
| --- | ----------------------------------------------------------------------------------- | ------ | ------------------------- |
| 1   | Finitions v0.3 : textes périmés, documentation, liste de tests en ligne             | S      | —                         |
| 2   | Panneau « Que faire ? » : moteur de suggestions (testé), panneau, bouton 🧭         | M      | —                         |
| 3   | Écran du hall dessiné + réplique de Joshua + étape du test de bout en bout          | S      | —                         |
| 4   | Quiz : moteur (tirage, défi de la semaine, score), panneau accessible, 30 questions | M      | —                         |
| 5   | Quiz : borne de la salle de jeux, 30 questions de plus, suggestion au panneau       | S      | —                         |
| 6   | Mesures de fréquentation du responsable                                             | S      | —                         |
| 7   | Musée : migration `projects` + règles + tests PGlite                                | M      | Migration (après accord)  |
| 8   | Musée : « Exposer mon projet », « Mes projets », onglet de modération               | M      | —                         |
| 9   | Musée : ouverture de la galerie, stands, affiches, fiche, liste                     | M      | —                         |
| 10  | Musée : démo intégrée sur clic (CSP `frame-src`, `sandbox`) + signalement           | S      | En-tête de sécurité       |
| 11  | Chantier « Futur Bâtiment des créations » + nouveautés du musée au panneau          | S      | —                         |
| 12  | Coworking : ressources du jour                                                      | S      | —                         |
| 13  | Feu de camp : rondins, histoires, guitare                                           | M      | 1 message réseau plafonné |
| 14  | Secret de la semaine + studios ouverts mis en avant                                 | S      | —                         |

Ordre proposé : **1 → 2 → 3 → 4 → 5** (v0.35, sans toucher au serveur ni à la base), puis **6**,
puis **7 → 8 → 9 → 10 → 11** (v0.4, musée), puis **12 → 14** (v0.45).

---

## 6. Sécurité, confidentialité, accessibilité

- Tout texte venu d’un joueur (projets, motifs de refus) passe par `sanitizeText` ; aucun HTML
  interprété ; liens en `rel="noopener noreferrer"`.
- Démo intégrée : chargement **sur clic**, `sandbox` restreint, `referrerpolicy="no-referrer"`,
  avertissement de confidentialité ; politique de sécurité (CSP) élargie **seulement** pour les
  cadres (`frame-src https:`), le reste inchangé.
- Droits du musée vérifiés **par la base** (règles RLS et fonctions), jamais seulement dans
  l’interface ; modération avant publication, signalement et retrait.
- Accessibilité : panneaux au clavier (Tab, Échap, touches 1–4 au quiz), annonces pour lecteurs
  d’écran, contrastes du thème, animations coupées si « réduire les animations ».

---

## 7. Comment saura-t-on que ça marche ?

Après la v0.35, faire jouer un petit groupe, puis regarder (PR 6) : part des nouveaux qui
lancent une activité, durée médiane des visites, part des joueurs qui reviennent après 7 jours.
Après la v0.4 : nombre de projets exposés et de fiches ouvertes (compteur simple côté base,
facultatif). Si le quiz plaît mais que personne ne revient : renouveler les questions plus
souvent. Si le musée est visité mais sans échanges : mettre en avant les auteurs et leurs studios.

---

## 8. Ce que je ne ferais pas

- Pas d’IA conversationnelle payante pour Joshua ni pour générer des questions.
- Pas de récompenses à la minute ni de progression obligatoire (pas de « farming »).
- Pas de nouvelles salles vides : le musée commence dans la galerie existante.
- Pas de récupération automatique de contenus sur Internet.

---

## 9. Décisions à prendre par le responsable

1. **Ordre** : PR 1 → 5 (v0.35) puis le musée (v0.4) ? Coins coins décalés en v0.6 ?
2. **Musée, lieu** : la galerie existante comme première salle, le chantier comme promesse ?
3. **Musée, images** : affiches dessinées par le jeu (aucun fichier) au départ, miniatures plus
   tard si besoin ?
4. **Musée, démo intégrée** : n’importe quel site `https` validé par un modérateur (sur clic,
   isolé), ou seulement quelques hébergeurs connus (GitHub Pages, Cloudflare Pages, Vercel,
   Netlify) ?
5. **Quiz** : scores seulement personnels au départ, ou petit tableau amical du défi de la
   semaine ?
6. **Quiz, questions** : d’accord pour que je rédige le premier lot, relu par toi ou un
   modérateur avant publication ?
