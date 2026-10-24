# Reprise de session

> À lire en premier par toute nouvelle session (humaine ou IA). Mettre à jour à la fin de chaque
> tâche importante.

**Dernière mise à jour : 22/10/2026 — v0.3 terminée (logements, décoration, carnet, rôles, jour
et nuit). Plan validé pour la suite : [PLAN_EVOLUTION.md](PLAN_EVOLUTION.md) (v0.35 panneau
« Que faire maintenant ? » et Quiz IA, puis v0.4 Musée des Malinos). v0.35 complète (PR 1 à 6
fusionnées) ; PR 7 à PR 9 du Musée fusionnées ; en cours : PR 10 (« Essayer ici »). Une PR à
la fois, présentée au responsable avant la suivante.**

> Nouvelle session ? Les consignes sont dans [`AGENTS.md`](../AGENTS.md) ; le mode d’emploi pour
> reprendre sur un autre ordinateur ou un autre outil est dans
> [REPRENDRE_LE_PROJET.md](REPRENDRE_LE_PROJET.md).

## Où en est-on ?

### Personnalisation Malino 3D — 23/10/2026

Le responsable demande explicitement plus de choix et leur mise en ligne. Branche
`feature/personnalisation-malino-3d`, issue de `b381270` (PR #48 publiée avec succès).
Six styles et quatre palettes indépendantes (peau, cheveux, veste, pantalon), 2 880 combinaisons
de couleurs sans nouvelle coupe ni accessoire. Explication visible dans l'éditeur et choix
classique conservé. Un masque Blender de 315 411 octets s'ajoute aux trois atlas existants,
soit 1 695 635 octets. Recoloration locale à la création des textures, sans appel payant.
Champs validés côté serveur et conservés dans le JSON du profil, aucune migration SQL.
Voir [PERSONNALISATION_3D.md](PERSONNALISATION_3D.md) et DEC-034 pour la reproduction et les limites.
Publication via PR squash et workflow existant, autorisée par cette demande. Vérifier le dernier
workflow « Mise en ligne » pour l'état du déploiement. Coiffures et visages : prochain lot à décider.
Vérifications locales : `npm run check` (238 tests), `npm run format:check`,
`npm run test:baked-art` (couleurs, classique, deux onglets, salles) et `npm run test:e2e`
(dont mobile simulé) réussis. Contrôle visuel des six vignettes et du personnage dans le jardin.
La CI complète vérifie également le serveur et la transmission des couleurs entre deux clients.

### Adoption des graphismes — 23/10/2026

Le responsable a validé le rendu puis demandé explicitement de remplacer les arbres et le
personnage **en ligne**. Cette demande autorise la fusion et le déploiement par le workflow existant.
Le jeu normal utilise désormais le chêne et le nouveau sakura partout (sapins conservés), et
le personnage « Malino 3D » par défaut. Dans l'éditeur, « Classique personnalisable » réactive
tous les choix précédents sans les effacer. Le champ numérique `look.model` (0/1) est validé,
enregistré et transmis ; un ancien profil sans ce champ utilise le nouveau modèle.
Trois atlas publics dans `src/game/assets/`, 1 380 224 octets au total ; aucun fichier 3D en jeu.
Galeries et mode d'essai restent réservés au développement, avec stockage séparé.

Suite : petites séries de coiffures, visages, vêtements et accessoires, sans générer toutes
les combinaisons. Voir [PERSONNALISATION_3D.md](PERSONNALISATION_3D.md). Le responsable s'absente
et souhaite préserver son forfait ChatGPT : aucune nouvelle génération dans cette étape.
État de la publication à vérifier dans la PR #48 et le dernier workflow « Mise en ligne ».

### Historique : expérience graphique isolée — 23/10/2026

**Dernière demande traitée : essayer le rendu directement dans le jeu local.**
Ouvrir `/jouer/?prototype=voxel` avec `npm run dev`. Arrivée dans le jardin du vrai Hub : avatar
Blender jouable, un chêne (16,28), deux nouveaux sakuras (16,31 et 19,31). Le sakura vient de
`scripts/sakura-study.py`, converti en quatre vues transparentes par `scripts/render-sakura-game.py`
avec Blender 5.2.3 et son MCP local. L'ancien sakura de la galerie avait été refusé.
Accès direct sans inscription, réseau désactivé, stockage préfixé `malinosland:prototype:` ;
profil habituel et carte JSON préservés. Import DEV uniquement : aucune image ajoutée au build public.
`npm run test:prototype-game` vérifie marche, collisions, profondeur, siège, changement de salle,
16 cadres, 4 orientations, profil intact, absence de requêtes externes et exclusion du build.
**Retour utilisateur : direction jugée nettement meilleure que les graphismes actuels.**
Prévoir progressivement plusieurs coiffures, visages, vêtements et accessoires ; aucune nouvelle
série demandée maintenant. Préserver le forfait ChatGPT hebdomadaire : petits lots ciblés,
présentation minimale et réponses courtes. Performances sur appareils réels et adoption publique
restent à valider. Pas de publication ni de fusion autorisée.

Branche `feature/prototype-voxel-avatar-arbres`, basée sur `main` à `23b8d84` (PR #46 incluse).
Galerie locale `/voxel-preview.html` : avatar en veste, chêne et sakura, avant/après, quatre
orientations, poses, résolutions et jardin comparatif. Après retour du responsable (sakura trop
clairsemé), feuillage densifié et deuxième rendu produit avec Blender 4.4.3 déjà installé,
sans MCP ni service externe. Les 24 vues sont conservées en trois atlas ; sources reproductibles.

Guide complet : [PROTOTYPE_VOXEL.md](PROTOTYPE_VOXEL.md). **Reste à faire : validation artistique**,
puis décision séparée sur l'intégration au Hub et la personnalisation. Une seule tenue,
éclairage Blender figé, voisinage des arbres et vrais appareils non validés. Aucun déploiement,
aucune migration, aucune fusion dans `main`. Les étapes du plan v0.35 restent indépendantes.

Vérifié le 23/10 : `npm run check` (215 tests), `npm run format:check`, `npm run test:voxel`
(144 combinaisons, cadres/caches/cadrage/mobile/réseau) et `npm run test:e2e` sur le build :
réussis. Captures dans `docs/images/prototype-voxel-*.png`. Atelier absent du build public.

- **`main`** contient la v0.1 (PR #1), le test e2e fiable (PR #2), la portabilité vers tous les
  outils IA (PR #3) et le **serveur temps réel v0.2** (PR #4, DEC-013).
- **Protection de `main` active** : pull request obligatoire, fusion en _squash_ uniquement, ni
  suppression ni push forcé.
- **Hébergement validé (DEC-006)** : Cloudflare + Supabase, offres gratuites sans carte bancaire.
  **Compte Cloudflare créé** par le responsable le 19/10 (connexion Google). Supabase : pas encore.
- Serveur temps réel testé : 77 tests unitaires, 10 vérifications d’intégration avec Wrangler,
  test « deux joueurs en ligne ». CI : 4 jobs (check, e2e, serveur, deux joueurs en ligne).
- **Mise en ligne (PR #5, DEC-014)** : workflow GitHub « Mise en ligne », lancé à la main
  (Actions → Mise en ligne → Run workflow). Secrets `CLOUDFLARE_API_TOKEN` et
  `CLOUDFLARE_ACCOUNT_ID` configurés. **Première mise en ligne réussie le 19/10** (toutes les
  étapes vertes : `/health` répond, site répond, origine inconnue refusée). Guide :
  [MISE_EN_LIGNE.md](MISE_EN_LIGNE.md). **Relancer le workflow après chaque fusion** dans `main`
  qui touche au jeu ou au serveur.
- PR #6 fusionnée et mise en ligne : textes exacts sur les données transmises (`PRIVACY_NOTE`),
  feuille de route du jeu, README avec l’adresse du jeu.
- Anciennes branches distantes déjà fusionnées (`feature/initial-prototype`,
  `fix/casque-et-documentation`, `fix/ci-e2e`, `docs/portabilite-ia`, `feature/v0.2-realtime`,
  `feature/mise-en-ligne-cloudflare`) :
  **à supprimer depuis GitHub** (le proxy des sessions Claude interdit leur suppression).

## Dernières sessions

- **24/10 (soir, suite)** — PR #54 (la salle du musée) fusionnée et en ligne ; site un moment
  inaccessible chez le responsable, revenu de lui-même (mise en ligne relancée sans changement :
  site et serveur répondaient). Branche `feature/musee-essayer-ici` (PR 10, DEC-038) : visionneuse
  `/demo/:id` et vérification `/embed-check` sur le Worker (`server/src/embed.ts`), migration
  `20261028090000_museum_demo.sql` (**à appliquer sur Supabase à la fusion**, comme la PR 7),
  bouton « Essayer ici », validation en deux temps en modération. Testé : unitaires, base,
  intégration Worker, chaîne complète dans un navigateur avec un faux site (pas d’Internet dans la
  session). **Non testé en ligne avec un vrai site.**
  **Demandes du responsable à traiter ensuite (une PR à la fois) :**
  1. Bruitages (clavier, borne d’arcade, ascenseur, coworking…) : seulement les **10 premières
     secondes** dans une pièce, rejoués si l’on change de pièce ou si l’on revient après 30 s.
  2. **Miniature** facultative du projet (capture, photo) affichée en jeu, image très légère ;
     nécessite un espace de stockage Supabase (gratuit, 1 Go) : **accord à demander** avant de
     créer le compartiment ; la colonne `thumbnail` existe déjà (vide).
  3. Futur **Bâtiment des créations** : façades largement **vitrées**, pour voir de l’extérieur
     les Malinos marcher dedans (à prévoir dans sa conception, PR 11 et suite).
  4. Texte de présentation (`publication/texte-nouveautes.md` dans le dossier temporaire) :
     parler des « nouveautés de la semaine ».

- **24/10 (suite)** — PR #53 (exposer et modérer) fusionnée et en ligne. Branche
  `feature/musee-salle` (PR 9, DEC-037) : galerie ouverte et renommée « Musée des Malinos »,
  7 stands (`stand-1` à `stand-7`) avec affiches plaquées en perspective, borne « Toutes les
  créations », fiche du projet (lien externe, signalement), onglet 🚩 Signalés en modération,
  outil de débogage `museumSample()`, étape e2e stand → fiche → lien. **Non testé en ligne**
  avec de vrais projets : à vérifier après fusion. Suite : PR 10 (« Essayer ici » sécurisé).

- **24/10 (nuit)** — PR #51 (base du musée) fusionnée, migration appliquée sur Supabase, mise en
  ligne réussie (main avait reçu les commits Blender du responsable : conflit de documentation
  résolu, décision du musée renumérotée **DEC-035**). Branche `feature/musee-exposer` (PR 8,
  DEC-036) : formulaire « Exposer mon projet » avec aperçu de l’affiche, « Mes projets »,
  onglet 🖼️ Musée de la modération, `src/services/museum.ts`, affiches procédurales
  `src/game/art/posters.ts` (avancées de la PR 9), guide [MUSEE.md](MUSEE.md), 14 tests en plus
  et une étape e2e. **Non testé en ligne** (aucun projet réel créé) : à essayer par le
  responsable après fusion (proposer, valider, refuser, retirer). Suite : PR 9 (la salle).

- **24/10 (soir)** — PR #50 (mesures de fréquentation) fusionnée et en ligne : **v0.35 complète**.
  Branche `feature/musee-base` (PR 7, DEC-035) : migration `20261027090000_museum.sql`
  (**appliquée sur Supabase** le 24/10, en 6 morceaux, avec l’accord du responsable), tables `projects` et `project_reports`, fonctions de modération et
  `museum_projects`, 8 tests PGlite. Écart avec le plan : signalements de projets dans une table
  dédiée. Suite : PR 8 (formulaire « Exposer mon projet », onglet de modération).

- **24/10 (suite)** — PR #49 (borne du quiz, 60 questions validées) fusionnée et en ligne.
  Branche `feature/mesures-frequentation` (PR 6) : `attendance()` dans `src/services/visits.ts`
  (comptes par jour, retour un autre jour et après 7 jours, durée médiane de connexion, visites
  sans compte) à partir du journal **existant** ; le serveur envoyait déjà l’identifiant
  `player`, le jeu le garde maintenant. Affiché en tête de l’historique du responsable, limites
  écrites à côté. Aucun changement du serveur ni de la base. Suite : v0.4, Musée (PR 7 :
  migration `projects`, après accord).

- **24/10** — PR #47 (moteur du quiz, 30 questions validées) fusionnée et en ligne. Le
  responsable demande plus de questions et des questions sur les bases (« qu’est-ce qu’un LLM,
  différence entre modèle et LLM… »). Branche `feature/borne-quiz` (PR 5) : borne
  `arcade-jeux-1` en variante 2 (turquoise, « QUIZ IA », étiquette), qui ouvre le quiz ; défi
  de la semaine **sans répétition** (`weeklyChallenge` par cycles, `isoWeek().index`) ;
  30 questions de plus, thème « Les bases de l’IA » (**à relire avant fusion**) ; suggestion du
  défi dans le panneau « Que faire ? » (`quizWeeklyDone`). Pour durer plus longtemps : ajouter des
  questions régulièrement (5 de plus = 1 semaine de plus sans répétition).

- **23/10 (soir)** — PR #46 (hall agrandi, écran « Que faire ? ») fusionnée et en ligne. Branche
  `feature/quiz-ia` (PR 4, DEC-030) : `src/content/quiz.ts` (30 questions **à faire relire par
  le responsable avant fusion**), `src/core/quiz.ts` (tirage, semaine ISO, défi),
  `src/services/quizStats.ts` (scores dans le navigateur seulement), panneau `quiz`
  (`src/ui/panels/Quiz.tsx`, clavier 1–4 et Entrée, `useLayoutEffect` comme Modal pour ne pas
  perdre de touche sur une machine lente). Pas encore de borne : ouvrir avec `?debug` puis
  `__malinosDebug.panel('quiz')`. Suite : PR 5 (borne `arcade-jeux-1`, 30 questions de plus,
  suggestion du défi dans le panneau d’idées).

- **23/10 (suite)** — PR #45 (panneau « Que faire ? ») fusionnée et en ligne. Branche
  `feature/ecran-que-faire` (PR 3) : objet `board_activities` (écran-borne dessiné, lumière
  turquoise) à gauche de l’entrée du hall, en (10, 19). **Hall agrandi** de deux rangées vers
  le sud (demande du responsable) : intérieur x 8–16, y 10–20, mur bas en y 21, porte en x 12–13 ;
  comptoir d’accueil déplacé en (14, 16), grande plante du haut retirée (accès à la conférence
  dégagé), panneau de bienvenue en (15, 19), paillasson en (12, 20), totem en (18, 20),
  réverbère en (6, 21), deux jardinières retirées, point d’arrivée en (12.9, 22.6); Joshua y renvoie (visite guidée, `followUpLines`,
  remarques). Étape du test de bout en bout. Suite : PR 4 (moteur du quiz, 30 questions à
  faire relire).

- **23/10** — PR #43 (plan) et #44 (finitions v0.3) fusionnées, mises en ligne. Branche
  `feature/panneau-que-faire` (PR 2 du plan, DEC-029) : `src/world/activities.ts` (idées du
  moment, testé), `src/content/activities.ts` (lieux), panneau `activities` et bouton 🧭, commandes
  `go-to-object` et `chat-focus`, `crowdStore` (présents par zone). Ids ajoutés sur la carte :
  `canape`, `transat`. Étape du test de bout en bout. Suite : PR 3 (écran du hall, Joshua).

- **22/10** — PR #42 (lot C, jour et nuit) fusionnée et en ligne. Audit et plan d’évolution
  (PR #43, `docs/PLAN_EVOLUTION.md`) **validés par le responsable**, avec ses précisions (musée :
  sécurité de la démo renforcée ; quiz : scores dans le navigateur seulement ; statistiques :
  limites du journal vérifiées). Coins coins décalés en v0.6. Branche `fix/finitions-v03`
  (PR 1 du plan) : textes périmés du jeu corrigés (chantier → Bâtiment des créations, bornes,
  ordinateurs, étagères, télescope, studio, étages sans date), feuille de route du jeu et des
  documents, liste des fonctionnalités, guide du joueur, tests à faire en ligne.

- **26/10 (soir)** — PR #41 (lot B2, DEC-027) fusionnée et en ligne ; migration des rôles
  appliquée (`my_account` ajoutée, `my_profile` inchangée : l’outil MCP de Supabase n’exécute pas
  de `drop` sans confirmation). Branche `feature/lot-c-jour-nuit` (DEC-028) : jour et nuit à
  l’heure de Paris (`src/core/daylight.ts`, `src/game/life/DayNight.ts`), horloge, réglage
  « Toujours de jour », grillons, étoiles, lucioles. Outil de débogage `time(h)`. Reste à faire
  plus tard : fenêtres allumées la nuit. Suite proposée : lot D (Coins coins 🦆).

- **26/10 (fin)** — PR #38, #39, #40 fusionnées et en ligne (page d'accueil servie depuis le
  dépôt privé, secret `ACCUEIL_TOKEN` en place, vérifié par le responsable). Branche
  `feature/lot-b2-roles` (DEC-027) : statut doré « Le Décodeur en chef » et badge 🛡️ des
  modérateurs, donnés par le responsable depuis 👥 Joueurs connectés ; barbe et micro pour les
  avatars ; slogans. **Migration `20261026090000_roles.sql` appliquée sur Supabase avant la
  mise en ligne** (le serveur lit le rôle avec `my_account`, déjà appliquée). Renaud n'a pas encore de compte :
  le responsable lui donnera le statut doré quand il viendra. Suite proposée : lot C
  (jour et nuit à l'heure de Paris).

- **26/10 (suite)** — PR #37 fusionnée et en ligne ; PR #38 (ronde : clic, musique, projecteurs)
  et #39 (plus de lien GitHub) ouvertes. Branche `feature/accueil-prive` (DEC-026) : la page
  d’accueil part dans le dépôt **privé** `Rogue06/MalinosLand-accueil`. **À faire par le
  responsable** : créer ce dépôt (privé, vide), donner l’accès à l’app Claude GitHub, créer le
  secret `ACCUEIL_TOKEN` (MISE_EN_LIGNE.md, étape 5). Ensuite : y pousser la page (copie prête),
  fusionner, mettre en ligne. Ne pas fusionner `feature/accueil-prive` avant que le dépôt privé
  contienne la page et que le secret existe.

- **26/10** — PR #36 (lot A) fusionnée, migration `player_progress` appliquée, en ligne.
  Branche `feature/joshua-vivant` (lot B) : antennes animées et humeur (`src/game/life/JoshuaLife.ts`,
  `src/content/joshua.ts`), répliques dans son ton, charte des Malinos ; cercle de champignons
  visible (`mushroom_ring`). Boutique de Renaud notée (droits : clins d’œil originaux seulement).
  Suite : lot B2 (statut doré de Renaud, modérateurs, avatar barbe/micro, slogans).

- **25/10 (suite)** — PR #33, #34, #35 fusionnées et en ligne. Branche
  `feature/carnet-joshua` (lot A, DEC-025) : carnet de Joshua (devinettes + pages),
  progression sur le compte (migration `20261025090000_player_progress.sql` **à appliquer sur
  Supabase à la fusion**). Nouvelles demandes notées dans la proposition §2 ter (statut doré de
  Renaud, nommer des modérateurs, avatar barbe/micro, slogans, liste de vidéos de l’écran).

- **25/10** — PR #33 (invitations visibles : carte « Y aller » chez l’invité) ouverte. Audit
  des secrets : les 10 sont présents et accessibles, mais sans indice et gardés seulement dans
  le navigateur. **Validé par le responsable** : [PROPOSITION_VIE_DU_JEU.md](PROPOSITION_VIE_DU_JEU.md)
  (mystère de Joshua, IA ; « Coins coins » 🦆 ; secrets avec indices sur le compte ; jour/nuit
  heure de Paris ; photos et télé YouTube au studio ; écran du Hub ; guitare du feu de camp).
  Prochaine étape : lot A (secrets + carnet sur le compte). Questions restantes : §11.
  PR #35 : sons d’ambiance (plus de fond continu au hall ni à la salle de jeux).

- **24/10 (fin)** — PR #29 et #30 fusionnées, migration `home_decor` appliquée, mise en ligne
  faite. Branche `feature/robot-joshua` : Joshua redessiné façon Reachy Mini (robot de la
  communauté), mis en avant en haut du site d’accueil ; formes `ovoid` et `roundedBox` dans
  `src/game/art/iso3d.ts` ; section « 0 € » retirée de l’accueil (demande du responsable).

- **24/10 (suite)** — Branche `feature/editeur-decoration` (DEC-024), partie de `main` (sans le
  site d’accueil de la PR #29 : au moment de fusionner la seconde, résoudre les conflits de
  `scripts/smoke-test.mjs` (adresse `/jouer/`), CHANGELOG, DECISIONS, SESSION_HANDOFF).
  Éditeur de décoration : `src/content/furniture.ts` (21 meubles), `src/world/decor.ts` (règles,
  testées), `src/game/DecorEditor.ts`, `src/ui/hud/DecorBar.tsx` (chargée à la demande), message
  réseau `decor`, migration `20261024090000_home_decor.sql` appliquée sur Supabase à la fusion
  (accord du responsable). **À tester en ligne** :
  enregistrer, recharger, voir la décoration depuis un 2e compte présent dans le logement.

- **24/10** — PR #27 et #28 fusionnées et en ligne. Branche `feature/site-accueil` (DEC-023) :
  site d’accueil « fait main » (`index.html`, `src/landing/`), « Continuer avec Google » mis en
  avant (aussi dans le jeu), jeu déplacé dans `jouer/index.html`, police Fredoka (OFL, servie
  par le site), image d’aperçu des partages. Filet de sécurité : un retour de connexion arrivé
  sur la racine est transmis au jeu. **À vérifier en ligne par le responsable** : connexion
  Google depuis l’accueil (retour direct dans le jeu), aperçu du lien dans Discord/WhatsApp.

- **23/10 (suite 2)** — Branche `feature/parc-foret-jeux` (empilée sur `feature/chat-proximite`) :
  partie est du Hub redessinée (générateur ponctuel, non conservé) : salle de jeux, chemins en
  lacets, prairie, étang, forêt dense et clairière avec feu de camp ; 9 nouveaux objets ;
  10 secrets au total.

- **23/10 (suite)** — PR #26 fusionnée et en ligne. Branche `feature/chat-proximite` : rayon de
  8 cases pour « autour » (serveur + démo), chat en un seul fil avec choix « À : Tout le monde /
  Autour · n » (défaut : tout le monde), buisson retiré du chemin + test. À suivre (demandes du
  responsable) : parc et forêt plus attrayants (chemins moins rectilignes, clairière…) et un
  **coin jeux** intérieur.

- **23/10** — PR #25 (ville vivante lot 1) fusionnée et en ligne. Lot 2 (branche
  `feature/hub-agrandi`) : Hub 48 × 38 (Parc des Malinos, Verger et potager), étang et télescope
  (2 secrets de plus, 8 au total), ronds dans l’étang. Pièces intérieures **pas encore
  agrandies** (à discuter : cela demande de redessiner le bâtiment).

- **22/10 (nuit)** — PR #24 fusionnée, migration `site_owners` appliquée, compte du responsable
  ajouté comme responsable du site, mise en ligne faite. Ville vivante lot 1 (branche
  `feature/ville-vivante`) : `src/game/life/AmbientLife.ts` (fontaine, oiseaux, papillons,
  vapeur ; local au navigateur) et 6 secrets (`src/content/secrets.ts`, compteur dans les
  objectifs ; liste et emplacements à ne pas dévoiler aux joueurs). Lot 2 à faire : agrandir le
  Hub (nouveau coin extérieur, pièces plus grandes). Rayon du chat « Proximité » : proposé, pas
  encore validé.

- **22/10 (soir)** — PR #21, #22, #23 fusionnées et en ligne ; migration logements appliquée sur
  Supabase (par morceaux, droits vérifiés). Historique des connexions (branche
  `feature/historique-connexions`, DEC-022) : journal dans le Durable Object, `GET /visits`
  réservé au responsable (`site_owners`, migration `20261022120000_site_owner.sql` **à appliquer
  après accord**, puis ajouter le compte du responsable dans `site_owners`). Ensuite : ville plus
  vivante (fontaine, oiseaux, secrets, espaces agrandis), proposition d’un rayon pour le chat
  « Proximité » (aujourd’hui : toute la salle).

- **22/10** — v0.3 Logements, lot 1A (branche `feature/logements-acces`, DEC-021) : migration
  `20261022090000_homes.sql` (**pas encore appliquée** sur Supabase : à appliquer après accord
  de fusion), messages `enter` / `door` / `evict`, accès vérifié par la base, chat d’un logement
  limité aux présents (demande du responsable), carte `studio` et objet lit. Lot 1B à suivre :
  ascenseur « Mon logement » / « Visiter », changement de salle dans le jeu, panneau d’accès et
  invitations.
- **22/10 (suite)** — Lot 1B (branche `feature/logements-jeu`, empilée sur 1A) : ascenseur
  (Hub / Mon logement / Visiter), changement de salle sans couper le réseau (relance de la scène,
  connexion transmise), panneau « table basse » (accès + invités), bouton « Inviter », onglet
  « Ici » du chat, test e2e. **Pas testé en ligne** (comptes et vrai serveur nécessaires) : à
  vérifier par le responsable avec un 2e compte ou un visiteur (logement « tout le monde »).
  Demandes suivantes du responsable : ville plus vivante (fontaine, oiseaux, secrets, espaces
  agrandis) et **historique des connexions visible seulement par son compte** (aujourd’hui :
  1 seul compte en base, rien n’est conservé pour les visiteurs).

- **21/10 (fin)** — PR #20 (finalisation v0.2) fusionnée et en ligne. Licence : **AGPL-3.0**
  choisie par le responsable (DEC-009, branche `docs/licence-agpl`). Connexion GitHub considérée
  comme bonne par le responsable (non testée). Démarrage de la v0.3 Logements.

- **21/10 (suite)** — PR #19 (Turnstile) fusionnée et en ligne ; migration
  `20261021090000_feedback_turnstile.sql` appliquée **après** la mise en ligne (sous la forme
  `alter policy`, comme dans le fichier) : le rôle anonyme n’a plus aucun droit sur `feedback`
  (vérifié en SQL). Secret `TURNSTILE_SECRET_KEY` rangé par le responsable. Finalisation de la
  v0.2 (branche `feature/finalisation-v0.2`) : file d’attente serveur (`queue`, 50 places,
  entrée automatique, testée en intégration Wrangler), ambiance du hall et du salon, quotas
  Cloudflare vérifiés, feuille de route et CHANGELOG [0.2.0].

- **21/10** — PR #18 (confort mobile) fusionnée et en ligne. Anti-robots de la boîte à idées
  (branche `feature/turnstile-boite-a-idees`, DEC-020) : widget Cloudflare Turnstile pour les
  visiteurs (clé publique `0x4AAAAAAFc9aBbFft3ZX8LP` dans `deploy.yml`), fonction Edge Supabase
  `feedback` **mise en ligne le 21/10** (version 1, `verify_jwt` désactivé : elle vérifie elle-même
  l’origine et Turnstile). **Ordre de mise en service** : (1) le responsable range
  `TURNSTILE_SECRET_KEY` dans Supabase → Edge Functions → Secrets ; (2) fusion de la PR + mise en
  ligne du jeu ; (3) **ensuite seulement**, appliquer la migration
  `20261021090000_feedback_turnstile.sql` (sinon les visiteurs ne peuvent plus rien envoyer
  pendant l’intervalle). Testé : 7 tests de la fonction, base (PGlite), parcours dans le
  navigateur avec un faux widget. **Pas testé avec le vrai Turnstile** (la session Claude ne
  joint pas challenges.cloudflare.com).

- **20/10 (soir)** — Texte de présentation pour la communauté (fourni dans la conversation, pas
  dans le dépôt). Branche `feature/confort-mobile` : chat repliable avec non lus, bouton d’action
  tactile (commande `use`), zoom à deux doigts, textes et aide adaptés au doigt, mise en page
  paysage, étape « téléphone » dans le test e2e. Ordre décidé par le responsable : confort mobile,
  puis **v0.3 Logements** (ascenseur → « Mon logement », studio meublé de base). Écartés pour
  l’instant : historique du chat (inutile selon le responsable), file d’attente (40 par salle est
  loin d’être atteint). Turnstile (anti-robots de la boîte à idées) : proposé, en attente.

- **20/10 (fin, responsable absent — autorisation de fusionner)** — PR #16 : sièges en deux
  calques (`base` / `front`, DEC-018) : assis de dos, le personnage est devant l’assise et derrière
  le dossier ; positions signalées en rouge par le responsable corrigées. PR #17 (branche
  `feature/confort-absent-sons`, DEC-019) : statut « absent » 💤 après 20 s d’onglet caché
  (message `away`), son discret à l’arrivée d’un message avec anti-spam (`SoundGate`), mentions
  @pseudo surlignées + carillon, ambiance sonore (oiseaux dehors, claviers au coworking), réglages
  sons / ambiance / volume. Sons générés en code (Web Audio), aucun fichier. **Pas entendu en vrai**
  (la session n’a pas de haut-parleurs) : à écouter dans le jeu. Écartés pour l’instant à la
  demande du responsable : téléportation depuis la mini-carte (F40), vêtements personnalisés (F39,
  plus tard).

- **20/10 (suite, responsable absent — autorisation de fusionner)** — PR #12 (masquer/signaler)
  fusionnée, tables appliquées sur Supabase, responsable ajouté comme modérateur. PR #13 : assises
  contre le dossier + casque vu de dos (écouteur caché non dessiné) + tri d’affichage limité aux
  pièces qui se recouvrent. PR #14 : Boîte à idées 💡 et Borne à bugs 🐞 (hall, coin gauche près de
  l’entrée), table `feedback`, onglet « Idées & bugs » en modération avec ticket GitHub prérempli.
  Tout est fusionné, appliqué sur Supabase (insertion visiteur vérifiée en SQL) et en ligne.

- **20/10** — Modération v0.2 (branche `feature/masquer-signaler`) : liste des joueurs
  connectés (bouton « N Malinos »), masquer (local), signaler (compte, table `reports`, 10/jour),
  page 🛡️ Modération (table `moderators`, `is_moderator()`). Migration
  `20261020090000_reports.sql` appliquée ; le responsable (compte Google « Mickael ») est
  modérateur. Envoi d’un signalement et page de modération **pas
  testés de bout en bout** (la session Claude ne joint pas supabase.co).

- **19/10 (soir, fin)** — PR #8 (comptes), #9 (onglet en arrière-plan : joueur oublié / « solo »),
  #10 (page `confidentialite.html`, exigée par Google) fusionnées et mises en ligne. Le
  responsable a configuré Supabase (URL, fournisseurs GitHub + Google, e-mail désactivé,
  `delete_my_account` collée dans le SQL Editor) et Google Auth Platform (Branding, publication).
  **Connexion Google vérifiée** (1 compte, profil « Mickael » en base). Connexion GitHub : pas
  encore testée. Correctif d’affichage (branche `fix/affichage-reglages`) : cases des réglages
  écrasées par la règle CSS `.check` des objectifs ; barre du haut inaccessible sur téléphone.
  Choix : on garde le projet Supabase actuel (LaChillance reste en pause) ; le compte Supabase
  « leakmic » créé par le responsable n’est pas utilisé.

- **19/10 (nuit)** — Robot d’accueil renommé **Joshua** (PR `content/robot-joshua`). Comptes
  joueurs : projet Supabase `malinosland` créé (Paris, gratuit) après mise en pause de
  LaChillance (accord du responsable : 2 projets gratuits actifs max). Table `profiles` + RLS +
  `my_profile` appliqués en base **par morceaux** (l’outil MCP expirait sur les gros blocs) ;
  **`delete_my_account` pas encore appliquée** (l’outil attend une confirmation : à coller dans le
  SQL Editor, voir COMPTES.md étape 1). Code : `src/services/account.ts` (auth-js + postgrest-js
  chargés à la demande, PKCE), `AccountBox`, vérification par le Worker (`server/src/account.ts`),
  marque ✓, workflow `keepalive.yml`. Tests : 100 unitaires (dont PGlite), 13 d’intégration,
  deux joueurs en ligne. **Jamais testé avec un vrai compte GitHub/Google** (fournisseurs pas
  encore configurés, et la session Claude ne peut pas joindre supabase.co).

- **19/10 (soir, suite)** — PR #5 fusionnée, première mise en ligne réussie. Les textes du jeu
  disaient « aucune donnée envoyée » : faux en ligne, corrigés. Le réseau des sessions Claude ne
  peut pas joindre `*.pages.dev` / `*.workers.dev` : vérification faite par le workflow lui-même.
  **Pas encore vérifié : deux vraies personnes jouant ensemble en ligne.**
- **19/10 (soir)** — PR #4 fusionnée. Workflow « Mise en ligne » (`deploy.yml`) : vérifie, crée le
  projet Pages si besoin, déduit les adresses via l’API Cloudflare, publie le Worker (origine du
  site seule autorisée) puis le site, vérifie `/health` et le refus d’une origine inconnue. Testé
  seulement à blanc (logique simulée, `wrangler deploy --dry-run`) : **jamais exécuté pour de vrai**.

- **19/10 (après-midi)** — Serveur temps réel v0.2 : `server/src/hub.ts` (règles pures),
  `WorldRoom.ts` (Durable Object, hibernation, compteur quotidien persisté), `index.ts` (routes,
  contrôle d’origine). Côté jeu : `ServerTransport`, `src/config.ts` (`VITE_REALTIME_URL`),
  messages `rate`/`notice`, CSP générée au build (`public/_headers` supprimé, émis par Vite).
  Docs : REALTIME_NETWORK réécrit, DEC-013.
- **19/10 (matin)** — Portabilité (`AGENTS.md`, guide de reprise, secrets stockés en ligne) ; test
  e2e réparé (écouteurs clavier en `useLayoutEffect`, pas de flou en qualité basse).
- **18/10** — v0.1 complète ; casque qui traversait les coiffures corrigé ; documentation pour la
  communauté.

## Ce qui n’est PAS fait (volontairement)

- Collisions vérifiées côté serveur (seules la vitesse et les limites de la carte le sont).
- Historique du chat : abandonné (rien n’est conservé).
- Étages de la tour, toit-terrasse, annuaire : « bientôt », sans date (plus tard, à discuter).
- Musée (v0.4), agenda (v0.5), Coins coins (v0.6) : prévus dans le plan, pas commencés.

## Tests à faire en ligne

Jamais faits par une session Claude (il faut de vrais comptes et de vrais navigateurs) ; à faire
par le responsable, avec un 2ᵉ compte (David, Bloom…) :

1. **Décoration** : décorer son studio, recharger, puis vérifier qu’un 2ᵉ compte présent voit les
   changements en direct.
2. **Invitations** : inviter un compte connecté → la carte « Y aller » apparaît chez lui et il
   peut entrer ; retirer l’invitation le raccompagne.
3. **Rôles** : 👥 Joueurs connectés → « 🛡️ Nommer modérateur » sur un compte connecté → le badge
   apparaît chez tout le monde sans recharger ; retirer.
4. **Anti-robots** : envoyer une idée **en navigation privée** (vérification Turnstile réelle),
   puis la voir dans ⚙️ Réglages → 🛡️ Modération ; signaler un visiteur depuis un compte.
5. **Sons et nuit** : écouter l’ambiance (grillons la nuit), régler le volume ; vérifier
   « Toujours de jour ».
6. **Téléphone** : jouer quelques minutes sur un vrai téléphone (chat, bouton d’action, zoom).

## Points en attente de décision du responsable

1. Supprimer la dernière ancienne branche `feature/initial-prototype` sur GitHub.
2. Titre affiché sous le pseudo doré : « Le Décodeur en chef » (choisi) ; à donner à Renaud
   quand il aura un compte.

## Problèmes connus / limites

- Quotas Cloudflare (≈ 2 millions de messages WebSocket entrants par jour en gratuit, d’où le
  budget de 1,4 million) : vérifiés le 21/10/2026 (100 000 requêtes/jour, messages entrants
  comptés 1 pour 20).
- Les visiteurs (sans compte) peuvent prendre n’importe quel pseudo libre : seuls les comptes ont
  la marque ✓ et un pseudo réservé.
- Supabase gratuit : 2 projets actifs max (LaChillance en pause depuis le 19/10, relançable 90 j).
  L’outil MCP de Supabase n’exécute pas de suppression (`drop`) sans confirmation : préférer des
  migrations qui ajoutent plutôt que remplacent.
- Le journal complet des jobs GitHub n’est pas lisible depuis une session Claude : les tests
  écrivent leurs étapes en annotations, lisibles via l’API.
- **Performances non mesurées sur du vrai matériel** (seulement en rendu logiciel, sans GPU).
- Phaser ≈ 357 Ko gzip (piste : build allégé, F33). Mobile : pas encore de joystick virtuel ni de
  vrai test sur téléphone.

## Prochaines étapes suggérées (dans l’ordre)

Selon [PLAN_EVOLUTION.md](PLAN_EVOLUTION.md) §5 et §10, une PR à la fois, chacune présentée au
responsable avant la suivante :

1. PR 7 — base du Musée (en cours, migration à appliquer à la fusion).
2. PR 4 et 5 — Quiz IA (questions à faire relire avant fusion), borne de la salle de jeux.
3. PR 6 — mesures de fréquentation (dans les limites du journal existant).
4. PR 7 à 11 — Musée des Malinos (migration après accord).

## Repères rapides pour reprendre

- Démarrer : `npm install && npm run dev` → http://localhost:5173 (`/art-preview.html` pour les assets).
- Multijoueur local : `npm run server:install` une fois, `npm run server:dev`, `.env.local` copié de
  `.env.example`, puis `npm run dev` dans deux navigateurs.
- Débogage / tests automatisés : ajouter `?debug` à l’URL expose `window.__malinosDebug`
  (liste complète dans [`AGENTS.md`](../AGENTS.md) §9, dont `time(h)` pour voir la nuit et
  `role(r)` pour l’aperçu du statut doré).
- Fichiers centraux : `src/game/scenes/WorldScene.ts` (assemblage), `src/world/WorldModel.ts`,
  `src/world/PlayerController.ts`, `src/content/maps/hub.json`, `src/content/catalog.ts`,
  `src/game/art/objects.ts`, `src/game/art/characters.ts`, `src/multiplayer/NetworkClient.ts`,
  `src/multiplayer/ServerTransport.ts`, `server/src/hub.ts`,
  `src/state.ts`.
