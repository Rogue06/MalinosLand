# MalinosLand — Du monde à visiter au village IA que l’on fait vivre

> **En bref.** Cahier des charges remis par le responsable le 26 octobre 2026 : faire de
> MalinosLand un lieu où l’on revient (apprendre, créer, rencontrer), puis ouvrir d’autres
> « univers », à commencer par un bac à sable en cubes (creuser, construire, fabriquer).
> Texte conservé tel quel ci-dessous. L’état des lieux (étape 0) et le plan de réalisation
> sont dans [ETAT_DES_LIEUX.md](ETAT_DES_LIEUX.md). Rien de ce document n’est livré tant
> qu’une PR fusionnée ne le dit pas.

**Cahier des charges proposé — 26 octobre 2026**

Destinataire : Claude, pour préparer puis réaliser le développement par étapes.
Responsable : Rogue06. Dépôt : https://github.com/Rogue06/MalinosLand

Ce document est une proposition produit et technique. Aucun code du jeu n’a été modifié pour
le produire. Les idées ci-dessous ne sont pas des fonctionnalités déjà livrées. Elles ne
garantissent ni une croissance virale ni un taux de retour : les étapes servent à les tester.

**Ajout demandé le 26 octobre :** vision d’un village donnant accès à plusieurs univers,
dont un véritable bac à sable en cubes avec creusage, construction et craft. Lire la section 13
avant de planifier : elle complète la feuille de route et précise cette nouvelle priorité.

## 1. La demande du responsable

Aujourd’hui, des visiteurs se connectent, font le tour et repartent sans raison suffisante
de revenir. Le responsable souhaite une évolution ambitieuse, réalisable progressivement,
qui parle aussi aux personnes peu habituées aux jeux vidéo. La communauté est centrée sur
la technologie, surtout l’intelligence artificielle. La personnalisation et la construction
doivent contribuer à l’attachement au lieu, sans devenir des obligations de jeu.

Contraintes conservées : hébergement gratuit, aucune dépense engagée, petits lots vérifiables,
respect des choix classiques, réponses et interfaces simples. L’objectif n’est pas de tout
livrer d’un coup ni d’épuiser le forfait d’assistance IA.

## 2. Compréhension de la communauté

Site identifié : https://www.renaud-dekode.fr/

La présentation publique de Renaud Dékode associe compréhension des transformations de l’IA,
échanges, entraide, tutoriels et mise en pratique. La page publique du Think Tank évoque aussi
les apprentissages, automatisations, ateliers et projets du Klub. Les espaces réservés n’ont
pas été consultés ; l’ouverture directe du site n’a pas fourni une vue complète de ses pages.

Sources consultées :

- Présentation de l’émission : https://podcast.ausha.co/renauddekode
- Présentation publique du Think Tank : https://www.renaud-dekode.fr/c/think-tank
- Site : https://www.renaud-dekode.fr/

**Conséquence proposée :** MalinosLand devient un lieu de pratique et de rencontres qui
complète ces ressources. Il ne reproduit pas les cours privés, ne se présente pas comme un
service officiel de Renaud sans accord et ne suppose aucune connexion technique avec le Klub.
Les liens vers les ressources de Renaud renvoient à leurs pages d’origine et à leurs droits d’accès.

## 3. La promesse

> Viens avec une envie ou une question. Repars avec quelque chose que tu as appris ou créé,
> une personne avec qui échanger, et un endroit que tu as envie de retrouver.

Trois motifs de venue, accessibles dès l’accueil :

1. **Découvrir et comprendre** : une activité courte, une ressource contextualisée, un projet à essayer.
2. **Créer et progresser** : un projet personnel, un atelier guidé, un studio à aménager.
3. **Rencontrer et contribuer** : aider, demander un retour, visiter, participer à un rendez-vous.

Le monde doit avoir de la valeur quand on est seul. La présence d’autres membres enrichit
l’expérience ; elle ne conditionne pas la possibilité de faire quelque chose d’intéressant.

