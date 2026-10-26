# État des lieux et plan de départ du « village »

> **En bref.** Étape 0 du [cahier des charges](CAHIER_DES_CHARGES_VILLAGE.md), faite le
> 26 octobre 2026 sur `main` (après la PR #61). On y trouve ce qui existe vraiment, ce qui reste
> à vérifier en ligne, les limites gratuites, les mesures disponibles, les écarts avec le cahier
> des charges, puis les deux premiers lots proposés : l’accueil **« Aujourd’hui »** (étape 1) et
> le **prototype du bac à sable en cubes** (palier B0). Rien n’a été réécrit pour cet état des
> lieux : c’est une lecture du code, des migrations et des PR fusionnées.

## 1. Ce qui existe

Légende : **Livré** = dans le jeu en ligne ; **à vérifier** = livré mais jamais essayé en vrai
par une session Claude (pas de vrais comptes ni d’Internet dans la session) ; **Annoncé** =
affiché « bientôt » dans le jeu ; **Absent** = rien dans le code.

| Domaine                                                                                               | État              | Détail                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Monde et ambiance                                                                                     | Livré             | Hub isométrique (Phaser 4) : hall, coworking, conférence, salon, terrasse, jardin, parc, verger, potager, forêt et feu de camp, salle de jeux, musée. Jour et nuit à l’heure de Paris, sons limités à 10 s par pièce.                                                                                                                            |
| Personnage                                                                                            | Livré             | Malino 3D (6 styles, 4 couleurs indépendantes) et personnage classique (coiffures, accessoires). Pas de tenues sauvegardées, pas de nouvelles formes de coiffure pour le 3D.                                                                                                                                                                     |
| Multijoueur                                                                                           | Livré             | Serveur Cloudflare (Durable Object) : déplacements, chat local et global, 8 émotes, @pseudo. Hors ligne : démo entre onglets.                                                                                                                                                                                                                    |
| Comptes                                                                                               | Livré             | Google ou GitHub (Supabase). Les visiteurs jouent sans compte (profil gardé dans le navigateur).                                                                                                                                                                                                                                                 |
| Premiers pas, carnet, secrets                                                                         | Livré             | 8 objectifs, 10 secrets de Joshua ; progression synchronisée pour les comptes.                                                                                                                                                                                                                                                                   |
| Quiz IA                                                                                               | Livré             | Partie libre et défi de la semaine ; scores gardés **dans le navigateur** (pas de classement partagé).                                                                                                                                                                                                                                           |
| « Que faire maintenant ? »                                                                            | Livré             | Panneau 🧭 et écran du hall : 5 idées au plus (objectif, défi, présents, secret, studio ouvert, nouveau au musée, balade). Les boutons font **marcher** l’avatar jusqu’au lieu.                                                                                                                                                                  |
| Studios                                                                                               | Livré, à vérifier | Un studio par compte ; accès privé / sur invitation / public ; invitations. Éditeur : **21 types de meubles**, **40 objets au plus** (vérifié par la base), poser, tourner (R), couleur (C), déplacer (M), ranger, tout annuler, enregistrer. Visite d’un studio public en l’absence du propriétaire prévue par le code, jamais essayée en vrai. |
| Musée                                                                                                 | Livré             | Exposer (formulaire, limites), modération, 7 stands, borne « Toutes les créations », fiche, signalement, « Essayer ici », aperçu automatique (**vérifié en vrai le 26/10** avec MalinosLand). Stands cliquables et relecture immédiate après validation : corrigés par #61, à revérifier.                                                        |
| Rôles et modération                                                                                   | Livré, à vérifier | Responsable, modérateurs (🛡️), statut doré ; signalements de joueurs, idées et bugs (Turnstile), projets.                                                                                                                                                                                                                                        |
| Mesures                                                                                               | Livré             | Journal des connexions (📋 Connexions, responsable seulement), voir §3.                                                                                                                                                                                                                                                                          |
| Événements                                                                                            | Annoncé           | Panneau 🎤 : « Aucun événement n’est programmé ». Pas d’agenda.                                                                                                                                                                                                                                                                                  |
| Étages, toit-terrasse, annuaire                                                                       | Annoncé           | « Bientôt » dans l’ascenseur.                                                                                                                                                                                                                                                                                                                    |
| Bâtiment des créations                                                                                | Annoncé           | Maquette sur le chantier (#61).                                                                                                                                                                                                                                                                                                                  |
| Ateliers IA, retours sur projets, favoris, parcours, pages partageables, salles jouables, bac à sable | Absent            | Voir §4.                                                                                                                                                                                                                                                                                                                                         |

**Tests à faire en ligne** (jamais faits par une session Claude, liste complète dans
[SESSION_HANDOFF.md](SESSION_HANDOFF.md)) : décoration vue par un 2ᵉ compte, invitations, rôles en
direct, anti-robots en navigation privée, sons et nuit, vrai téléphone.

## 2. Limites gratuites à respecter

| Service           | Limite utile                                                                               | Ce qui consomme aujourd’hui                                                              |
| ----------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Durable Objects   | 100 000 requêtes/jour (messages entrants comptés 1 pour 20), au-delà : erreur sans facture | Déplacements, chat, émotes. Le serveur garde une marge (budget 1,4 million de messages). |
| Workers           | 100 000 requêtes/jour                                                                      | Visionneuse, aperçus, vérifications.                                                     |
| Workers KV        | 1 Go, 1 000 écritures/jour                                                                 | Aperçus du musée (≈ 20 Ko chacun).                                                       |
| Browser Rendering | 10 minutes de navigateur/jour                                                              | Captures d’aperçus (modérateurs, 20 par heure au plus).                                  |
| Supabase          | 500 Mo de base, pause après 7 jours sans activité (une tâche GitHub la garde éveillée)     | Comptes, studios, progression, musée, modération.                                        |
| Cloudflare Pages  | 500 mises en ligne/mois                                                                    | Une par fusion.                                                                          |

Conséquence pour la suite : une écriture en base par action de joueur (meuble, bloc) est
exclue ; on regroupe et on plafonne. Un bac à sable partagé passerait par le Durable Object (temps
réel) et une sauvegarde compacte, pas par une écriture par bloc.

## 3. Mesures disponibles (référence de départ)

- **Journal des connexions** (serveur, 90 jours, responsable seulement) : pseudo, compte ou
  visiteur, arrivée et départ. Rien d’autre (ni position, ni messages).
- Un **compte** garde le même identifiant d’une visite à l’autre : on peut savoir s’il revient
  une semaine plus tard. Un **visiteur** reçoit un nouvel identifiant à chaque chargement : il ne
  faut pas le compter comme une personne unique.
- Pas de mesure d’actions (quiz joué, studio modifié, projet ouvert) : on ne sait pas si une
  visite a été « utile ». Toute nouvelle mesure demandera l’accord du responsable (finalité,
  durée de conservation, coût), comme le prévoit le cahier des charges (§10).
- Proposition sans nouvelle collecte : ajouter au panneau 📋 Connexions un petit résumé calculé
  à partir du même journal (comptes revenus au moins 7 jours après leur première visite, durée
  médiane des visites). À faire dans un lot dédié si le responsable le souhaite.

## 4. Écarts avec le cahier des charges

| Cahier des charges                                                 | Existant                                                                      | Écart                                                                                                                                                                      |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §6 Trois envies à la première visite, reprise au retour (3 cartes) | Création du personnage puis Hub ; objectifs « Premiers pas » ; 🧭             | Pas de choix d’envie ; pas de « reprendre » au retour ; 🧭 fait marcher au lieu d’ouvrir directement.                                                                      |
| §6 Accès direct (cartes)                                           | Panneaux existants (quiz, musée, studios, carnet) ouverts surtout en marchant | Manque une entrée « Aujourd’hui » qui ouvre directement les panneaux ; sur téléphone, jusqu’à 8 boutons en haut.                                                           |
| §7A Chez moi                                                       | Éditeur complet mais simple                                                   | Pas d’annuler/rétablir pas à pas, ni de duplication, ni de sols/murs, ni de modèles de départ, ni de plans multiples.                                                      |
| §7B Personnage                                                     | Couleurs et styles                                                            | Pas de nouvelles formes (coiffures, lunettes, couvre-chefs) pour le Malino 3D, ni de tenues sauvegardées ; émotes « remercier, applaudir » absentes (8 émotes existantes). |
| §7C Ateliers IA                                                    | Quiz                                                                          | Aucun atelier.                                                                                                                                                             |
| §7D Projets vivants                                                | Musée (projet figé)                                                           | Pas de statut, de prochaine étape, d’appel à tester, de retours structurés ni d’historique.                                                                                |
| §7E Découverte                                                     | 7 stands + liste par catégorie                                                | Pas de favoris, de sélection éditoriale ni de rotation.                                                                                                                    |
| §7F Rendez-vous                                                    | Panneau 🎤 vide                                                               | Pas d’agenda.                                                                                                                                                              |
| §7G Progression                                                    | Objectifs, carnet                                                             | Pas de parcours (explorateur, créateur…) ni de collections.                                                                                                                |
| §7H / §13 Salles jouables, bac à sable                             | —                                                                             | Tout est à faire ; le moteur actuel n’est pas un moteur de terrain en volume (§6 ci-dessous).                                                                              |

Demandes du responsable déjà notées et à placer dans ce plan : **aperçu choisi par l’auteur**
(§7D/§7E), **pseudos stylés** des modérateurs et du responsable (§7G), interdire à un modérateur
de **valider son propre projet** (sécurité du musée).

## 5. Premier lot proposé — étape 1 : « Aujourd’hui » (PR 12)

> _Réalisé dans la PR 12 (DEC-042)_ : envies dans une carte non bloquante, panneau
> « Aujourd’hui » avec accès direct et 🚶, « Reprends ici » une fois par jour, menu ☰ sur
> téléphone. Écart avec le plan : l’envie « Créer » commence par le personnage (le studio et
> l’exposition demandent un compte).

**But :** qu’un nouveau venu, même non joueur, fasse une première chose réussie en moins d’une
minute, et qu’un habitué retrouve tout de suite de quoi faire. Aucun nouveau contenu : on rend
accessible ce qui existe.

1. **Trois envies à la première visite** (après la création du personnage, une seule fois) :
   « Comprendre l’IA », « Créer quelque chose », « Rencontrer les Malinos », et « Passer ». Le
   choix est gardé dans le navigateur (pas d’envoi), modifiable plus tard. Chaque envie mène à
   une **première réussite possible sans compte** :
   - Comprendre l’IA → une partie de Quiz IA, ouverte directement ;
   - Créer quelque chose → personnaliser son Malino, puis découvrir les créations du musée (« Essayer
     ici ») ; l’exposition et le studio sont proposés ensuite, avec le compte ;
   - Rencontrer → rejoindre les Malinos présents ou, si l’on est seul, le chat global et les
     studios ouverts, avec un message honnête (« Le Hub est calme en ce moment »).
2. **🧭 devient « Aujourd’hui »** : même panneau, mêmes données, mais chaque carte peut **ouvrir
   directement** le panneau concerné (quiz, musée, studios, carnet) ; « Y aller » à pied reste
   proposé. Les idées tiennent compte de l’envie choisie.
3. **Reprise au retour** : au plus **3 cartes**, une fois par jour, discrètes (pas de fenêtre
   imposée) : projet validé ou en attente, défi de la semaine pas encore joué, nouveau au musée,
   secret en cours, studio à terminer.
4. **Téléphone** : les boutons du bandeau se regroupent dans un menu ; « Aujourd’hui » reste
   visible.

|                        |                                                                                                                                                                                                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fichiers               | `src/world/activities.ts` (logique, testée), `src/content/activities.ts`, `src/ui/panels/Activities.tsx`, `src/ui/hud/TopBar.tsx`, écran de fin de création du personnage, `src/services/storage.ts` (envie), `tests/activities.test.ts`, étape e2e, docs.                         |
| Dépendances            | Aucune.                                                                                                                                                                                                                                                                            |
| Base de données        | Aucune migration.                                                                                                                                                                                                                                                                  |
| Risques                | Doublon avec les objectifs « Premiers pas » (à fusionner dans le même parcours, pas un 2ᵉ tutoriel) ; trop de fenêtres à l’arrivée (une seule, facultative) ; place sur téléphone.                                                                                                 |
| Critères d’acceptation | Un novice choisit une envie et termine une activité sans aide ; tout se fait au clavier et au doigt ; aucun compte demandé avant une action qui en a besoin ; au retour, 3 cartes au plus, jamais de fenêtre forcée ; tests unitaires et e2e (première visite, retour, téléphone). |

## 6. Prototype du bac à sable — palier B0 (PR 13)

> _Réalisé dans la PR 13 (DEC-043), voir [CHANTIER_DES_MONDES.md](CHANTIER_DES_MONDES.md)_. Le
> responsable a demandé en cours de route un vrai jeu très inspiré des jeux de construction en
> cubes, avec le choix entre première personne et vue isométrique : la comparaison « deux
> rendus séparés » est devenue **un seul moteur 3D (Three.js) avec deux caméras**, et le
> prototype contient déjà récolte, outils et fabrication (une partie du palier B3).

Le jeu actuel dessine des objets en 2D qui **semblent** en volume : il n’a pas de terrain en
cubes que l’on peut creuser. B0 compare deux rendus **sur une page de prototype à part**
(`/chantier.html`, non reliée au jeu, comme `/art-preview.html`), sans serveur ni base :

- **Modèle commun, sans moteur** (`src/sandbox/`, testé) : petite carte bornée (environ
  32 × 32 × 16 blocs), terrain reproductible, 6 à 8 sortes de cubes (terre, pierre, bois, verre,
  feuillage, couleurs), casser, poser, portée limitée, retour au point sûr, sauvegarde compacte
  des modifications dans le navigateur.
- **Rendu A — isométrique** avec le moteur actuel (Phaser), dans le style du Hub. Pour voir sous
  la surface : une « coupe » par niveau (curseur haut/bas). Aucune nouvelle dépendance.
- **Rendu B — 3D** avec **Three.js** (bibliothèque libre, licence MIT, environ 170 Ko compressés),
  chargée **seulement** sur cette page. Caméra qui tourne autour du personnage, viseur, commandes
  au doigt. Nouvelle dépendance : à justifier dans DECISIONS.md et **à accepter par le
  responsable** avant d’être ajoutée.
- **Mesures documentées** : poids de chaque version, images par seconde (rendu logiciel ici, à
  confirmer par le responsable sur sa machine et son téléphone), lisibilité du creusage.

Critère de B0 : le responsable essaie les deux versions et choisit celle qui donne envie de
construire. Rien n’est mis en ligne sans son accord (la page peut être essayée en local, ou
publiée en page cachée s’il l’autorise).

## 7. Ordre proposé

1. PR 12 — étape 1 « Aujourd’hui » (ci-dessus).
2. PR 13 — B0, prototype du bac à sable (après accord sur Three.js pour le rendu B).
3. Étape 2 — éditeur du studio : annuler/rétablir, dupliquer, sols et murs, 2 ou 3 modèles de
   départ.
4. Étape 3 — studios publiés, favoris, liens vers le musée ; puis un premier défi animé à la main.
5. Demandes en attente (aperçu choisi par l’auteur, pseudos stylés, auto-validation interdite)
   glissées entre ces lots selon la priorité du responsable.

Une PR à la fois, présentée au responsable avant la suivante.
