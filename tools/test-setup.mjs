/**
 * Preparo do ambiente de teste. Carregado por `--import`, **depois** do
 * `ts-alias-hook.mjs` e antes de qualquer arquivo de teste.
 *
 * Faz três coisas, todas porque o app nasceu para rodar num aparelho:
 *
 * 1. Preenche as `EXPO_PUBLIC_*` com valores falsos. `src/shared/config/env.ts`
 *    valida por Zod **no import** e faz `throw` se faltar alguma — sem isto,
 *    importar qualquer coisa que alcance `lib/http/client` derruba a suíte numa
 *    máquina sem `.env.local`. Valores falsos de propósito: nenhum teste sai
 *    para a rede (o adapter do axios é trocado em `http-falso.ts`).
 * 2. Redireciona três módulos nativos para os stubs de
 *    `src/shared/lib/testing/stubs/`. É o `moduleNameMapper` do Jest à mão —
 *    e é o que evita depender de `mock.module()`, que hoje só existe atrás da
 *    flag `--experimental-test-module-mocks`. Pendurar `npm test` numa flag
 *    experimental, num projeto sem CI, custaria mais do que estas 20 linhas.
 * 3. Registra um DOM (happy-dom) para o `react-dom` do `renderHook`. Os hooks
 *    testados não renderizam componente nenhum — ver a ressalva do CLAUDE.md §1.
 */
import { registerHooks } from 'node:module';
import { after } from 'node:test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { GlobalRegistrator } from '@happy-dom/global-registrator';

const RAIZ = path.resolve(import.meta.dirname, '..');
const STUBS = path.join(RAIZ, 'src', 'shared', 'lib', 'testing', 'stubs');

/** Só o que a árvore dos hooks de escrita alcança. Não cresça por antecipação. */
const MODULOS_NATIVOS = {
  'react-native-mmkv': path.join(STUBS, 'react-native-mmkv.ts'),
  'expo-router': path.join(STUBS, 'expo-router.ts'),
  'react-native': path.join(STUBS, 'react-native.ts'),
};

const AMBIENTE_FALSO = {
  EXPO_PUBLIC_CENTRAL_API_URL: 'https://central.invalido.teste',
  EXPO_PUBLIC_SYSTEM_CODE: '00076',
  EXPO_PUBLIC_CENTRAL_API_TOKEN: 'token-de-teste',
  EXPO_PUBLIC_HTTP_TIMEOUT_MS: '5000',
};

for (const [chave, valor] of Object.entries(AMBIENTE_FALSO)) {
  process.env[chave] ??= valor;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const stub = MODULOS_NATIVOS[specifier];
    if (!stub) return nextResolve(specifier, context);

    return { url: pathToFileURL(stub).href, format: 'module-typescript', shortCircuit: true };
  },
});

GlobalRegistrator.register();

// O React 19 exige o sinalizador para `act()` não avisar a cada render.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Fecha a janela ao fim de cada arquivo de teste.
 *
 * O happy-dom deixa os timers da janela vivos e o runner só encerra quando o
 * event loop esvazia: sem isto o processo do arquivo fica de pé mesmo com
 * todos os casos verdes — foi o que fez a suíte pendurar em 100 s com 12/12
 * passando. `process.getActiveResourcesInfo()` mostrava nove `Timeout` órfãos.
 */
after(async () => {
  await GlobalRegistrator.unregister();
});
