# Reprendre le projet (n’importe quel ordinateur, n’importe quelle IA)

> **En bref** : tout le projet est sur GitHub — le code, les consignes des IA (`AGENTS.md`),
> l’état du travail (`docs/SESSION_HANDOFF.md`) et l’historique des décisions. Pour reprendre, il
> suffit de récupérer le dépôt, d’installer les dépendances et de dire à l’IA de lire ces deux
> fichiers. Rien d’important ne doit rester seulement dans une conversation ou sur un ordinateur.

## 1. Ce qui garantit la reprise

| Fichier                                         | Rôle                                                                                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| [`AGENTS.md`](../AGENTS.md)                     | Les consignes permanentes pour **toutes** les IA et les développeurs : objectifs, gratuité, règles Git, sécurité, commandes.           |
| [`docs/SESSION_HANDOFF.md`](SESSION_HANDOFF.md) | **Où on en est** : ce qui est fait, ce qui reste, les décisions en attente, les problèmes connus. Mis à jour à la fin de chaque tâche. |
| [`docs/DECISIONS.md`](DECISIONS.md)             | Pourquoi chaque grand choix a été fait.                                                                                                |
| [`docs/ROADMAP.md`](ROADMAP.md)                 | Les objectifs, version par version.                                                                                                    |
| [`docs/CHANGELOG.md`](CHANGELOG.md)             | Ce qui a changé.                                                                                                                       |

Chaque outil trouve les consignes tout seul :

| Outil                                      | Fichier lu automatiquement                                   |
| ------------------------------------------ | ------------------------------------------------------------ |
| Claude Code (terminal, application, cloud) | `CLAUDE.md` → importe `AGENTS.md`                            |
| OpenAI Codex (cloud ou terminal)           | `AGENTS.md`                                                  |
| Cursor                                     | `AGENTS.md`                                                  |
| GitHub Copilot                             | `.github/copilot-instructions.md` → renvoie vers `AGENTS.md` |
| Gemini CLI                                 | `GEMINI.md` → importe `AGENTS.md`                            |
| Autre outil                                | Lui demander de lire `AGENTS.md`                             |

## 2. Installer le projet sur un ordinateur

Il faut **Git** et **Node.js 20 ou plus récent** (22 recommandé).

| Système     | Installer Git                                   | Installer Node.js                                                        |
| ----------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| **Windows** | [git-scm.com](https://git-scm.com/download/win) | [nodejs.org](https://nodejs.org) (version « LTS »)                       |
| **macOS**   | Déjà présent, ou `xcode-select --install`       | [nodejs.org](https://nodejs.org), ou `brew install node`                 |
| **Linux**   | `sudo apt install git` (ou équivalent)          | [nodejs.org](https://nodejs.org), ou un gestionnaire comme `nvm` / `fnm` |

Puis, dans un terminal (PowerShell sous Windows, Terminal sous macOS/Linux) :

```bash
git clone https://github.com/Rogue06/MalinosLand.git
cd MalinosLand
npm install
npm run check      # vérifie que tout fonctionne (doit afficher des tests réussis)
npm run dev        # ouvre le jeu sur http://localhost:5173
```

Si le projet est déjà cloné : `git checkout main` puis `git pull` pour récupérer la dernière version.

## 3. Reprendre avec une IA

1. Ouvre le dépôt dans ton outil (Claude Code, Codex, Cursor…), ou, pour un outil dans le cloud
   (Claude Code sur le web, Codex), sélectionne le dépôt `Rogue06/MalinosLand`.
2. Donne-lui cette consigne de départ :

   > Lis `AGENTS.md` puis `docs/SESSION_HANDOFF.md`. Résume-moi où en est le projet et propose la
   > prochaine étape. Respecte toutes les règles d’`AGENTS.md`.

3. Valide ce qu’elle propose. Elle travaillera sur une **branche**, ouvrira une **pull request**,
   et ne fusionnera rien sans ton accord.

**À la fin d’une session**, vérifie que l’IA a bien :

- mis à jour `docs/SESSION_HANDOFF.md` ;
- poussé sa branche sur GitHub (sinon le travail reste sur l’ordinateur ou le serveur de l’IA !) ;
- ouvert une pull request, ou indiqué où en est sa branche.

## 4. Ne rien perdre : où sont les secrets, les comptes et les réglages ?

**Rien de tout cela ne dépend d’une IA ni d’un ordinateur.** Tout est stocké **en ligne, dans les
comptes du responsable du projet**, et reste en place même si l’on change d’outil IA, d’ordinateur
ou de façon de travailler. Une IA ne « garde » jamais rien : elle relit le dépôt à chaque session.

| Élément                                             | Où il est stocké (en ligne)                                                          | Ce qu’il faut conserver soi-même                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Code, documentation, décisions, état du travail     | **GitHub** (ce dépôt)                                                                | Rien : tout est dans le dépôt                                      |
| Réglages du dépôt (protection de `main`…)           | **GitHub** → Settings                                                                | Rien (et ils sont décrits ci-dessous)                              |
| Compte GitHub                                       | GitHub                                                                               | Mot de passe + **codes de secours** de la double authentification  |
| Compte Cloudflare (hébergement, serveur temps réel) | Cloudflare                                                                           | Mot de passe + codes de secours                                    |
| Projet Supabase (comptes joueurs, base de données)  | Supabase                                                                             | Mot de passe + codes de secours                                    |
| Clés techniques (clé d’API, jeton de déploiement…)  | Réglages chiffrés de **Cloudflare**, **Supabase** ou **GitHub → Settings → Secrets** | Rien : on peut toujours en régénérer une nouvelle depuis le compte |

👉 **Le seul vrai risque est de perdre l’accès à ses comptes.** Conseil : garder les mots de passe et
les codes de secours dans un **gestionnaire de mots de passe** (il en existe de gratuits, par exemple
Bitwarden), et activer la double authentification partout.

**Règles pour les IA et les contributeurs :**

- Jamais de secret dans le code, dans un fichier commité, dans une issue ou dans une conversation
  publique. Un secret exposé doit être **révoqué et régénéré** immédiatement.
- Le dépôt contient seulement l’**inventaire** des secrets (leur nom et leur rôle, jamais leur
  valeur), dans le tableau ci-dessous, à tenir à jour à chaque ajout.

### Inventaire des secrets et des comptes

| Nom                             | Rôle                                          | Stocké dans                                                                            | Statut         |
| ------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------- | -------------- |
| _(aucun pour l’instant)_        | La v0.1 fonctionne sans aucun secret          | —                                                                                      | —              |
| `CLOUDFLARE_API_TOKEN` (prévu)  | Mise en ligne automatique depuis GitHub       | GitHub → Secrets                                                                       | À créer (v0.2) |
| `CLOUDFLARE_ACCOUNT_ID` (prévu) | Identifiant du compte Cloudflare (non secret) | GitHub → Variables                                                                     | À créer (v0.2) |
| Clés Supabase (prévu)           | Connexion des joueurs et base de données      | Cloudflare + GitHub → Secrets (la clé « service » ne va **jamais** dans le navigateur) | À créer (v0.2) |

### Réglage actuel de la protection de `main`

À recréer à l’identique si le dépôt change de place : règle « Protection de la branche
principale » ciblant la **branche par défaut**, avec pull request obligatoire, fusion en **squash**
uniquement, suppression et push forcé interdits.

## 5. Sessions Claude Code dans le cloud

Le fichier `.claude/hooks/session-start.sh` installe automatiquement les dépendances au démarrage
d’une session cloud : les tests, le linter et le build fonctionnent tout de suite.
