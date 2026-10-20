# Reprise de session

> À lire en premier par toute nouvelle session (humaine ou IA). Mettre à jour à la fin de chaque
> tâche importante.

**Dernière mise à jour : 21/10/2026 — v0.2 terminée (voir CHANGELOG [0.2.0]) : comptes,
modération, boîte à idées anti-robots, confort (sons, mentions, absent, mobile), file d’attente.
Prochaine étape : v0.3 Logements.**

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

- **22/10** — v0.3 Logements, lot 1A (branche `feature/logements-acces`, DEC-021) : migration
  `20261022090000_homes.sql` (**pas encore appliquée** sur Supabase : à appliquer après accord
  de fusion), messages `enter` / `door` / `evict`, accès vérifié par la base, chat d’un logement
  limité aux présents (demande du responsable), carte `studio` et objet lit. Lot 1B à suivre :
  ascenseur « Mon logement » / « Visiter », changement de salle dans le jeu, panneau d’accès et
  invitations.

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
- Logements (v0.3, en cours), galerie, tour, étages : annoncés « bientôt » dans le jeu.

## Points en attente de décision du responsable

1. Tester en ligne : envoyer une idée **en navigation privée** (vérification Turnstile réelle,
   jamais testée par la session Claude), puis la voir dans ⚙️ Réglages → 🛡️ Modération ; signaler
   un visiteur depuis un compte.
2. Écouter les sons et l’ambiance (régler le volume si besoin), vérifier le statut « absent »
   entre deux appareils. Choisir les prochaines « petites fonctionnalités de confort ».
3. Supprimer la dernière ancienne branche `feature/initial-prototype` sur GitHub (la suppression
   automatique après fusion est activée depuis le 21/10).

## Problèmes connus / limites

- Quotas Cloudflare (≈ 2 millions de messages WebSocket entrants par jour en gratuit, d’où le
  budget de 1,4 million) : vérifiés le 21/10/2026 (100 000 requêtes/jour, messages entrants
  comptés 1 pour 20).
- Les visiteurs (sans compte) peuvent prendre n’importe quel pseudo libre : seuls les comptes ont
  la marque ✓ et un pseudo réservé.
- Supabase gratuit : 2 projets actifs max (LaChillance en pause depuis le 19/10, relançable 90 j).
- Le journal complet des jobs GitHub n’est pas lisible depuis une session Claude : les tests
  écrivent leurs étapes en annotations, lisibles via l’API.
- **Performances non mesurées sur du vrai matériel** (seulement en rendu logiciel, sans GPU).
- Phaser ≈ 357 Ko gzip (piste : build allégé, F33). Mobile : chat repliable, bouton d’action, zoom à deux doigts (PR confort mobile) ; pas encore de joystick virtuel ni de vrai test sur téléphone.

## Prochaines étapes suggérées (dans l’ordre)

1. **v0.3 Logements** (choix validés : ascenseur → « Mon logement », studio meublé de base, accès
   « personne / sur invitation / tout le monde » vérifié par le serveur et la base).
2. Tester à plusieurs pour de vrai (ordinateurs + téléphones) et recueillir les retours.
3. Mesurer les performances sur 2–3 machines réelles (procédure dans [TESTING.md](TESTING.md)).

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
