# Reprise de session

> À lire en premier par toute nouvelle session (humaine ou IA). Mettre à jour à la fin de chaque
> tâche importante.

**Dernière mise à jour : 20/10/2026 — en ligne : comptes, masquer / signaler, modération,
boîte à idées et borne à bugs, personnages assis de dos (PR #16), confort : statut « absent »,
sons, mentions @pseudo, ambiance sonore (PR #17).**

> Nouvelle session ? Les consignes sont dans [`AGENTS.md`](../AGENTS.md) ; le mode d’emploi pour
> reprendre sur un autre ordinateur ou un autre outil est dans
> [REPRENDRE_LE_PROJET.md](REPRENDRE_LE_PROJET.md).

## Où en est-on ?

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

- Comptes joueurs (Supabase), authentification sur le serveur temps réel, signaler / masquer,
  file d’attente (aujourd’hui : « salle pleine » + nouvel essai automatique), collisions vérifiées
  côté serveur (seule la vitesse et les limites de la carte le sont).
- Galerie, tour, étages, logements : annoncés « bientôt » dans le jeu.

## Points en attente de décision du responsable

1. Tester en ligne : envoyer une idée et un bug depuis le jeu, puis les voir dans ⚙️ Réglages →
   🛡️ Modération ; signaler un visiteur depuis un compte (fenêtre privée).
2. Écouter les sons et l’ambiance (régler le volume si besoin), vérifier le statut « absent »
   entre deux appareils. Choisir les prochaines « petites fonctionnalités de confort ».
3. Tester la connexion GitHub (Google fonctionne).
4. Supprimer les branches fusionnées sur GitHub et cocher « Automatically delete head branches ».
5. **DEC-009** — licence MIT (ou AGPL-3.0).

## Problèmes connus / limites

- Quotas Cloudflare (≈ 2 millions de messages WebSocket entrants par jour en gratuit, d’où le
  budget de 1,4 million) relevés via la documentation : **à re-vérifier** avant la mise en ligne.
- Les visiteurs (sans compte) peuvent prendre n’importe quel pseudo libre : seuls les comptes ont
  la marque ✓ et un pseudo réservé.
- Supabase gratuit : 2 projets actifs max (LaChillance en pause depuis le 19/10, relançable 90 j).
- Le journal complet des jobs GitHub n’est pas lisible depuis une session Claude : les tests
  écrivent leurs étapes en annotations, lisibles via l’API.
- **Performances non mesurées sur du vrai matériel** (seulement en rendu logiciel, sans GPU).
- Phaser ≈ 357 Ko gzip (piste : build allégé, F33). Mobile : chat repliable, bouton d’action, zoom à deux doigts (PR confort mobile) ; pas encore de joystick virtuel ni de vrai test sur téléphone.

## Prochaines étapes suggérées (dans l’ordre)

1. Tester à plusieurs pour de vrai (ordinateurs + téléphones) et recueillir les retours.
2. Signaler / masquer un joueur, modération minimale (v0.2).
3. Tester sur de vrais téléphones (iPhone, Android) et ajuster ; ensuite v0.3 Logements
   (choix validés : ascenseur → « Mon logement », studio meublé de base).
4. Mesurer les performances sur 2–3 machines réelles (procédure dans [TESTING.md](TESTING.md)).

## Repères rapides pour reprendre

- Démarrer : `npm install && npm run dev` → http://localhost:5173 (`/art-preview.html` pour les assets).
- Multijoueur local : `npm run server:install` une fois, `npm run server:dev`, `.env.local` copié de
  `.env.example`, puis `npm run dev` dans deux navigateurs.
- Débogage / tests automatisés : ajouter `?debug` à l’URL expose `window.__malinosDebug`
  (`pos()`, `state()`, `walkTo(x, y)`, `teleport(x, y, f)`, `zoom(z?)`, `use(id)`, `useType(type)`,
  `sit(type, n)`, `seated()`, `peers()`, `fps()`).
- Fichiers centraux : `src/game/scenes/WorldScene.ts` (assemblage), `src/world/WorldModel.ts`,
  `src/world/PlayerController.ts`, `src/content/maps/hub.json`, `src/content/catalog.ts`,
  `src/game/art/objects.ts`, `src/game/art/characters.ts`, `src/multiplayer/NetworkClient.ts`,
  `src/multiplayer/ServerTransport.ts`, `server/src/hub.ts`,
  `src/state.ts`.
