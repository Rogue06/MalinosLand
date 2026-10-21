# Réseau temps réel

> **En bref (version simple)** : pour que les joueurs se voient bouger, chaque jeu envoie régulièrement sa position. On envoie le moins possible (seulement quand on bouge, et seulement aux joueurs de la même salle) pour rester rapide et gratuit. Depuis la v0.2, un **serveur temps réel** (Cloudflare, offre gratuite) relaie ces messages entre les joueurs en ligne ; il vérifie tout ce qu’il reçoit et protège le quota gratuit.

![Deux joueurs connectés au serveur se voient dans le hall](images/multijoueur-en-ligne.jpg)

## 1. État actuel

| Mode               | Quand                                                              | Transport                                     |
| ------------------ | ------------------------------------------------------------------ | --------------------------------------------- |
| **En ligne**       | Le jeu est construit avec `VITE_REALTIME_URL` (adresse du serveur) | `ServerTransport` (WebSocket)                 |
| Démo multi-onglets | Pas de serveur configuré, réglage activé                           | `BroadcastChannelTransport` (même navigateur) |
| Solo               | Sinon                                                              | `OfflineTransport`                            |

- `src/multiplayer/protocol.ts` : protocole v1, **partagé par le jeu et le serveur**.
- `src/multiplayer/NetworkClient.ts` : présence, synchronisation, chat, quotas, reconnexion.
- `src/multiplayer/ServerTransport.ts` : WebSocket, reconnexion automatique (délai croissant), ping
  de maintien, respect des refus du serveur.
- `server/` : le serveur temps réel (Cloudflare Worker + Durable Object), voir §4.

**État : le serveur fonctionne et est testé en local** (Wrangler, sans compte). La **mise en ligne**
se fait depuis GitHub (workflow « Mise en ligne ») : mode d’emploi dans
[MISE_EN_LIGNE.md](MISE_EN_LIGNE.md).

### Lancer le multijoueur en ligne sur son ordinateur

```bash
npm run server:install        # une seule fois : outils du serveur (≈ 235 Mo, dossier server/)
npm run server:dev            # terminal 1 : serveur sur ws://localhost:8787/ws
cp .env.example .env.local    # une seule fois : indique au jeu l’adresse du serveur
npm run dev                   # terminal 2 : le jeu, sur http://localhost:5173
```

Ouvre ensuite le jeu dans **deux navigateurs différents** (ou une fenêtre de navigation privée) :
les deux personnages se voient. Le chat indique « En ligne ».

## 2. Protocole v1

Messages JSON courts (clés d’une lettre quand c’est utile). Positions arrondies au centième.

| `t`     | Champs                                       | Rôle                                                                            |
| ------- | -------------------------------------------- | ------------------------------------------------------------------------------- |
| `hello` | `id, name, look, reply, room, x, y, f, s, a` | Arrivée (et réponse `reply: true` pour se faire connaître) ; `a` : absent       |
| `state` | `id, room, x, y, f, s`                       | Position, orientation (`px/py/nx/ny`), état (0 immobile, 1 marche, 2 assis)     |
| `chat`  | `id, room, scope (local/global), text`       | Message (≤ 140 caractères, nettoyé)                                             |
| `emote` | `id, room, e`                                | Émote d’une liste fermée                                                        |
| `look`  | `id, name, look`                             | Changement de pseudo/apparence                                                  |
| `away`  | `id, on`                                     | Statut « absent » (onglet caché depuis 20 s) ou retour                          |
| `queue` | `pos`                                        | (serveur) Place dans la file d’attente, 0 = entrée dans la salle                |
| `enter` | `id, room, tok?`                             | Demande d’entrée dans un logement `home-…` (jeton de connexion, jamais relayé)  |
| `door`  | `room, ok, why?`                             | (serveur) Réponse : entrée permise, ou refus `closed` / `full` / `evicted`      |
| `evict` | `id, target`                                 | Le propriétaire fait sortir un joueur de son logement                           |
| `decor` | `id`                                         | Le propriétaire a changé sa décoration : relayé aux présents, qui la rechargent |
| `bye`   | `id`                                         | Départ                                                                          |

Validation (`decodeMessage`) : taille ≤ 2 Ko, id `[a-z0-9]{8,32}`, salle `[a-z0-9-]`, coordonnées
finies dans [0, 512], orientation et état dans des listes fermées, apparence bornée aux palettes,
pseudo et texte nettoyés. Tout message invalide est ignoré.

Exemple de `state` : `{"t":"state","id":"k3j9…","room":"hub","x":12.35,"y":20.1,"f":"ny","s":1}`
(≈ 75 octets).

## 3. Optimisations

