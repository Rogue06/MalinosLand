# Infrastructure gratuite

> **En bref (version simple)** : aujourd’hui le jeu ne coûte rien car il n’utilise aucun serveur. Pour le multijoueur (v0.2), on prévoit des services **gratuits** qui, en cas de trop forte affluence, **bloquent** au lieu de **facturer**. Si la limite approche, le jeu ralentit ou fait patienter les joueurs : il reste toujours gratuit.

> **Règle absolue : aucune dépense obligatoire, jamais.** Aucun service ne doit pouvoir facturer
> automatiquement. Aucun compte ne doit être relié à une carte bancaire sans validation explicite
> du responsable du projet.

## 0. Statut des vérifications

Les quotas ci-dessous ont été relevés le **18/10/2026** à partir des pages de documentation
officielles de Cloudflare et de Supabase, **consultées via un moteur de recherche** : l’accès direct
à ces sites était bloqué depuis l’environnement de développement. Plusieurs chiffres sont donc
marqués **(à re-vérifier)**. **Avant tout déploiement, relire les pages officielles listées en fin
de document** et mettre ce fichier à jour. Les quotas gratuits ne sont jamais garantis à vie.

## 1. Version actuelle (v0.1)

Aucun serveur, aucune base de données, aucune API : **coût nul et aucun compte nécessaire.**
Le jeu est un site statique (`npm run build` → dossier `dist/`, ≈ 410 Ko gzip) qui peut être servi
par n’importe quel hébergeur statique gratuit, ou ouvert en local.

## 2. Comparaison des hébergeurs de site statique

| Service              | Offre gratuite (relevée)                                                                                                                | Risque de facturation                              | Avis                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------- |
| **Cloudflare Pages** | 500 builds/mois (1 à la fois, 20 min max), 20 000 fichiers/site, 25 Mio/fichier, requêtes de fichiers statiques gratuites et illimitées | Aucun sur l’offre gratuite (pas de carte demandée) | **Recommandé**            |
| GitHub Pages         | Site ≤ 1 Go, bande passante « souple » ≈ 100 Go/mois (à re-vérifier)                                                                    | Aucun                                              | Bonne solution de secours |
| Netlify / Vercel     | Offres gratuites avec plafonds mensuels ; conditions changeantes, usage non commercial pour Vercel Hobby (à re-vérifier)                | Variable selon l’offre                             | Non retenus               |

## 3. Temps réel (v0.2) : comparaison

| Service                                  | Offre gratuite (relevée)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Adapté aux déplacements ?                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Cloudflare Workers + Durable Objects** | Workers : 100 000 requêtes/jour, 10 ms de CPU par requête. Durable Objects (offre gratuite, stockage SQLite) : 100 000 requêtes/jour (HTTP, RPC, messages WebSocket, alarmes), 13 000 Go-s de durée/jour, remise à zéro à 00:00 UTC ; **au-delà, les opérations échouent avec une erreur, sans facturation**. Messages WebSocket **entrants** comptés 1 requête pour 20 ; sortants non comptés ; objet en hibernation non facturé en durée. Stockage : 5 Go par compte (pages contradictoires, à re-vérifier) | **Oui** (recommandé)                                                                    |
| Supabase Realtime                        | 200 connexions simultanées, 2 millions de messages/mois                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Non pour les mouvements (quota mensuel vite épuisé) ; possible pour présence/chat léger |
| Serveur dédié / VPS                      | Payant ou offres « toujours gratuites » exigeant une carte bancaire                                                                                                                                                                                                                                                                                                                                                                                                                                           | Écarté (règle de gratuité)                                                              |
| WebRTC pair-à-pair                       | Nécessite signalisation + serveurs TURN (payants à l’échelle)                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Écarté                                                                                  |

### Estimation de capacité avec Durable Objects (offre gratuite)

Hypothèses : messages de position à **5 Hz** quand on bouge, battement de cœur toutes les 4 s à
l’arrêt, joueurs en mouvement 30 % du temps → ≈ 1,7 message entrant/s/joueur.

- Requêtes : 100 000/jour × 20 = **2 millions de messages entrants/jour**.
  → 30 joueurs simultanés ≈ 50 msg/s ≈ **11 h de jeu à 30 par jour** ; 15 joueurs ≈ 22 h.
- Durée : 13 000 Go-s/jour ÷ 0,128 Go (mémoire facturée par instance) ≈ **28 h d’activité
  d’instance par jour** → un objet unique pour le Hub actif en continu tient (≈ 85 %).
- Chaque connexion WebSocket coûte 1 requête.

**Conclusion :** confortable pour une communauté qui démarre (quelques dizaines de joueurs
simultanés quelques heures par jour). Au-delà : fréquences réduites, plafond par salle, file
d’attente (voir §6). Le jeu reste gratuit ; il devient simplement limité.

## 4. Comptes et base de données (v0.2+) : comparaison

