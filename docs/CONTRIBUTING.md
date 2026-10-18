# Contribuer à MalinosLand

Bienvenue ! Que tu sois développeur, graphiste, auteur de textes ou simplement curieux, tu peux
aider. Toute contribution est relue avant d’être intégrée.

## 1. Règles du dépôt

- La branche **`main` est protégée** : personne n’y pousse directement.
- Chaque changement passe par **une branche dédiée** puis une **pull request** (PR).
- La CI (types, lint, tests, build) doit être verte.
- **Aucune fusion sans l’accord du responsable du projet.**
- Respect et bienveillance : voir le [code de conduite](../CODE_OF_CONDUCT.md).

## 2. Flux de travail

```bash
# 1. Forke le dépôt sur GitHub (ou clone-le si tu as les droits)
git clone https://github.com/<toi>/MalinosLand.git
cd MalinosLand
npm install

# 2. Crée une branche à partir de main à jour
git checkout main && git pull
git checkout -b feature/nouvelle-salle

# 3. Développe, puis vérifie
npm run dev          # pour voir le résultat
npm run check        # types + lint + tests + build

# 4. Commit et push
git add -A
git commit -m "feat: ajoute la salle de jeux"
git push -u origin feature/nouvelle-salle

# 5. Ouvre une pull request vers main et remplis le modèle
```

### Nommage des branches

| Préfixe    | Usage                            | Exemple                    |
| ---------- | -------------------------------- | -------------------------- |
| `feature/` | Nouvelle fonctionnalité ou salle | `feature/minigame-quiz`    |
| `fix/`     | Correction de bug                | `fix/collision-ascenseur`  |
| `content/` | Objets, décors, textes, cartes   | `content/decorations-noel` |
| `docs/`    | Documentation                    | `docs/guide-graphismes`    |

### Messages de commit

[Conventional Commits](https://www.conventionalcommits.org/fr/) en français :
`feat: …`, `fix: …`, `docs: …`, `refactor: …`, `test: …`, `chore: …`.

## 3. Éviter les conflits entre contributeurs

L’architecture est découpée pour que des branches comme `feature/new-room`, `feature/minigame` et
`feature/decorations` avancent sans se gêner :

- un **objet** = une entrée de catalogue + une fonction de dessin (fichiers ajoutés en fin de liste) ;
- une **salle** = sa propre carte JSON (préférer une nouvelle carte à de grosses modifications du Hub) ;
- un **mini-jeu** (v0.5) = un module indépendant ;
- les textes (astuces, dialogues) sont dans `src/content/`.

## 4. Recettes

### Ajouter un objet

1. `src/content/catalog.ts` : nom, catégorie, empreinte, blocage, assises, interaction, lumière.
2. `src/game/art/objects.ts` : fonction de dessin avec `IsoBuilder` (l’objet regarde +y).
3. Vérifie les 4 rotations sur `http://localhost:5173/art-preview.html`.
4. Place-le dans une carte (`src/content/maps/*.json`) et lance `npm test`.

### Ajouter ou modifier une salle

Voir [WORLD_DESIGN.md](WORLD_DESIGN.md) (format de carte, règles, vérifications). Les tests
refusent une carte invalide ou un objet inaccessible.

### Ajouter une astuce IA

Ajoute une phrase dans `src/content/tips.ts`. Courte, utile, bienveillante.

### Contributions graphiques

Voir [ART_DIRECTION.md](ART_DIRECTION.md). Pas de copie d’œuvres existantes ; ressources externes
uniquement sous licence libre compatible, créditées.

## 5. Qualité attendue

- TypeScript strict, pas de `any` injustifié, pas de dépendance ajoutée sans explication.
- Logique pure dans `src/core/` ou `src/world/`, testée ; rendu dans `src/game/` ; UI dans `src/ui/`.
- Textes affichés en français ; commentaires en français ; identifiants en anglais.
- Mettre à jour la documentation et le [CHANGELOG](CHANGELOG.md) quand c’est pertinent.

## 6. Signaler un problème

Utilise les modèles d’issues (bug, idée, contenu). Pour une faille de sécurité : signalement
**privé**, voir [SECURITY.md](SECURITY.md).

## 7. Développer avec une IA

Les assistants IA sont bienvenus : ils doivent lire [`CLAUDE.md`](../CLAUDE.md) et
[`SESSION_HANDOFF.md`](SESSION_HANDOFF.md). Relis toujours le code proposé et vérifie que
`npm run check` passe réellement.