| Technique            | Mise en œuvre                                                                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Envoi sur changement | Rien n’est envoyé si la position ne change pas de plus de 0,01 tuile                                                                                            |
| Fréquence limitée    | 1 envoi / 100 ms max (5 Hz prévu en ligne) ; battement de cœur toutes les 4 s                                                                                   |
| Fréquence adaptative | ×2 puis ×4 sur l’intervalle quand le budget de messages approche                                                                                                |
| Interpolation        | Les avatars distants glissent vers la dernière position reçue (lissage exponentiel), téléportation au-delà de 3 tuiles                                          |
| Interest management  | Chaque message porte sa `room` ; mouvements, émotes et chat de proximité d’une autre salle ignorés. En ligne, le **serveur** ne relaiera que vers la même salle |
| Compression          | Messages courts, positions arrondies ; binaire envisageable si nécessaire (mesurer d’abord)                                                                     |
| Nettoyage            | Un pair silencieux depuis 12 s est retiré                                                                                                                       |

## 4. Le serveur : Worker + Durable Object

```
Joueur ──WebSocket──▶ Worker (server/src/index.ts)
                        │  /health : état du service
                        │  /ws : vérifie l’origine (ALLOWED_ORIGINS) puis transmet
                        ▼
                Durable Object « WorldRoom » (server/src/WorldRoom.ts)
                        │  hibernation des WebSockets, état de chaque joueur enregistré avec
                        │  sa connexion, compteur du budget quotidien en stockage
                        ▼
                RealtimeHub (server/src/hub.ts) — logique pure, testée
```

- **Une seule instance de monde** (`monde-1`) pour commencer : elle relie tous les joueurs et filtre
  par salle. Si la communauté grandit, on pourra répartir par groupe de salles (une instance par
  étage de la tour, par exemple) sans changer le protocole.
- **Hibernation** : quand personne n’envoie de message, l’objet est mis en veille et ne consomme
  pas de durée. Le « ping » de maintien (toutes les 25 s) est répondu automatiquement par
  Cloudflare sans réveiller l’objet.

### Règles appliquées par le serveur (le client n’est jamais cru sur parole)

| Règle               | Détail                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Validation          | Chaque message passe par `decodeMessage` (protocole partagé), puis est **ré-encodé** : rien n’est relayé tel quel.                                                                                                                                                                                                                                                                                                               |
| Identité            | L’identifiant est fixé au premier « hello » ; un message avec un autre identifiant est ignoré. Un identifiant déjà connecté est refusé, **sauf** s’il s’agit du même joueur (même compte, ou même clé de session `k` pour un visiteur) : la nouvelle connexion remplace alors l’ancienne, sans annonce de départ (onglet revenu au premier plan, réseau coupé puis rétabli). La clé `k` n’est jamais relayée.                    |
| Anti-téléportation  | Un déplacement plus long que `3,4 tuiles/s × 1,6 × durée + 1,2` est ignoré.                                                                                                                                                                                                                                                                                                                                                      |
| Carte               | Position hors de la carte ou salle inconnue : ignorée.                                                                                                                                                                                                                                                                                                                                                                           |
| Interest management | Mouvements, émotes et chat de proximité : seulement aux joueurs de la **même salle**. Chat général, arrivées, départs, changements de style : à tous.                                                                                                                                                                                                                                                                            |
| Anti-spam           | 20 messages/s (rafale de 40) par connexion ; chat et émotes : 5 d’affilée puis 1 toutes les 2 s. Plus de 30 infractions : déconnexion.                                                                                                                                                                                                                                                                                           |
| Logements           | Salles `home-<compte>` : entrée seulement si `can_enter_home` (base, avec le jeton du joueur) le permet, ou pour le propriétaire ; 12 personnes au plus ; sortie seulement devant l’ascenseur du Hub ; `evict` réservé au propriétaire ; **tout message écrit dans un logement n’est relayé qu’aux présents** (même « général »). Reconnexion dans le logement d’un autre : présentation mise en attente le temps de revérifier. |
| Historique          | Une ligne par visite (pseudo, compte ou visiteur, arrivée, départ) dans le SQLite du Durable Object, effacée après 90 jours ; lue par `GET /visits` avec le jeton du **responsable du site** (vérifié par `is_site_owner`). DEC-022.                                                                                                                                                                                             |
| Chat « autour »     | Message `local` relayé seulement aux joueurs de la même salle à moins de `LOCAL_CHAT_RADIUS` = 8 cases (toute la pièce dans un logement) ; `global` : à tous.                                                                                                                                                                                                                                                                    |
| Plafond par salle   | `MAX_PLAYERS_PER_ROOM` (40 par défaut) : au-delà, **file d’attente** (`MAX_QUEUE` = 50) : message `queue` avec sa place, rien n’est relayé pour un joueur en attente, et il entre seul (`queue` 0) dès qu’une place se libère (départ ou changement de salle). File pleine : avis « salle pleine ».                                                                                                                              |
| Messages réservés   | Un client ne peut pas envoyer `rate` ni `notice`.                                                                                                                                                                                                                                                                                                                                                                                |
| Origine             | Seules les adresses de `ALLOWED_ORIGINS` peuvent se connecter.                                                                                                                                                                                                                                                                                                                                                                   |

### Budget quotidien et dégradation contrôlée

Le serveur compte les messages reçus chaque jour (UTC, comme les quotas de Cloudflare) et les
compare à `DAILY_MESSAGE_BUDGET` (1 400 000 par défaut, soit 70 % des ≈ 2 millions de messages
entrants gratuits) :

