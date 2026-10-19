# Glossaire

Les mots techniques utilisés dans le projet, expliqués simplement.

## Le jeu

| Mot             | Explication                                                                    |
| --------------- | ------------------------------------------------------------------------------ |
| **Isométrique** | Une vue de trois quarts, en hauteur, comme une maquette posée sur une table.   |
| **Voxel**       | Un style où tout est fait de petits cubes (comme des briques de construction). |
| **Hub**         | Le bâtiment principal de MalinosLand, point de rencontre de tous.              |
| **Zone**        | Une partie du monde : hall, coworking, salon, jardin…                          |
| **Tuile**       | Une case du sol. Le Hub mesure 34 × 30 tuiles.                                 |
| **Avatar**      | Ton personnage dans le jeu.                                                    |
| **Émote**       | Une petite icône qui s’affiche au-dessus de la tête (👋, ☕…).                 |
| **PNJ**         | Personnage non joueur, comme Malo le robot.                                    |
| **i/s (FPS)**   | Images par seconde : plus c’est haut, plus le jeu est fluide.                  |

## GitHub et la collaboration

| Mot                           | Explication                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Dépôt (repository)**        | Le dossier en ligne qui contient tout le projet et son historique.                                         |
| **Commit**                    | Une sauvegarde d’un ensemble de modifications, avec un message qui l’explique.                             |
| **Branche**                   | Une copie de travail parallèle. On y fait ses changements sans toucher à la version principale.            |
| **`main`**                    | La branche principale, la version officielle. Elle est **protégée** : on ne la modifie jamais directement. |
| **Fork**                      | Ta propre copie du dépôt sur ton compte GitHub, pour proposer des changements.                             |
| **Pull request (PR)**         | Une **demande de modification** : « voici mes changements, pouvez-vous les ajouter ? ».                    |
| **Revue (review)**            | La relecture d’une pull request avant d’accepter les changements.                                          |
| **Fusion (merge)**            | L’ajout des changements d’une branche dans `main`, après validation.                                       |
| **Issue**                     | Un ticket pour signaler un bug ou proposer une idée.                                                       |
| **CI (intégration continue)** | Des vérifications automatiques lancées par GitHub à chaque pull request (tests, compilation).              |

## Technique

| Mot                           | Explication                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Navigateur**                | Chrome, Firefox, Edge, Safari… Le jeu fonctionne dedans, sans installation.                                  |
| **Build**                     | La transformation du code en fichiers prêts à être mis en ligne.                                             |
| **Test automatique**          | Un petit programme qui vérifie qu’une partie du jeu fonctionne comme prévu.                                  |
| **Phaser**                    | Le moteur de jeu utilisé pour afficher le monde.                                                             |
| **Preact**                    | La bibliothèque utilisée pour l’interface (menus, chat, fenêtres).                                           |
| **TypeScript**                | Le langage de programmation du projet (du JavaScript avec des vérifications en plus).                        |
| **Hébergement**               | Le service qui met le jeu en ligne pour que tout le monde y accède.                                          |
| **Serveur temps réel**        | Le programme qui transmet en direct les déplacements et messages entre joueurs (v0.2).                       |
| **Base de données**           | L’endroit où seront enregistrés les comptes, avatars et logements (v0.2).                                    |
| **Quota**                     | La quantité maximale gratuite qu’un service accepte (par exemple un nombre de messages par jour).            |
| **Offre gratuite**            | La formule sans paiement d’un service en ligne. MalinosLand n’utilise que celles-ci.                         |
| **Cloudflare / Supabase**     | Les services gratuits choisis pour héberger le jeu et les comptes (offres gratuites, sans carte bancaire).   |
| **RLS**                       | Des règles dans la base de données qui empêchent, par exemple, d’entrer dans un logement privé.              |
| **CSP**                       | Une protection du navigateur qui bloque les scripts malveillants.                                            |
| **Jeton d’API**               | Une « clé » secrète qui autorise un programme (ici GitHub) à agir sur un compte (ici Cloudflare).            |
| **Secret GitHub**             | Une valeur rangée chiffrée dans les réglages du dépôt, utilisable par les vérifications mais jamais lisible. |
| **Workflow (GitHub Actions)** | Une suite d’étapes automatiques lancée par GitHub : tests à chaque PR, ou mise en ligne au clic.             |
