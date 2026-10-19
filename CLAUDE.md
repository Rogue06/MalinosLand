# CLAUDE.md

Les consignes du projet sont dans **AGENTS.md** (source unique, partagée avec Codex, Cursor,
Copilot, Gemini…). Elles sont importées ci-dessous : les respecter intégralement.

@AGENTS.md

## Spécifique à Claude Code

- Sessions dans le cloud : `.claude/hooks/session-start.sh` installe automatiquement les dépendances
  au démarrage (et indique `CHROMIUM_PATH` si un Chromium est fourni).
- Les réglages partagés de Claude Code sont dans `.claude/settings.json` (versionné) ; les réglages
  personnels vont dans `.claude/settings.local.json` (ignoré par Git).