## 4. Les trois boucles à construire

### Boucle utile : apprendre → réaliser → partager → recevoir un retour → améliorer

Exemple : découvrir une méthode pour préparer un entretien avec un assistant IA, l’essayer
dans l’outil de son choix, exposer une fiche sans données personnelles, recevoir un retour
ciblé, revenir publier une version améliorée.

### Boucle créative : découvrir → aménager → ouvrir → être visité → transformer

Exemple : visiter un café créé par un membre, aménager son propre studio, l’inscrire au thème
« mon laboratoire de demain », découvrir les autres propositions, améliorer le sien.

### Boucle sociale : participer → reconnaître des personnes → prévoir une suite → revenir

Exemple : venir à une présentation de projets, rencontrer un membre qui cherche un testeur,
accepter une petite collaboration, retrouver son projet ou un prochain rendez-vous.

La diffusion extérieure vient ensuite : une création publique dispose d’un lien explicite,
partagé volontairement par son auteur, ouvrant directement sa présentation. Aucun message
automatique aux contacts, aucune récompense pour le démarchage ou les invitations en masse.

## 5. Point de départ à réutiliser

Examen en lecture seule d’`origin/main`, référence courte `3ef50fe`, le 26 octobre 2026.
Claude doit relire la version actuelle avant de travailler ; ces constats ne valent pas
vérification de toutes les fonctionnalités en production.

- Phaser 4 / TypeScript, interface Preact, monde isométrique et serveur temps réel existants.
- Comptes, profils, accès aux logements et invitations.
- Studios décorables : catalogue actuel de 21 types de meubles, plafond de 40 objets,
  catégories et certaines couleurs ; ne pas refaire cet éditeur de zéro.
- Personnage classique et Malino 3D ; six palettes prédéfinies et couleurs séparées pour le 3D.
- Premiers pas, carnet, secrets, quiz solo et défi hebdomadaire.
- Panneau « Que faire maintenant ? », présence et studios ouverts.
- Musée, soumission et modération de projets, démos et aperçus selon les dernières évolutions.
- Mesures de fréquentation et outils de modération.

Certains tableaux de documentation sont en retard sur les dernières sessions : le code,
les migrations et les PR fusionnées doivent départager les contradictions. La mise en ligne
du musée et ses aperçus demandent notamment une vérification fonctionnelle, pas une reconstruction.

## 6. Une entrée adaptée aux non-joueurs

### Deux façons équivalentes d’accéder au contenu

- **Le village** : se promener, rencontrer, visiter et interagir avec les lieux.
- **L’accès direct** : ouvrir les mêmes activités, projets, studios et événements depuis des cartes.

Pas deux applications : les deux chemins utilisent les mêmes données et panneaux. Sur mobile
ou connexion lente, l’accès direct doit rester pratique. Aucune fonctionnalité utile ne doit
exiger de connaître des touches de jeu ou de chercher longtemps un bâtiment.

À la première visite, proposer trois envies, sans questionnaire obligatoire : « Comprendre
l’IA », « Créer quelque chose », « Rencontrer les Malinos ». Un bouton permet de passer.
Le visiteur doit pouvoir obtenir une première petite réussite avant de devoir créer un compte,
dans les limites des fonctions actuellement disponibles aux visiteurs.

Au retour, présenter au plus trois cartes pertinentes : reprendre une création, voir un
nouveau retour, découvrir une activité ou un rendez-vous. Pas de mur d’icônes ni de fenêtres
imposées à chaque connexion.

### Navigation proposée

| Entrée             | Contenu                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| Aujourd’hui        | Reprendre, nouveautés choisies, prochain rendez-vous, activité courte   |
| Mon personnage     | Modèle, coiffures, couleurs, accessoires, tenues sauvegardées           |
| Chez moi           | Studio, décoration, construction, plans, ouverture aux visites          |
| Créer et apprendre | Ateliers, projets personnels, ressources pratiques, demandes de retour  |
| Découvrir          | Musée, studios, parcours, filtres débutant/thème/durée, favoris         |
| Communauté         | Présences, entraide, événements, contacts si cette fonction est ajoutée |

