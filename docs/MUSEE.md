# Musée des Malinos

> **En bref.** Chaque membre connecté peut proposer un projet (site, application, outil IA, jeu,
> création, dépôt open source). Le projet reste **en attente** jusqu’à ce qu’un **modérateur** le
> valide ; il est ensuite exposé à tous. L’auteur peut le retirer quand il veut. Le jeu dessine
> lui-même l’**affiche** de chaque projet : aucune image n’est envoyée ni stockée.
>
> État (v0.4 en cours) : la base (PR 7) et le formulaire avec la modération (PR 8) sont faits.
> La **salle du musée** (stands, affiches dans le Hub, fiche du projet) arrive avec la PR 9 ; la
> démo « Essayer ici » avec la PR 10. Voir [PLAN_EVOLUTION.md](PLAN_EVOLUTION.md).

## Pour les membres : exposer un projet

On ouvre le formulaire depuis le **panneau devant la galerie**, dans le Hub (« Exposer mon projet
au musée »), ou depuis ⚙️ Réglages → **🖼️ Mes projets** quand on est connecté.

![Formulaire « Exposer un projet » avec l’aperçu de l’affiche](images/musee-formulaire.png)

- **Titre** (60 caractères au plus), **catégorie**, **adresse**, **description** (une ou deux
  phrases, 280 caractères au plus) et jusqu’à **3 mots-clés**.
- L’adresse doit être **publique et sécurisée** (`https://`). Si on oublie `https://`, le jeu
  l’ajoute. Sont refusées : les adresses `http://`, les adresses IP, les numéros de port, les
  identifiants dans l’adresse, les adresses locales et celles de MalinosLand. Le message dit
  quoi corriger.
- L’**aperçu** à droite montre l’affiche qui sera exposée ; il change pendant qu’on écrit.
- Une case à cocher confirme que c’est son projet (ou qu’on y a participé) et qu’il ne demande
  pas d’informations personnelles sans raison.
- Limites anti-abus (vérifiées par la base) : 5 propositions par jour, 3 projets en attente et
  10 projets exposés au plus par membre.

L’onglet **Mes projets** montre le statut de chacun (en attente, exposé, refusé, retiré), le
**motif** laissé par le modérateur en cas de refus, et un bouton **Retirer**.

![Mes projets : statuts et motif de refus](images/musee-mes-projets.png)

_Captures faites avec des données d’exemple._

## Pour les modérateurs

Panneau 🛡️ **Modération** → onglet **🖼️ Musée** :

- **En attente** : les projets proposés, du plus ancien au plus récent. **Ouvrir le site** (nouvel
  onglet) et le vérifier avant de valider : il doit fonctionner, correspondre à la description et
  ne rien demander de suspect.
- **✓ Valider** expose le projet. **Refuser…** propose des motifs tout faits (lien cassé, hors
  sujet, contenu inapproprié, données personnelles, description à préciser) ou un texte libre de
  140 caractères ; ce motif est montré à l’auteur.
- **Exposés** : les projets visibles, avec **Retirer…** (même choix de motif).

![Onglet Musée du panneau de modération](images/musee-moderation.png)

Les droits sont vérifiés **par la base** (fonction `moderate_project`) : un joueur qui n’est pas
modérateur ne peut rien valider, même en modifiant le jeu.

## Les affiches

Chaque catégorie a ses couleurs, son motif de fond (treillis, icônes d’applications, réseau de
neurones, pixels, taches de peinture, branches de code) et son pictogramme lumineux posé sur un
socle isométrique. Le motif varie d’un projet à l’autre ; le titre s’adapte (jusqu’à 3 lignes).

![Les affiches des six catégories](images/musee-affiches.png)

Toutes les affiches sont visibles sur la page de développement `/art-preview.html`
(`npm run dev`).

## Pour les développeurs

| Fichier                                         | Rôle                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------- |
| `supabase/migrations/20261027090000_museum.sql` | Tables, règles d’accès, plafonds, fonctions (voir DATABASE.md)         |
| `src/content/museum.ts`                         | Catégories : libellés, icônes, couleurs des affiches                   |
| `src/core/museum.ts`                            | Vérification du formulaire, mêmes règles d’adresse que la base (testé) |
| `src/services/museum.ts`                        | Appels à la base ; données reçues relues et nettoyées avant affichage  |
| `src/game/art/posters.ts`                       | Dessin des affiches (Canvas 2D, sans Phaser : formulaire et salle)     |
| `src/ui/panels/Museum.tsx`                      | Panneau du musée et onglet de modération                               |

Sécurité : les textes passent par `sanitizeText` / `sanitizeName` et ne sont jamais interprétés
comme du HTML ; une adresse qui ne passe pas `isValidProjectUrl` n’est jamais affichée comme lien ;
les liens s’ouvrent dans un nouvel onglet avec `rel="noopener noreferrer"`. Les mêmes adresses
d’exemple sont testées côté jeu et côté base (`tests/fixtures/projectUrls.ts`).