| Service          | Offre gratuite (relevée)                                                                                                                                                                                                                                                                                                                                                  | Atouts / limites                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Supabase**     | Base Postgres 500 Mo/projet, 2 projets actifs, authentification incluse (≈ 50 000 utilisateurs actifs/mois, à re-vérifier), stockage fichiers ≈ 1 Go et sortie ≈ 5 Go/mois (chiffres contradictoires, à re-vérifier). **Projet mis en pause après 7 jours d’inactivité** (données conservées, réactivation manuelle). Offre gratuite sans carte bancaire (à re-vérifier). | Auth prête à l’emploi (lien magique, GitHub, Discord), règles d’accès **RLS** en base, Postgres standard donc **portable** (pg_dump). **Recommandé.** |
| Cloudflare D1    | Base SQLite gratuite avec quotas journaliers de lectures/écritures (à re-vérifier)                                                                                                                                                                                                                                                                                        | Bien intégré aux Workers, mais pas d’authentification incluse (à développer soi-même : risqué). Alternative de repli.                                 |
| Firebase (Spark) | Gratuit avec plafonds ; passage au palier payant lié à une carte                                                                                                                                                                                                                                                                                                          | Écarté (risque de facturation, dépendance forte)                                                                                                      |

## 5. Architecture retenue (à valider — DEC-006)

```
Navigateur ──(HTTPS, statique)──▶ Cloudflare Pages  (le jeu)
     │
     ├──(WebSocket)──▶ Worker ──▶ Durable Object « hub »   (présence, mouvements, chat)
     │                    │  vérifie le jeton de session (JWT Supabase)
     └──(HTTPS)──────▶ Supabase (Auth + Postgres + RLS)     (profils, avatars, logements)
```

Portabilité : le client ne connaît que l’interface `Transport` et un petit module d’API ; changer
de fournisseur = écrire un nouveau transport et/ou migrer un dump Postgres.

## 6. Garde-fous contre les dépassements

**Côté client (déjà en v0.1, `NetworkClient`)**

- Position envoyée seulement si elle change, au plus 10 fois/s (5 fois/s prévu en ligne).
- Budget de messages par minute : la fréquence est **divisée par 2 au-delà de 70 %** puis par 4
  au-delà de 90 %.
- Anti-spam du chat (seau à jetons), émotes en liste fermée.

**Côté serveur (v0.2, à développer)**

- Compteurs internes de messages et de connexions par jour, stockés dans le Durable Object,
  avec des **plafonds conservateurs** (ex. 70 % des quotas officiels) indépendants des métriques
  du fournisseur.
- Politique de saturation, dans l’ordre :
  1. réduire la fréquence de synchronisation (ordre envoyé aux clients) ;
  2. limiter les interactions non essentielles (émotes) ;
  3. suspendre temporairement la création de nouveaux espaces ;
  4. plafonner les joueurs par salle et mettre en **file d’attente** ;
  5. **mode maintenance** en dernier recours (jeu solo hors ligne).
- Plafonds d’imports (aucun fichier libre importé : bibliothèque de meubles partagée).
- Sur l’offre gratuite Cloudflare, un dépassement provoque des **erreurs**, pas de facture : le
  client bascule alors en mode hors ligne avec un message clair.

**Côté comptes**

- Ne jamais enregistrer de carte bancaire. Ne jamais activer d’offre payante ni d’option
  « au-delà des quotas ».
- Vérifier chaque mois les tableaux de bord d’usage (Cloudflare, Supabase) ; consigner les
  relevés dans ce fichier.

## 7. Sauvegardes et portabilité

- Code : GitHub (public).
- Données (v0.2+) : export `pg_dump` régulier stocké **hors du dépôt public** (machine du
  responsable ou stockage privé) ; jamais d’artefact public contenant des données de joueurs.
- Format des logements et cartes : JSON versionné, importable ailleurs.

## 8. Limites honnêtes d’un projet 100 % gratuit

- Nombre de joueurs simultanés limité (quelques dizaines confortablement).
- Mise en pause possible de la base après une semaine sans activité (à réactiver à la main).
- Quotas susceptibles de changer : il faut surveiller et garder la possibilité de migrer.
- Pas d’audio/vidéo hébergé : les événements utiliseront un lien vers un outil de visio externe.
- Pas d’hébergement de fichiers libres (images de projets) au-delà de miniatures validées.

## 9. Pages officielles à relire avant déploiement

- Cloudflare Durable Objects — tarifs et limites : `developers.cloudflare.com/durable-objects/platform/pricing/` et `/limits/`
- Cloudflare Workers — limites et tarifs : `developers.cloudflare.com/workers/platform/limits/` et `/pricing/`
- Cloudflare Pages — limites : `developers.cloudflare.com/pages/platform/limits/`
- Supabase — tarifs et facturation : `supabase.com/pricing`, `supabase.com/docs/guides/platform/billing-on-supabase`
- Supabase Realtime — limites : `supabase.com/docs/guides/realtime/limits`