Le carnet et les réglages restent secondaires. Les intitulés définitifs sont à tester ; sur
mobile, regrouper ces entrées dans un menu plutôt que forcer six boutons permanents.

## 7. Les fonctionnalités qui donnent de la profondeur

### A. Chez moi : un endroit qui exprime quelque chose

Étendre progressivement l’éditeur existant : aperçu avant placement, manipulation claire,
rotation, couleurs, annuler/rétablir et duplication là où ces fonctions manquent. Ajouter des
sols et murs personnalisables, puis des cloisons, fenêtres et éclairages compatibles avec le moteur.

Prévoir des modèles de départ : café, jardin zen, studio de créateur, laboratoire IA, bibliothèque.
Le joueur peut changer de direction grâce à plusieurs plans sauvegardés, avec limites explicites.
La publication d’un studio est volontaire et distincte de la sauvegarde privée. Le studio public
peut être visité en l’absence du propriétaire, dans le respect de ses autorisations.

Plus tard : terrasse ou pièce supplémentaire chargée à la demande. Ne pas modifier librement
le Hub partagé lors de cette étape. Maintenir des limites d’objets et des passages praticables.

### B. Le personnage : une identité reconnaissable

Ajouter de vraies formes, pas seulement de nouvelles couleurs : premier petit lot de coiffures
visuellement différentes, puis lunettes, couvre-chefs et vêtements. Sélectionner avec le
responsable des styles variés avant de produire les images. Garder les deux modèles existants.

Prévoir quelques tenues sauvegardées et des émotes simples : saluer, remercier, applaudir.
Ne pas générer un atlas complet pour chaque combinaison ; valider l’assemblage, les occultations,
la marche et les quatre orientations sur un petit lot avant d’élargir le catalogue.

### C. Les ateliers IA : une activité concrète plutôt qu’une liste de liens

Chaque fiche contient : résultat attendu, niveau, durée indicative, prérequis, étapes courtes,
outil possible, limites et exemple de résultat. Prévoir une alternative quand un outil proposé
est payant. Le lancement de l’outil externe reste volontaire.

Exemples : préparer un prompt réutilisable ; vérifier une réponse et ses sources ; prototyper une
page ; concevoir une automatisation ; imaginer une affiche ; améliorer un document anonymisé.
Une activité de réflexion peut être accomplie sans compte externe ni appel d’IA.

Le résultat peut être une petite fiche ou un lien, pas obligatoirement un fichier hébergé.
L’IA est le sujet et l’outil choisi par le membre ; aucun assistant génératif payant n’est requis
dans MalinosLand. Ne pas demander de déposer des documents confidentiels dans le monde public.

### D. Les projets vivants : donner une suite au musée

Compléter les projets par un statut compréhensible — idée, prototype, recherche de testeurs,
publié — et une prochaine étape. Ajouter un appel précis : « Peux-tu tester sur mobile ? ».
Un historique court de mises à jour permet de montrer les progrès sans remplacer GitHub.

Commencer par des retours structurés et modérables : utile, problème rencontré, suggestion,
avec champ court si nécessaire. Les abonnements à un projet et notifications internes viennent
après ce premier flux. Prévoir signalement, retrait et plafonds avant les commentaires ouverts.

### E. Découverte et reconnaissance

Présenter nouvelles créations, thèmes et coups de cœur éditoriaux. Faire tourner les résultats
pour que les mêmes auteurs ne monopolisent pas l’accueil. Proposer des favoris privés.
Un compteur de clics n’est pas une preuve de qualité ; éviter le classement global de popularité.

