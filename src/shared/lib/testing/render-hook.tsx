import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook as renderHookRTL } from '@testing-library/react';
import { createElement } from 'react';

import { restaurarServidores } from '@/shared/lib/testing/http-falso';
import { limparSessao } from '@/shared/lib/testing/sessao-de-teste';

import type { RenderHookResult } from '@testing-library/react';
import type { ReactNode } from 'react';

/**
 * `renderHook` com o `QueryClientProvider` que todo hook do app espera.
 *
 * Renderiza com **react-dom**, não com o renderer do React Native: os hooks de
 * escrita não montam componente nenhum — são `useMutation` mais
 * `useEffect`/`useRef` —, então a semântica de efeito é a mesma e o custo é
 * duas dependências em vez de um segundo runner (CLAUDE.md §1, ficha F4b).
 * **Tela não se testa por aqui.** No dia em que isso for preciso, o caminho é
 * jest-expo, e é ficha própria.
 */

/**
 * Um client por teste, sem retry: o retry por status é política do app
 * (`shared/config/query-client.ts`) e reproduzi-la aqui só faria cada erro
 * esperado demorar três tentativas.
 */
export function criarQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface OpcoesRender {
  /** Passe o seu quando o teste precisar inspecionar o cache depois. */
  queryClient?: QueryClient;
}

/**
 * Sem `initialProps`/`rerender` com props: nenhum hook de escrita do app recebe
 * argumento que mude entre renders, e a sobrecarga só existiria para um caso
 * que não há. Quando houver, acrescente aqui.
 */
export function renderizarHook<Resultado>(
  callback: () => Resultado,
  opcoes: OpcoesRender = {},
): RenderHookResult<Resultado, undefined> & { queryClient: QueryClient } {
  const queryClient = opcoes.queryClient ?? criarQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }

  const resultado = renderHookRTL(callback, { wrapper: Wrapper });

  return Object.assign(resultado, { queryClient });
}

/**
 * Encerramento obrigatório de todo teste de hook — chame no `afterEach`.
 *
 * O `cleanup()` do RTL se auto-registra num `afterEach` **global**, que o
 * `node:test` não expõe: sem esta chamada nada é desmontado, os hooks de um
 * caso continuam montados no seguinte e voltam a disparar requisição quando a
 * sessão muda. Foi assim que os seis testes de devolução passaram isolados e
 * falharam em conjunto.
 *
 * **A ordem é o ponto inteiro desta função**, e é por isso que ela existe em
 * vez de três chamadas no `afterEach` de cada arquivo:
 *
 * 1. desmontar, com o servidor falso ainda instalado e a sessão ainda de pé —
 *    a devolução do `useReservaLiberacao` sai aqui;
 * 2. ceder um microtask para ela sair (não é espera artificial do §5.10: nada
 *    é cronometrado);
 * 3. só então desinstalar o adapter e zerar a sessão.
 *
 * Inverter 1 e 3 manda a devolução para o axios de verdade, e a resolução de
 * DNS do host falso segura o processo do runner de pé.
 */
export async function encerrarTeste(): Promise<void> {
  // O `onSuccess` de uma mutation muda a sessão, e a sessão é lida por
  // `useSessionStore` dentro do próprio hook: o re-render nasce fora de
  // `act()`, porque quem esperou a mutation foi o teste. Este `act` vazio
  // adota esse trabalho pendente antes do desmonte — sem ele o runner acusa
  // "atividade assíncrona após o teste" com `window is not defined`.
  await act(async () => {});

  cleanup();

  // `setImmediate`, e não `Promise.resolve()`: a devolução do
  // `useReservaLiberacao` atravessa o `.then` do cleanup, o `Axios.request`, o
  // interceptor e o adapter. Um microtask cobre isso hoje por margem de um
  // tique, e ninguém vai recontar esses tiques ao mexer no hook.
  await new Promise((resolve) => setImmediate(resolve));

  restaurarServidores();
  limparSessao();
}