| Consommation du budget | Effet                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| < 70 %                 | Normal (le jeu envoie au plus 5 positions/s)                                                                                                                  |
| ≥ 70 %                 | Message `rate` : les clients envoient au plus une position toutes les 400 ms                                                                                  |
| ≥ 90 %                 | Une position par seconde, émotes suspendues                                                                                                                   |
| ≥ 100 %                | **Maintenance** : nouveaux joueurs refusés, mouvements plus relayés (le chat reste) ; chacun peut continuer à jouer en solo. Retour automatique le lendemain. |

### Messages du serveur et codes de fermeture

| Message                        | Rôle                                                                  |
| ------------------------------ | --------------------------------------------------------------------- |
| `{"t":"rate","ms":400}`        | Intervalle minimal entre deux envois de position                      |
| `{"t":"notice","code":"full"}` | Avis affiché au joueur : `full`, `maintenance`, `duplicate`, `kicked` |

| Code de fermeture | Motif                                                                                | Réaction du jeu                            |
| ----------------- | ------------------------------------------------------------------------------------ | ------------------------------------------ |
| 4001              | Salle pleine                                                                         | Nouvelle tentative dans 1 minute           |
| 4002              | Connexion remplacée par une autre (autre onglet / appareil) ou identifiant déjà pris | Pas de nouvelle tentative                  |
| 4003              | Maintenance (budget épuisé)                                                          | Nouvelle tentative dans 30 minutes         |
| 4004 / 4005       | Exclusion / abus                                                                     | Pas de nouvelle tentative                  |
| autre             | Coupure réseau                                                                       | Reconnexion après 1, 2, 4, 8, 15 puis 30 s |

### Réglages (`server/wrangler.toml`)

| Variable               | Rôle                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| `ALLOWED_ORIGINS`      | Adresses du jeu autorisées à se connecter (local : `http://localhost:5173,http://localhost:4173`) |
| `MAX_PLAYERS_PER_ROOM` | Plafond de joueurs par salle                                                                      |
| `DAILY_MESSAGE_BUDGET` | Budget quotidien de messages entrants                                                             |

### Onglet en arrière-plan

Un navigateur met en pause la boucle du jeu d’un onglet caché : le joueur se tait mais reste
connecté. En ligne, les clients **n’oublient pas** un joueur silencieux (`peerTimeoutMs:
Infinity`) : seul le serveur annonce les départs. Si la connexion a été coupée entre-temps, la
reconnexion remplace l’ancienne grâce à la clé de session. En démo entre onglets (sans serveur),
un pair oublié qui se remet à bouger est redécouvert (demande de présentation).

Après 20 s d’onglet caché, le jeu envoie `away` (`on: true`) : les autres voient l’avatar pâle
avec 💤. Au retour, `away` (`on: false`). Le serveur garde ce statut, l’inclut dans la présence
envoyée aux nouveaux venus et ne relaie qu’un vrai changement.

### Pas encore fait

- **Comptes** : ✅ faits côté code. Le jeu propose le jeton Supabase dans les sous-protocoles de
  la WebSocket (`malinos.v1`, `jwt.<jeton>`) ; le Worker demande `my_profile` à la base avec ce
  jeton et transmet le compte au Durable Object (en-tête interne réécrit). Un joueur connecté
  garde l’identifiant (UUID sans tirets, 32 caractères) et le pseudo de son compte, avec `v: true`
  dans `hello` / `look` ; les visiteurs ne peuvent pas utiliser d’identifiant de 32 caractères.
  Détails : [COMPTES.md](COMPTES.md).
- **Mise en ligne** : ✅ (workflow « Mise en ligne », [MISE_EN_LIGNE.md](MISE_EN_LIGNE.md)).
- Collisions vérifiées côté serveur (seule la vitesse et les limites de la carte le sont).

## 5. Tests

| Test                   | Commande                                              | Ce qui est vérifié                                                                                                                                            |
| ---------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unitaires du serveur   | `npm test` (`tests/realtime-hub.test.ts`)             | Présentation, relais par salle, téléportation, usurpation, carte, chat, anti-spam, salle pleine, double connexion, inondation, budget et maintenance, départs |
| Unitaires du client    | `npm test` (`tests/network.test.ts`)                  | Protocole, débit, quotas, reconnexion, refus du serveur, messages `rate`/`notice`                                                                             |
| Intégration du serveur | `cd server && npm run test:integration`               | Le vrai Worker lancé avec Wrangler + clients WebSocket : santé, origine refusée, présence, déplacement, anti-triche, chat, ping/pong, salle pleine, départ    |
| Deux joueurs en ligne  | `npm run test:online` (voir [TESTING.md](TESTING.md)) | Deux navigateurs séparés se voient, se voient bouger, discutent et voient l’autre partir                                                                      |

Tous tournent dans la CI GitHub à chaque pull request. La file d’attente est vérifiée par les
tests unitaires du serveur et du client, et par le test d’intégration (le 4e joueur attend, puis
entre quand une place se libère).