Plus tard, une page partageable montre uniquement les informations que l’auteur a rendues publiques,
et permet au destinataire de découvrir la création sans parcours d’inscription préalable inutile.

### F. Rythme et rendez-vous

Un défi créatif hebdomadaire, un atelier accompagné et une présentation de projets sont des
formats possibles. Commencer avec un seul rendez-vous fiable plutôt qu’un agenda vide.
Chaque événement a un organisateur, une heure et un fuseau, une capacité, un descriptif et un
état annulé/terminé. Prévoir une version asynchrone du défi pour les personnes indisponibles.

L’application ne remplacera pas l’animation humaine : désigner qui accueille, sélectionne les
créations, publie un défi et modère les contributions. Recycler des thèmes et ressources validés
pour éviter une production permanente de nouveaux contenus.

### G. Progression choisie et collections

Parcours proposés : explorateur, créateur, bâtisseur, contributeur. Ils peuvent se cumuler et
ne représentent pas un classement de personnes. Objectifs visibles, réalisations conservées,
collections cosmétiques facultatives. Une base généreuse reste utilisable dès le départ.

Pas de perte de série après une absence, pas de récompense pour rester connecté sans agir,
pas de score fondé sur le nombre de messages. Une récompense partagée doit être validée côté
serveur et attribuée une seule fois. Reporter la monnaie virtuelle tant que des déblocages
directs suffisent ; un solde échangeable ajouterait fraude et complexité sans prouver son utilité.

### H. Une ambition de moyen terme : créer des expériences pour les autres

Un constructeur de petites salles jouables avec objets prédéfinis : indice, interrupteur,
porte, checkpoint et objectif. Les membres peuvent créer un escape game, une visite guidée
sur l’IA ou un parcours logique, sans programmer.

Commencer par une seule salle et quelques interactions autorisées. Publication séparée,
test du parcours, signalement et limites de taille. Aucun JavaScript, HTML ou script utilisateur
exécutable. La construction collaborative simultanée vient après la fiabilité du mode individuel.

## 8. Ordre de réalisation et critères de réussite

Une étape peut nécessiter plusieurs PR. Les priorités restent révisables selon les usages.

| Étape                       | Livraison limitée                                                         | Conditions pour la considérer terminée                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — État réel               | Audit fonctionnel ciblé et référence des mesures actuelles                | Distinguer livré, cassé, caché et proposé ; relever les limites de quotas ; aucune réécriture générale                                                   |
| 1 — Première valeur         | Accès direct aux fonctions existantes, trois envies et reprise de session | Une personne novice trouve une activité et la termine sans aide ; clavier et mobile utilisables ; pas de compte imposé avant une action qui le nécessite |
| 2 — Créer son lieu          | Amélioration de l’éditeur, premiers thèmes et sauvegarde fiable           | Poser/modifier/annuler/enregistrer/recharger sans perte ; aucun changement chez un autre membre ; limites et collisions validées                         |
| 3 — Découvrir les membres   | Studios publiés, filtres simples, favoris, liens vers le musée            | Un membre absent peut être découvert ; un studio privé reste privé ; changement d’accès immédiatement respecté                                           |
| 4 — Pratiquer l’IA          | Petit lot d’ateliers et fiche de résultat réutilisant le musée            | Chaque atelier est relu, compréhensible et réalisable avec ses prérequis annoncés ; pas d’API payante requise                                            |
| 5 — Recevoir une réponse    | Demandes de test et retours structurés, suivi de projets                  | Auteur informé dans le jeu ; signalement et retrait opérationnels ; quotas et anti-spam testés                                                           |
| 6 — Donner un rythme        | Premier défi thématique et agenda minimal                                 | Organisateur identifié, parcours inscription/participation/annulation clair ; alternative asynchrone ; état vide utile                                   |
| 7 — Identité et progression | Petit lot de coiffures/accessoires, tenues, déblocages choisis            | Rendu correct dans toutes les poses ; anciens profils compatibles ; récompenses persistantes non falsifiables                                            |
| 8 — Faire connaître         | Pages publiques partageables et arrivée directement sur la création       | Accès public volontaire, aucune donnée privée exposée, expérience compréhensible sans jouer auparavant                                                   |
| 9 — Créations jouables      | Prototype d’une salle à énigmes créée par un membre                       | Création, test, publication, visite et retrait complets ; aucune exécution de code utilisateur                                                           |
| 10 — Construire ensemble    | Projet collectif borné ou édition à plusieurs                             | Permissions, conflits, historique et restauration définis ; essai réduit avant ouverture générale                                                        |

