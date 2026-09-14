// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintConfigPrettier = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  eslintConfigPrettier,
  {
    // Arquivo de teste é uma lista de casos, não uma função: o limite de
    // linhas do §5.1 mede complexidade, e cortar um `describe` em dois só
    // para caber espalharia o contrato de um módulo por dois arquivos.
    files: ['**/*.test.ts'],
    rules: { 'max-lines-per-function': 'off' },
  },
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
            {
              // `lib/testing/` monta hook, troca o adapter do axios e stuba
              // módulo nativo. Nada disso pode entrar no bundle.
              //
              // Os relativos estão na lista porque o alias sozinho não fecha a
              // porta: quem mora dentro de `shared/lib/` alcançaria o harness
              // com `./testing/…`, e é justamente ali que ele mora.
              group: [
                '@/shared/lib/testing',
                '@/shared/lib/testing/*',
                './testing',
                './testing/*',
                '../testing',
                '../testing/*',
                '../*/testing/*',
              ],
              message: 'Infraestrutura de teste. Só arquivo `*.test.ts` importa daqui.',
            },
          ],
        },
      ],
    },
  },
  {
    // Os testes são justamente quem pode — mas só desta regra: os caminhos
    // relativos profundos continuam proibidos aqui como em todo o resto.
    files: ['**/*.test.{ts,tsx}', 'src/shared/lib/testing/**'],
    rules: {
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
