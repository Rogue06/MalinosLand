import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', 'server/node_modules', 'server/.wrangler'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Sécurité : aucun HTML brut injecté depuis des données (chat, pseudos, liens…).
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'AssignmentExpression > MemberExpression[property.name=/^(innerHTML|outerHTML)$/]',
          message: 'Interdit : utiliser textContent ou des composants Preact.',
        },
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Interdit : risque d’injection de script.',
        },
      ],
      'no-eval': 'error',
      'no-implied-eval': 'error',
    },
  },
  {
    // Scripts Node (outils, tests de bout en bout exécutant du code dans la page).
    files: ['scripts/**/*.mjs', 'server/scripts/**/*.mjs', '*.config.{js,ts}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['src/core/**', 'src/world/**', 'src/multiplayer/protocol.ts'],
    rules: {
      // La logique pure ne doit dépendre ni de Phaser ni de l'UI (testable et portable).
      'no-restricted-imports': [
        'error',
        { patterns: ['phaser', 'preact', 'preact/*', '../game/*', '../ui/*'] },
      ],
    },
  },
);