**Premier ensemble à viser : étapes 0 à 3 + un défi animé manuellement.** Cela teste déjà la
boucle « créer → publier → découvrir → revenir » sans attendre tout le programme. L’habillage
graphique plus riche arrive par petits lots ; il ne doit pas bloquer cette première validation.

Les ateliers et retours sont ensuite prioritaires si les membres recherchent surtout de l’aide
sur l’IA. La construction avancée devient prioritaire s’ils s’approprient déjà leurs studios.

## 9. Architecture, gratuité et exploitation

- Conserver Phaser/Preact, Supabase et Cloudflare tant qu’un besoin mesuré ne justifie pas un changement.
- Réutiliser comptes, profils, musée, logements, invitations, panneaux et modération existants.
- Sauvegarder les constructions sous forme de données compactes ; réutiliser les mêmes textures.
- Charger une salle, des images ou une démo quand nécessaire. Paginer les listes, borner les caches.
- Sauvegardes regroupées à une fréquence raisonnable ; pas d’écriture en base par déplacement de meuble.
- Réserver le temps réel aux interactions qui en ont besoin. Pas de boucle de requêtes permanente pour les favoris, ressources ou nouveautés.
- Définir les plafonds de projets, plans, objets, retours et abonnements avant chaque migration.
- Réexaminer les quotas gratuits réels et leur consommation avant d’ajouter stockage, captures ou tâches planifiées. « Gratuit » ne signifie pas illimité.
- Ne pas introduire d’upload arbitraire de vidéos, de fichiers 3D, de chat vocal ou d’IA générative hébergée dans ce programme initial.
- Autorisations côté serveur/base, tests d’accès négatifs, signalement et outils de modération pour chaque nouveau contenu public.
- Vérifier accessibilité clavier, contraste, mouvement réduit et affichage mobile ; les couleurs ne doivent pas être le seul moyen de comprendre un choix.

## 10. Mesurer la réussite sans fabriquer de faux indicateurs

Établir d’abord une référence à partir des mesures déjà disponibles. Les visiteurs sans compte
ne doivent pas être présentés comme des personnes uniques identifiées. Vérifier les définitions
actuelles des visites et des retours avant de comparer les chiffres.

Questions prioritaires :

1. Un nouveau membre réalise-t-il une première action utile ?
2. Publie-t-il ou sauvegarde-t-il quelque chose qu’il souhaite retrouver ?
3. Une contribution obtient-elle un retour utile ?
4. Revient-il une semaine plus tard, avec assez de recul pour observer ce retour ?
5. Peut-il profiter du lieu sans autre joueur connecté ?

Ne pas confondre connexion ouverte et activité, ni durée et satisfaction. Si de nouveaux
événements de mesure sont nécessaires, préciser leur finalité, durée de conservation et coût,
et faire valider cette collecte avant de l’ajouter. Recueillir aussi quelques retours qualitatifs
auprès de débutants, créateurs et membres peu joueurs, sans prétendre qu’un petit échantillon
prouve la fidélisation de toute la communauté.

## 11. Ce qu’il faut volontairement repousser

Grand monde vide, dizaines de mini-jeux sans profondeur, économie complexe, échange d’objets,
enchères, classement permanent, messagerie privée complète, génération d’images à volonté,
construction multijoueur non bornée, notifications externes automatiques. Ces éléments ajoutent
des coûts ou de la modération avant que la boucle principale ait fait ses preuves.

