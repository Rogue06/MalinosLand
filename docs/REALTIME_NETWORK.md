# Réseau temps réel

## 1. État actuel (v0.1)

- `src/multiplayer/Transport.ts` : interface `Transport` + deux implémentations :
  - `OfflineTransport` : solo, aucun envoi ;
  - `BroadcastChannelTransport` : **démo locale** entre onglets du même navigateur (aucun réseau).
- `src/multiplayer/protocol.ts` : protocole v1, validation stricte de tout message reçu.
- `src/multiplayer/NetworkClient.ts` : présence, synchronisation, chat, quotas.
- Testé par `tests/network.test.ts` avec un bus en mémoire.

## 2. Protocole v1

Messages JSON courts (clés d’une lettre quand c’est utile). Positions arrondies au centième.

| `t`     | Champs                                    | Rôle                                                                        |
| ------- | ----------------------------------------- | --------------------------------------------------------------------------- |
| `hello` | `id, name, look, reply, room, x, y, f, s` | Arrivée (et réponse `reply: true` pour se faire connaître)                  |
| `state` | `id, room, x, y, f, s`                    | Position, orientation (`px/py/nx/ny`), état (0 immobile, 1 marche, 2 assis) |
| `chat`  | `id, room, scope (local/global), text`    | Message (≤ 140 caractères, nettoyé)                                         |
| `emote` | `id, room, e`                             | Émote d’une liste fermée                                                    |
| `look`  | `id, name, look`                          | Changement de pseudo/apparence                                              |
| `bye`   | `id`                                      | Départ                                                                      |

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

## 4. Architecture prévue (v0.2) : Worker + Durable Object

```
Client ──WebSocket──▶ Worker /ws ──▶ Durable Object (une instance par groupe de salles)
                         │ 1. vérifie le JWT Supabase (clé publique JWKS)
                         │ 2. limite les connexions par compte / IP
                         ▼
              DO : liste des connexions par salle, état autoritaire minimal
                   (position plausible, salle, assis), relai sélectif
```

Règles côté serveur :

- **Autorité** : vitesse maximale vérifiée (pas de téléportation), coordonnées dans la carte,
  changement de salle seulement via un passage autorisé (ascenseur, porte) et si l’accès est permis
  (logement privé → vérification en base).
- **Relai sélectif** : un message de mouvement n’est envoyé qu’aux joueurs de la même salle ;
  la présence globale (liste des connectés) est envoyée à basse fréquence.
- **Hibernation WebSocket** pour ne pas consommer de durée quand une salle est calme.
- **Compteurs de quotas** et ordres de dégradation (`{"t":"rate","ms":200}`) — voir
  [FREE_INFRASTRUCTURE.md](FREE_INFRASTRUCTURE.md) §6.
- **Plafond par salle** (ex. 40) puis file d’attente ou instance « miroir » en lecture.

Nouveau transport côté client : `ServerTransport implements Transport` (WebSocket, reconnexion avec
délai croissant, ping applicatif). Aucune modification du rendu ni du modèle du monde.

## 5. Tests réseau prévus

- Unitaires (déjà) : découverte, débit, inactivité, quotas, anti-spam, filtrage par salle.
- v0.2 : tests du Durable Object avec l’environnement local de Wrangler ; simulation de N clients
  (script Node) pour mesurer messages/s et vérifier les plafonds.
