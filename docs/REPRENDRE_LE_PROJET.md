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

## 4. Ce qui n’est pas dans le dépôt (et c’est normal)

| Élément                                                        | Où il se trouve                                                                             | Qui le gère              |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------ |
| Mots de passe, clés d’API, jetons                              | Réglages chiffrés de Cloudflare, Supabase ou GitHub (« Secrets ») — **jamais dans le code** | Le responsable du projet |
| Comptes Cloudflare et Supabase (gratuits, sans carte bancaire) | Sites des fournisseurs                                                                      | Le responsable du projet |
| Protection de la branche `main`                                | GitHub → Settings → Rules                                                                   | Le responsable du projet |

Réglage actuel de la protection (à recréer à l’identique si le dépôt change de place) : règle
« Protection de la branche principale » ciblant la **branche par défaut**, avec pull request
obligatoire, fusion en **squash** uniquement, suppression et push forcé interdits.

## 5. Sessions Claude Code dans le cloud

Le fichier `.claude/hooks/session-start.sh` installe automatiquement les dépendances au démarrage
d’une session cloud : les tests, le linter et le build fonctionnent tout de suite.