Les nouveautés hebdomadaires ne doivent pas toutes exiger une nouvelle version du jeu : thèmes,
sélections, ateliers et événements devraient progressivement être éditables par un responsable
depuis une interface simple, avec validation et historique adaptés à leur portée.

## 12. Instruction de départ à transmettre à Claude

> Utilise ce document comme proposition d’évolution de MalinosLand. Relis AGENTS.md,
> SESSION_HANDOFF.md, ARCHITECTURE.md, PLAN_EVOLUTION.md et le code actuel de main.
> Intègre aussi la section 13 : le responsable souhaite un mode de construction en cubes
> distinct du Hub social. Étudie sa faisabilité dans un prototype séparé avant de choisir
> son moteur et de programmer son intégration ; ne le réduis pas à un catalogue de meubles.
> Commence par l’étape 0 : identifie ce qui existe déjà, les écarts et le plus petit lot
> utile pour l’étape 1. Présente les fichiers concernés, dépendances, risques et critères
> d’acceptation avant d’étendre le périmètre. Réutilise les composants existants.
> Travaille sur une branche dédiée, par PR cohérentes, avec les tests requis et mise à jour
> de la documentation. N’implémente pas toutes les étapes simultanément.
> Ne crée aucune ressource payante et ne lance aucun service de génération payant.
> Respecte les accords du responsable pour migrations, intégrations, fusion et déploiement :
> ce document seul n’autorise aucune mise en production. Ne considère pas d’anciennes
> autorisations portant sur les graphismes comme une autorisation générale pour ce programme.
> Demande les arbitrages seulement lorsqu’ils bloquent réellement un choix important.
> À chaque livraison, indique brièvement ce qui fonctionne, comment l’essayer et les limites.

**Direction à préserver :** chaque visite doit pouvoir laisser une petite trace utile —
une compréhension nouvelle, une création améliorée ou un lien humain — que le membre choisira
de retrouver. La personnalité du village et ses possibilités de jeu soutiennent cette promesse.

## 13. Ajout du responsable — Plusieurs univers, un même village

### 13.1 La vision demandée

MalinosLand doit pouvoir accueillir plusieurs façons de participer. Le monde actuel reste
le lieu où l’on discute, échange sur l’IA, présente ses projets et rencontre la communauté.
À côté, un autre univers propose un mini-jeu de construction libre, inspiré du plaisir de
creuser, bâtir avec des cubes et fabriquer des objets dans Minecraft. D’autres univers pourront
apparaître ensuite, avec leurs ambiances et activités, pour que différents publics s’y retrouvent.

Les clins d’œil passent par des thèmes et des mécaniques familières, avec une identité et des
créations graphiques propres à MalinosLand. Le but est une communauté commune avec plusieurs
terrains d’expression. Aucun membre n’est obligé de jouer au mode construction pour profiter
de l’espace social, des ateliers IA ou du musée.

### 13.2 Organisation des univers

| Univers                                 | Expérience                                                                    | Place dans le développement                            |
| --------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| Le Hub des Malinos                      | Discuter, montrer ses projets, découvrir l’IA, se retrouver, visiter le musée | Conserver et enrichir l’existant                       |
| Le Chantier des mondes — nom provisoire | Creuser, récolter, placer des cubes, construire et crafter                    | Premier nouveau mode à prototyper                      |
| Jardins et découvertes                  | Aménager un paysage, explorer, créer un endroit reposant                      | Thème possible utilisant les outils de construction    |
| Laboratoire du futur                    | Construire des installations, résoudre des énigmes, découvrir des mécanismes  | Extension possible des interactions et salles jouables |
| Mondes événementiels                    | Défi collectif, exposition temporaire, ambiance saisonnière                   | Ouverture limitée à une animation réelle               |

