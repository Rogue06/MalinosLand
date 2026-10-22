# Backlog des fonctionnalités

> **En bref (version simple)** : la liste de toutes les fonctionnalités prévues, avec leur version, leur importance et ce dont elles dépendent. Pour une présentation plus simple, voir la [feuille de route](ROADMAP.md) ; pour le plan des prochaines versions, [PLAN_EVOLUTION.md](PLAN_EVOLUTION.md).

Priorités : **P1** indispensable pour la version visée · **P2** important · **P3** bonus.
Statut : ✅ fait · 🔶 en partie · ⬜ à faire · ➖ abandonné. Les dépendances renvoient aux identifiants.

| ID  | Fonctionnalité                                                                       | Version | Prio | Dépend de | Statut |
| --- | ------------------------------------------------------------------------------------ | ------- | ---- | --------- | ------ |
| F01 | Hub isométrique jouable                                                              | 0.1     | P1   | —         | ✅     |
| F02 | Avatars : préréglages + personnalisation simple                                      | 0.1     | P1   | —         | ✅     |
| F03 | Déplacement clic (A*) + clavier, collisions                                          | 0.1     | P1   | F01       | ✅     |
| F04 | Interactions (dialogues, panneaux, assises, émotes)                                  | 0.1     | P1   | F01       | ✅     |
| F05 | Objectifs de découverte « Premiers pas »                                             | 0.1     | P2   | F04       | ✅     |
| F06 | Chat local + bulles, émotes                                                          | 0.1     | P2   | —         | ✅     |
| F07 | Démo multijoueur locale (BroadcastChannel)                                           | 0.1     | P3   | F06       | ✅     |
| F08 | Réglages qualité / FPS / animations                                                  | 0.1     | P2   | —         | ✅     |
| F09 | Comptes (Supabase Auth) + Turnstile                                                  | 0.2     | P1   | DEC-006   | ✅     |
| F10 | Serveur temps réel (Worker + Durable Object)                                         | 0.2     | P1   | DEC-006   | ✅     |
| F11 | Présence en ligne, liste des membres connectés                                       | 0.2     | P1   | F10       | ✅     |
| F12 | Chat général persistant (court historique) — abandonné : rien n’est conservé         | —       | —    | F10       | ➖     |
| F13 | Compteurs de quotas + dégradation contrôlée serveur                                  | 0.2     | P1   | F10       | ✅     |
| F14 | Signaler / masquer un joueur                                                         | 0.2     | P1   | F09       | ✅     |
| F15 | Suppression de compte et des données (RGPD)                                          | 0.2     | P1   | F09       | ✅     |
| F16 | Messagerie privée                                                                    | 0.3+    | P3   | F09, F14  | ⬜     |
| F17 | Logement personnel + modes d’accès                                                   | 0.3     | P1   | F09       | ✅     |
| F18 | Invitations, retrait d’accès, expulsion                                              | 0.3     | P1   | F17       | ✅     |
| F19 | Éditeur de décoration sur grille                                                     | 0.3     | P1   | F17       | ✅     |
| F20 | Étages chargés à la demande + ascenseur (plus tard, à discuter)                      | 0.6+    | P3   | F17       | ⬜     |
| F21 | Musée des Malinos (soumission, modération, stands, fiches) — ex-« Galerie »          | 0.4     | P1   | F09, F23  | ⬜     |
| F22 | Annuaire des membres (plus tard, à discuter)                                         | 0.6+    | P3   | F09       | ⬜     |
| F23 | Rôles de modération et outils d’administration (modérateurs nommés depuis le jeu ✓)  | 0.4     | P1   | F14       | 🔶     |
| F24 | Agenda des événements + lien visio externe (annoncé « bientôt »)                     | 0.5     | P2   | F11       | ⬜     |
| F25 | Expositions temporaires                                                              | 0.5     | P3   | F21       | ⬜     |
| F26 | Mini-jeux modulaires (borne d’arcade) ; le Quiz IA solo vient avant (F43)            | 0.5     | P3   | F10       | ⬜     |
| F27 | Défis communautaires                                                                 | 0.5     | P3   | F21       | ⬜     |
| F28 | Ressources IA de la communauté sur les ordinateurs du coworking                      | 0.45    | P2   | F42       | ⬜     |
| F29 | Assistant IA de construction (facultatif, sans API payante imposée)                  | 1.0+    | P3   | F19       | ⬜     |
| F30 | Espaces thématiques (devs, artistes, automatisation…)                                | 0.5+    | P3   | F20       | ⬜     |
| F31 | Support mobile / tactile soigné                                                      | 0.4+    | P2   | —         | 🔶     |
| F32 | Sprites PNG optionnels via TextureInfo                                               | 0.3+    | P3   | —         | ⬜     |
| F33 | Build Phaser allégé (modules inutilisés retirés)                                     | 0.2+    | P2   | —         | ⬜     |
| F34 | Cycle jour/nuit léger basé sur l’heure réelle de Paris                               | 0.3     | P3   | —         | ✅     |
| F35 | Boîte à idées et borne à bugs dans le jeu                                            | 0.2     | P2   | F09       | ✅     |
| F36 | Statut « absent » automatique (onglet caché)                                         | 0.2     | P2   | F10       | ✅     |
| F37 | Sons : arrivée d’un message (anti-spam), mentions @pseudo                            | 0.2     | P2   | F06       | ✅     |
| F38 | Ambiance sonore selon le lieu (oiseaux dehors…)                                      | 0.2+    | P3   | —         | ✅     |
| F39 | Vêtements personnalisés, plus de choix de tenues (demande du responsable, plus tard) | 0.3+    | P3   | F02       | ⬜     |
| F40 | Téléportation rapide depuis la mini-carte (écartée pour l’instant)                   | —       | P3   | —         | ⬜     |
| F41 | File d’attente quand une salle est pleine (entrée automatique)                       | 0.2     | P2   | F10       | ✅     |
| F42 | Panneau « Que faire maintenant ? » (écran du hall + bouton 🧭)                       | 0.35    | P1   | F05       | ⬜     |
| F43 | Quiz IA des Malinos (solo, défi de la semaine, scores dans le navigateur)            | 0.35    | P1   | —         | ⬜     |
| F44 | Mesures de fréquentation du responsable (journal existant, sans nouvelle collecte)   | 0.35    | P2   | —         | ⬜     |
| F45 | Musée : démo « Essayer ici » isolée (visionneuse, CSP par projet, sur clic)          | 0.4     | P1   | F21       | ⬜     |
| F46 | Feu de camp : histoires de Joshua et guitare                                         | 0.45    | P2   | —         | ⬜     |
| F47 | Secret de la semaine et studios ouverts mis en avant                                 | 0.45    | P2   | F42       | ⬜     |
| F48 | Carnet de Joshua (devinettes des secrets) et progression sur le compte               | 0.3     | P2   | F09       | ✅     |
| F49 | Statut doré, badge des modérateurs, barbe et micro                                   | 0.3     | P2   | F09       | ✅     |
| F50 | Coins coins 🦆 (bonus cosmétiques, jamais d’argent réel)                             | 0.6     | P3   | F43, F21  | ⬜     |

## Idées originales à creuser (non planifiées)

- **Ascenseur communautaire** : accès aux étages et aux espaces publics des membres.
- **Annuaire interactif** : recherche d’un membre, profil, projets.
- **Salon des projets** et **Galerie** : bornes cliquables ouvrant une fiche puis le lien externe.
- **Objets interactifs** : écrans, tableaux d’affichage, bornes affichant des informations.
- **Évolution du bâtiment** : nouvelles ailes et terrasses débloquées au fil des versions.
