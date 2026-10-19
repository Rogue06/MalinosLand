#!/bin/bash
# Démarrage automatique des sessions Claude Code dans le cloud : installe les dépendances
# pour que les tests, le linter et le build fonctionnent dès le début de la session.
# Sans effet en local (chaque développeur lance lui-même « npm install »).
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# « npm install » (et non « npm ci ») : profite du cache de l'environnement, idempotent.
npm install --no-audit --no-fund

# Navigateur pour le test de bout en bout, s'il est fourni par l'environnement.
if [ -n "${CLAUDE_ENV_FILE:-}" ] && [ -x /opt/pw-browsers/chromium ]; then
  echo 'export CHROMIUM_PATH=/opt/pw-browsers/chromium' >> "$CLAUDE_ENV_FILE"
fi