Commencer par **le Hub et un seul petit monde de construction**. Une nouvelle ambiance peut
être une zone du même monde avant de devenir un univers séparé. Cela évite de disperser les
quelques joueurs présents et de multiplier les moteurs, les sauvegardes et la maintenance.

Un portail dans le Hub et un menu « Univers » donnent accès aux mêmes destinations. Afficher
ce qu’on peut y faire, les personnes présentes et un retour facile au Hub. Les destinations
non ouvertes ne doivent pas encombrer le parcours du nouveau membre.

### 13.3 Le bac à sable : un vrai terrain modifiable

Le besoin dépasse la décoration du studio : le terrain contient des blocs en volume, avec
des coordonnées horizontales et verticales. On peut retirer un bloc autorisé, creuser sous
la surface, poser un bloc au-dessus d’un autre et créer du relief ou un espace intérieur.

Premier périmètre proposé :

- Petite carte bornée, hauteur et profondeur limitées, point de départ protégé.
- Petit catalogue de cubes : terre, pierre, bois, verre et quelques couleurs ou végétaux.
- Sélection visible du bloc ciblé, portée limitée et aperçu du placement.
- Barre d’outils simple, inventaire, rotation des éléments qui en ont besoin.
- Sauvegarde persistante, reprise et retour à un endroit sûr si l’on reste coincé.
- Tutoriel facultatif : casser un bloc, en placer un, réaliser une petite construction.

**Livraison en deux paliers :** d’abord un mode créatif pour valider le plaisir de construire,
puis un parcours « récolter et fabriquer » avec ressources et recettes. Le creusage, la pose
en hauteur et le craft restent bien des objectifs demandés ; le palier créatif ne les remplace pas.

Pour le craft : quelques recettes lisibles, une présentation des ingrédients manquants et un
bouton « Fabriquer ». Exemple de progression à équilibrer : récolter du bois, obtenir des
planches, fabriquer un établi puis un objet décoratif. Pas besoin de faim, de combat ou de
perte d’inventaire pour rendre ce premier mode intéressant. Les ressources obtenues en mode
créatif ne doivent pas alimenter un inventaire à progression limitée.

### 13.4 Construire et interagir avec les autres

- **Visiter** une construction publiée, même en l’absence de son auteur.
- **Inviter à construire** : propriétaire, co-bâtisseur autorisé et visiteur sont des rôles distincts.
- **Réaliser un projet commun** dans un espace dédié, sans rendre tout le monde modifiable par tous.
- **Saluer, remercier, applaudir** et échanger dans le contexte de la salle.
- **Demander un coup de main** : « cherche quelqu’un pour aménager le jardin ».
- **Participer à un thème collectif**, puis découvrir les réalisations dans le Hub ou le musée.
- **Partager un accès à sa création** avec les mêmes protections que les autres publications.

Les nouveaux liens sociaux doivent servir aussi le Hub : retrouver une personne rencontrée
sur un chantier, découvrir son projet IA ou l’inviter à un atelier. Les contacts et préférences
sont communs ; les inventaires et règles de jeu peuvent rester propres à chaque mode.

Protection indispensable du monde persistant : droits vérifiés côté serveur, parcelles ou
zones protégées, retrait immédiat des droits, signalement et restauration après dégradation.
Un visiteur ne peut ni casser ni prendre les ressources d’autrui par défaut. Prévoir une
réserve ou une régénération contrôlée des zones de récolte, sans effacer les constructions.

### 13.5 Grandir avec la communauté

Prévoir dès la conception une capacité bornée et extensible, sans construire un monde infini.
L’ouverture d’une zone dépend de critères observables : parcelles réellement occupées,
projets actifs, présence régulière, demande de la communauté, capacité de modération et marge
dans les quotas. Le nombre total d’inscrits ne suffit pas à justifier un agrandissement.

