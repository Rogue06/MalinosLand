# Mettre le jeu en ligne

> **En bref (version simple)** : le jeu (le site) va sur **Cloudflare Pages** et le serveur temps
> réel sur un **Cloudflare Worker**, tous les deux en **offre gratuite, sans carte bancaire**. La
> mise en ligne se fait depuis GitHub en cliquant sur un bouton. Il faut d’abord, **une seule
> fois**, donner à GitHub une « clé » (jeton d’API) qui l’autorise à publier sur le compte
> Cloudflare. Seul le responsable du projet fait ces étapes.

**État : en ligne depuis le 19/10/2026.** Jeu : <https://malinosland.pages.dev> · serveur :
`https://malinosland-realtime.roguenftproject.workers.dev` (`/health` pour vérifier qu’il répond).

## Préparation (une seule fois, ≈ 10 minutes)

### Étape 1 — Choisir l’adresse du serveur (`workers.dev`)

1. Se connecter sur [dash.cloudflare.com](https://dash.cloudflare.com).
2. Menu de gauche : **Compute (Workers)** → **Workers & Pages** (le nom exact peut varier un peu).
3. Si Cloudflare propose de **choisir un sous-domaine `workers.dev`**, en choisir un (par exemple
   `malinosland`). Le serveur aura alors l’adresse
   `https://malinosland-realtime.<ton-sous-domaine>.workers.dev`.
   S’il n’y a rien à choisir, c’est que le sous-domaine existe déjà : rien à faire.

> ⚠️ Ne jamais choisir d’offre payante (« Workers Paid ») ni ajouter de carte bancaire. Tout ce
> projet fonctionne avec l’offre **Free**.

### Étape 2 — Créer le jeton d’API (la « clé » pour GitHub)

1. En haut à droite : icône du profil → **Profile** → **API Tokens** → **Create Token**.
2. À la ligne **Edit Cloudflare Workers**, cliquer sur **Use template**.
3. Dans **Permissions**, cliquer sur **+ Add more** et ajouter :
   **Account** · **Cloudflare Pages** · **Edit**.
   Le modèle « Edit Cloudflare Workers » donne déjà **Workers KV Storage · Edit** (stockage des
   aperçus du musée, DEC-040). Si la mise en ligne échoue avec un message sur le navigateur de
   capture (« Browser Rendering » ou « Browser Run »), ajouter aussi **Account** · **Browser
   Rendering** · **Edit**.
4. **Account Resources** : _Include_ → ton compte. **Zone Resources** : _All zones_.
5. **Continue to summary** → **Create Token**.
6. **Copier le jeton affiché** (il n’est montré qu’une fois). Ne le colle **nulle part ailleurs**
   que dans GitHub à l’étape 4 : ni dans un fichier du projet, ni dans une conversation avec une IA.

### Étape 3 — Trouver l’identifiant du compte (Account ID)

Dans **Workers & Pages**, l’**Account ID** est affiché dans la colonne de droite (bouton pour le
copier). On le trouve aussi dans l’adresse de la page : `dash.cloudflare.com/<Account ID>/…`.
Ce n’est pas un secret, mais on le range avec le jeton pour simplifier.

### Étape 4 — Donner la clé à GitHub

Sur GitHub, dans le dépôt : **Settings** → **Secrets and variables** → **Actions** →
**New repository secret**, deux fois :

| Name                    | Secret                     |
| ----------------------- | -------------------------- |
| `CLOUDFLARE_API_TOKEN`  | le jeton copié à l’étape 2 |
| `CLOUDFLARE_ACCOUNT_ID` | l’identifiant de l’étape 3 |

GitHub les garde chiffrés : personne (même pas toi) ne peut les relire, on peut seulement les
remplacer. Ils restent sur GitHub même si tu changes d’ordinateur ou d’IA.

### Étape 5 — La page d’accueil (dépôt privé)

La page d’accueil du site (la présentation, à la racine) n’est **pas** dans ce dépôt public :
elle est dans le dépôt **privé** `Rogue06/MalinosLand-accueil` (DEC-026). La mise en ligne la
récupère avec une clé en **lecture seule** :

1. GitHub → photo de profil → **Settings** → **Developer settings** → **Personal access
   tokens** → **Fine-grained tokens** → **Generate new token**.
2. Nom : `MalinosLand accueil (lecture)` ; expiration : 1 an (à renouveler) ; **Repository
   access** → **Only select repositories** → `MalinosLand-accueil` ; **Permissions** →
   **Repository permissions** → **Contents : Read-only** (rien d’autre).
3. **Generate token**, copier la clé (elle ne s’affiche qu’une fois).
4. Dans le dépôt public `MalinosLand` : **Settings** → **Secrets and variables** → **Actions**
   → **New repository secret** : nom `ACCUEIL_TOKEN`, valeur : la clé copiée.

Sans ce secret, la mise en ligne s’arrête avec un message clair (elle ne publie pas un site
sans page d’accueil). Pour travailler sur la page d’accueil en local : cloner le dépôt privé à
côté de ce projet, puis `npm run accueil` (les fichiers copiés sont ignorés par Git).

## Mettre en ligne (à chaque nouvelle version)

1. Sur GitHub : onglet **Actions** → à gauche **Mise en ligne** → bouton **Run workflow** →
   branche `main` → **Run workflow**.
2. Attendre 3 à 5 minutes. Le programme :
   - vérifie le projet (types, tests, build) — en cas d’échec, rien n’est mis en ligne ;
   - crée le site Cloudflare Pages `malinosland` s’il n’existe pas encore ;
   - met en ligne le serveur temps réel, en n’autorisant que le site à s’y connecter ;
   - construit le jeu relié au serveur et le met en ligne ;
   - vérifie que tout répond.
3. Ouvrir le résultat : le **résumé** de l’exécution affiche l’adresse du jeu
   (en général `https://malinosland.pages.dev`) et celle du serveur.

La première fois, le site peut mettre une ou deux minutes de plus à répondre (le temps que son
adresse soit connue partout).

Après chaque fusion d’une pull request dans `main`, relancer **Mise en ligne** pour publier la
nouvelle version. (Plus tard, on pourra rendre cette étape automatique.)

## Ce que ça coûte

**Rien.** Offre Free de Cloudflare : en cas d’affluence exceptionnelle, Cloudflare **refuse** les
connexions en trop au lieu de facturer, et notre serveur se met lui-même en pause avant la limite
(budget quotidien, voir [FREE_INFRASTRUCTURE.md](FREE_INFRASTRUCTURE.md)). Vérifier une fois par
mois l’usage dans le tableau de bord Cloudflare.

## En cas de problème

| Message dans GitHub Actions                   | Que faire                                                                           |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| « Secrets … absents »                         | Refaire l’étape 4 (noms exacts, en majuscules).                                     |
| « Impossible de trouver ou de créer le site » | Le jeton n’a pas la permission **Cloudflare Pages · Edit** : le modifier (étape 2). |
| « Aucun sous-domaine workers.dev »            | Faire l’étape 1.                                                                    |
| `Authentication error` / `10000`              | Jeton erroné ou expiré : en créer un nouveau et remplacer le secret GitHub.         |
| « Le site ne répond pas encore »              | Attendre quelques minutes puis ouvrir l’adresse : c’est normal la première fois.    |

## Mettre le jeu hors ligne

- **Arrêter le serveur temps réel** : Cloudflare → Workers & Pages → `malinosland-realtime` →
  Settings → désactiver la route `workers.dev`. Le jeu reste jouable seul (hors ligne).
- **Retirer le site** : Workers & Pages → `malinosland` → Settings → supprimer le projet.
- **Jeton perdu ou divulgué** : Profile → API Tokens → **Roll** (le remplacer) ou supprimer, puis
  mettre à jour le secret GitHub.
