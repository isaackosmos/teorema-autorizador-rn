import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';

import { waitFor } from '@testing-library/react';

import { liberacoesKeys } from '@/features/liberacoes/api/liberacoes.keys';
import { useDecidirLiberacao } from '@/features/liberacoes/hooks/use-decidir-liberacao';
import { Decisao } from '@/features/liberacoes/schemas/liberacao.schema';
import { ApiError } from '@/shared/lib/http/errors';
import { instalarTenantFalso, SEMPRE_OK } from '@/shared/lib/testing/http-falso';
import { criarQueryClient, encerrarTeste, renderizarHook } from '@/shared/lib/testing/render-hook';
import { comUsuarioLogado } from '@/shared/lib/testing/sessao-de-teste';

import type { QueryClient } from '@tanstack/react-query';
import type { Resposta } from '@/shared/lib/testing/http-falso';

beforeEach(() => {
  comUsuarioLogado();
});

afterEach(encerrarTeste);

const EMPRESA = '1';
const CLIENTE = '00042';

/**
 * Um client com as três famílias de key da feature já em cache, cada uma
 * marcada como fresca.
 *
 * A invalidação é medida pelo **efeito** — quais queries deixaram de estar
 * frescas —, e não pelo argumento passado a `invalidateQueries`. É a diferença
 * entre travar o nome do prefixo e travar a largura dele, que é o conteúdo da
 * dívida D5.
 */
function clientComCacheDaFeature(userCode: string): QueryClient {
  const queryClient = criarQueryClient();

  queryClient.setQueryData(liberacoesKeys.pendentes(userCode), []);
  queryClient.setQueryData(liberacoesKeys.credito(EMPRESA, CLIENTE), { limiteCredito: 1 });
  queryClient.setQueryData(liberacoesKeys.historico(EMPRESA, CLIENTE), []);

  return queryClient;
}

/** `true` quando a query saiu de fresca — ou seja, foi invalidada. */
function foiInvalidada(queryClient: QueryClient, queryKey: readonly unknown[]): boolean {
  return queryClient.getQueryState(queryKey)?.isInvalidated === true;
}

describe('useDecidirLiberacao — as duas decisões, uma mutation', () => {
  test('autorizar bate em /authorize com o texto da resposta', async () => {
    const servidor = instalarTenantFalso(SEMPRE_OK);
    const { result } = renderizarHook(() => useDecidirLiberacao());

    await result.current.mutateAsync({
      id: '45678',
      decisao: Decisao.Autorizar,
      resposta: 'liberado',
    });

    assert.equal(servidor.requisicoes.length, 1);
    assert.equal(servidor.requisicoes[0]?.metodo, 'POST');
    assert.match(servidor.requisicoes[0]?.url ?? '', /\/authorize\/45678$/);
    assert.equal(servidor.requisicoes[0]?.corpo, 'liberado');
  });

  test('reprovar bate em /reject — mesma forma, sem bloco duplicado', async () => {
    // No original `AutorizaRequisicao` e `ReprovaRequisicao` eram o mesmo
    // código copiado (docs/analise §7.3.21).
    const servidor = instalarTenantFalso(SEMPRE_OK);
    const { result } = renderizarHook(() => useDecidirLiberacao());

    await result.current.mutateAsync({ id: '99', decisao: Decisao.Reprovar, resposta: '' });

    assert.match(servidor.requisicoes[0]?.url ?? '', /\/reject\/99$/);
  });

  test('sucesso é 2xx, sem olhar o corpo', async () => {
    // O original comparava o corpo com a string '{}' e virava erro a qualquer
    // mudança de formatação (docs/analise §7.1.8).
    instalarTenantFalso(() => ({ status: 204, corpo: 'qualquer coisa' }));
    const { result } = renderizarHook(() => useDecidirLiberacao());

    await result.current.mutateAsync({ id: '1', decisao: Decisao.Autorizar, resposta: '' });

    await waitFor(() => assert.equal(result.current.isSuccess, true));
  });
});

describe('useDecidirLiberacao — invalidação', () => {
  test('a fila cai depois de decidir', async () => {
    const user = comUsuarioLogado();
    const queryClient = clientComCacheDaFeature(user.code);
    instalarTenantFalso(SEMPRE_OK);
    const { result } = renderizarHook(() => useDecidirLiberacao(), { queryClient });

    await result.current.mutateAsync({ id: '1', decisao: Decisao.Autorizar, resposta: '' });

    assert.equal(foiInvalidada(queryClient, liberacoesKeys.pendentes(user.code)), true);
  });

  test('a análise do cliente cai junto — largura da dívida D5', async () => {
    // **Fixa o comportamento de hoje, não o desejado.** `liberacoesKeys.all` é
    // prefixo de `credito()` e `historico()`, então decidir uma liberação
    // refaz a análise de crédito de **todo** cliente em cache. É a dívida D5
    // do CLAUDE.md §9, e o prefixo estreito (`fila`) já existe desde a E1.
    //
    // O teste mede o efeito, e não o argumento de `invalidateQueries`: é a
    // diferença entre travar o nome do prefixo e travar a largura dele. Ao
    // pagar a D5 estas duas asserções viram `false`, e é esse diff que torna
    // a troca de uma linha o "decidido de propósito" que a §9 pede.
    const user = comUsuarioLogado();
    const queryClient = clientComCacheDaFeature(user.code);
    instalarTenantFalso(SEMPRE_OK);
    const { result } = renderizarHook(() => useDecidirLiberacao(), { queryClient });

    await result.current.mutateAsync({ id: '1', decisao: Decisao.Autorizar, resposta: '' });

    assert.equal(foiInvalidada(queryClient, liberacoesKeys.credito(EMPRESA, CLIENTE)), true);
    assert.equal(foiInvalidada(queryClient, liberacoesKeys.historico(EMPRESA, CLIENTE)), true);
  });

  test('decisão que falhou não derruba nada do cache', async () => {
    const user = comUsuarioLogado();
    const queryClient = clientComCacheDaFeature(user.code);
    instalarTenantFalso(() => ({ status: 500 }));
    const { result } = renderizarHook(() => useDecidirLiberacao(), { queryClient });

    await assert.rejects(
      result.current.mutateAsync({ id: '1', decisao: Decisao.Autorizar, resposta: '' }),
    );

    assert.equal(foiInvalidada(queryClient, liberacoesKeys.pendentes(user.code)), false);
    assert.equal(foiInvalidada(queryClient, liberacoesKeys.credito(EMPRESA, CLIENTE)), false);
  });
});

describe('useDecidirLiberacao — erro tipado', () => {
  const casos: { nome: string; resposta: Resposta; status: number }[] = [
    { nome: '401 do servidor', resposta: { status: 401 }, status: 401 },
    { nome: '403 do servidor', resposta: { status: 403 }, status: 403 },
    { nome: '500 do servidor', resposta: { status: 500 }, status: 500 },
    { nome: 'sem rede', resposta: { rede: 'falhou' }, status: 0 },
  ];

  for (const caso of casos) {
    test(`${caso.nome} chega como ApiError com status ${caso.status}`, async () => {
      instalarTenantFalso(() => caso.resposta);
      const { result } = renderizarHook(() => useDecidirLiberacao());

      await assert.rejects(
        result.current.mutateAsync({ id: '1', decisao: Decisao.Autorizar, resposta: '' }),
        (erro: unknown) => {
          // A UI decide por `status`, nunca por texto (CLAUDE.md §5.11).
          assert.ok(erro instanceof ApiError, 'não chegou como ApiError');
          assert.equal(erro.status, caso.status);
          return true;
        },
      );
    });
  }
});
