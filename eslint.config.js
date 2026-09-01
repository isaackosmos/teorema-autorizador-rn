// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintConfigPrettier = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  eslintConfigPrettier,
  {
    ignores: ['dist/*', 'android/*', 'ios/*', '.expo/*', 'node_modules/*'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // Clean Code — ver CLAUDE.md §"Regras de Clean Code"
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'max-lines-per-function': ['warn', { max: 60, skipBlankLines: true, skipComments: true }],
      'max-params': ['warn', 3],
      complexity: ['warn', 10],
      // Padrão const-objeto + type do mesmo nome (ver session.types.ts) é intencional.
      '@typescript-eslint/no-redeclare': 'off',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Import: proíbe subir de feature em feature por caminho relativo.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../../features/*', '../../../*'],
              message: 'Use o alias `@/` em vez de caminhos relativos profundos.',
            },
          ],
        },
      ],
    },
  },
]);
