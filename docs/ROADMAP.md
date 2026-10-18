# Feuille de route

Développement progressif : chaque version est utilisable et montrable. Les versions évolueront selon
les retours des Malinos. Légende : ✅ fait · 🔶 partiel · ⬜ à faire.

## v0.1 — Prototype jouable (branche `feature/initial-prototype`)

- ✅ Application web (Vite + TypeScript + Phaser 4 + Preact)
- ✅ Carte isométrique originale : le Hub (hall, coworking, conférence, salon, galerie fermée, jardin, terrasse, chantier)
- ✅ Espaces intérieurs visibles (murs du fond hauts, cloisons basses)
- ✅ Personnage contrôlable, 6 styles prêts à porter + personnalisation simple
- ✅ Déplacement souris (A*) et clavier (ZQSD / WASD / flèches), collisions, caméra qui suit, zoom
- ✅ Mobilier et décorations (≈ 40 types d’objets procéduraux)
- ✅ Interactions réelles : dialogues, panneaux, ascenseur, café, miroir, sièges
- ✅ Interface légère : zone, objectifs « Premiers pas », mini-carte, chat, émotes
- ✅ Zones futures identifiables (« bientôt » : galerie v0.4, tour v0.3, étages)
- ✅ Fonctionnement 100 % local ; démo multi-onglets via BroadcastChannel
- ✅ Documentation, tests unitaires, test de bout en bout, CI GitHub Actions
- ⬜ Tests de performance sur machines réelles représentatives (voir TESTING.md)

## v0.2 — Première expérience multijoueur

- ⬜ Inscription / connexion (Supabase Auth : lien magique, GitHub, Discord) + protection anti-robots (Turnstile)
- ⬜ Comptes, profils simples, sauvegarde de l’avatar
- ⬜ Présence en ligne, synchronisation des déplacements (Worker + Durable Object)
- ⬜ Chat local et général avec limites, modération minimale (signaler, masquer)
- ⬜ Déploiement gratuit (Cloudflare Pages) — **après validation du responsable**
- ⬜ Plafond de joueurs par zone, file d’attente, compteurs de quotas
- ⬜ Tests réseau (charge simulée)

## v0.3 — Espaces personnels

- ⬜ Attribution d’un logement dans la Tour communautaire
- ⬜ Modes d’accès : privé (défaut), sur invitation, public — contrôlés côté serveur
- ⬜ Invitations et retrait immédiat d’accès
- ⬜ Premier éditeur de décoration (grille, rotation, suppression), catalogue d’objets partagé
- ⬜ Sauvegarde persistante des dispositions (JSON versionné compact)

## v0.4 — Expansion communautaire

- ⬜ Étages additionnels chargés à la demande, ascenseur fonctionnel
- ⬜ Galerie des Malinos (fiches projets modérées, liens externes sécurisés)
- ⬜ Annuaire des membres et de leurs espaces publics
- ⬜ Nouvelles salles, outils d’administration, validation des contenus

## v0.5 — Vie communautaire

- ⬜ Événements (salle de conférence + lien visio externe)
- ⬜ Expositions temporaires, défis créatifs
- ⬜ Premiers mini-jeux (modules indépendants, borne d’arcade)

## v1.0 — Univers communautaire stable

- ⬜ Monde extensible, espaces personnels aboutis, outils de contribution
- ⬜ Modération robuste, galerie, événements
- ⬜ Documentation complète, infrastructure gratuite maîtrisée, performances et sécurité validées