Avant chaque ouverture : vérifier que l’espace actuel est vivant, définir une activité ou un
responsable pour la nouvelle zone, et mesurer le coût de sa persistance. Une extension peut
être annoncée et construite collectivement, donnant un rendez-vous à la communauté.

### 13.6 Faisabilité technique : un chantier distinct

Le jeu actuel utilise Phaser et des images 2D pour donner un aspect volumétrique. Cela ne
constitue pas déjà un moteur de terrain destructible en trois dimensions. Claude doit comparer,
dans un prototype limité, un rendu isométrique adapté et un rendu 3D séparé chargé à l’entrée
du mode. La vue finale n’est pas arrêtée par ce document : elle doit rendre le creusage et
la construction compréhensibles, y compris sur mobile et pour un non-joueur.

Ne pas réécrire le Hub pour ce besoin. Partager identité et navigation quand cela est pertinent,
mais isoler rendu, simulation et données du bac à sable. Si un moteur différent est retenu,
justifier sa dépendance, son poids et ses performances avant intégration.

Étudier notamment :

- Découpage du terrain en petits secteurs, chargement à la demande et limites explicites.
- Terrain initial reproductible et stockage compact des modifications, avec consolidation
  pour éviter un historique qui grossit sans limite.
- Autorité serveur sur la casse, le placement, les droits, la portée, l’inventaire et le craft.
- Résolution de deux modifications concurrentes du même bloc, reconnexion et récupération
  après coupure ; une fabrication ne peut pas dupliquer les objets.
- Limitation du débit des actions et diffusion seulement aux joueurs concernés.
- Sauvegardes et restauration bornées, pas une écriture distante pour chaque image affichée.
- Tests sur appareils modestes et mesure des quotas à petite échelle avant ouverture plus large.

Le maintien dans les offres gratuites est une contrainte à vérifier expérimentalement,
pas une garantie pour un nombre arbitraire de joueurs ou de blocs. Si les mesures dépassent
le budget, réduire carte, capacité ou rythme des actions plutôt que souscrire une offre payante.

### 13.7 Étapes propres au bac à sable

| Palier                        | Résultat à montrer                                                 | Critère de validation                                                                            |
| ----------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| B0 — Prototype local          | Petit terrain en volume, creusage et empilement, commandes simples | Le responsable valide le plaisir et la lisibilité ; poids, fluidité et choix du rendu documentés |
| B1 — Construction persistante | Une petite parcelle, catalogue limité et sauvegarde                | La construction est identique après reconnexion ; limites et retour en lieu sûr fonctionnent     |
| B2 — Construction sociale     | Visiteurs et co-bâtisseurs sur invitation                          | Deux joueurs voient les mêmes blocs ; collisions d’édition, refus d’accès et restauration testés |
| B3 — Récolte et craft         | Ressources et quelques recettes, inventaire séparé du créatif      | Fabrication et consommation correctes côté serveur, y compris après double clic ou coupure       |
| B4 — Premier monde public     | Portail, accueil, découverte de créations et défi commun           | Le Hub reste indépendant ; modération, quotas et parcours débutant validés sur un petit groupe   |
| B5 — Extensions               | Nouvelles parcelles, ambiances ou univers                          | Ouverture motivée par l’usage réel et compatible avec les ressources disponibles                 |

Cette piste peut faire l’objet du prochain prototype après l’audit initial. Elle ne doit pas
attendre la fin des onze étapes précédentes, ni empêcher d’améliorer l’accueil et les échanges
dans le Hub. Faire valider B0 avant d’engager l’ensemble du chantier. Le programme reste en
petits lots ; aucune mise en ligne n’est autorisée par le seul ajout de cette section.

**Nouvelle boucle complémentaire :** je rejoins un monde → je commence une construction →
je récolte ou fabrique ce qui me manque → j’invite quelqu’un → nous créons quelque chose
ensemble → nous le montrons à la communauté → nous avons une suite à poursuivre.
