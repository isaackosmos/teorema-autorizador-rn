import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import { waitFor } from '@testing-library/react';

import { useReservaLiberacao } from '@/features/liberacoes/hooks/use-reserva-liberacao';
import { ApiError } from '@/shared/lib/http/errors';
import {
  deixarAssentar,
  instalarTenantFalso,
  respostaSegurada,
  SEMPRE_OK,
} from '@/shared/lib/testing/http-falso';
import { encerrarTeste, renderizarHook } from '@/shared/lib/testing/render-hook';
import { comAparelhoAtivo, comUsuarioLogado } from '@/shared/lib/testing/sessao-de-teste';

import type { Requisicao } from '@/shared/lib/testing/http-falso';

/**
 * Ciclo de vida da reserva (docs/analise §3.3): reserva ao abrir a análise,
 * devolve para a fila ao sair sem decidir.
 *
 * É o hook onde errar custa mais caro no app: uma devolução a mais derruba o
 * trabalho de outro usuário, e uma a menos deixa a liberação presa em `'1'`
 * para sempre — e a trava do servidor ainda é fictícia (🔒 B3), então não há
 * rede de proteção nenhuma embaixo.
 */

const ID = '45678';

/** Só o verbo de cada requisição, que é o que estes casos afirmam. */
function rotas(requisicoes: readonly Requisicao[]): string[] {
  return requisicoes.map((req) => /\/(reserve|release)\//.exec(req.url)?.[1] ?? req.url);
}

/** Desmonta, deixa a devolução sair, desinstala o servidor e zera a sessão. */
afterEach(encerrarTeste);

describe('useReservaLiberacao — reserva ao montar', () => {
  test('chama reserve com o id e o código do usuário', async () => {
    const user = comUsuarioLogado();
    const servidor = instalarTenantFalso(SEMPRE_OK);

    renderizarHook(() => useReservaLiberacao(ID));

    await waitFor(() => assert.equal(servidor.requisicoes.length, 1));
    assert.match(servidor.requisicoes[0]?.url ?? '', new RegExp(`/reserve/${ID}/${user.code}$`));
  });

  test('sem usuário logado não reserva nada', async () => {
    comAparelhoAtivo();
    const servidor = instalarTenantFalso(SEMPRE_OK);

    const { result } = renderizarHook(() => useReservaLiberacao(ID));

    await deixarAssentar();
    assert.equal(result.current.reservando, true);
    assert.deepEqual(servidor.requisicoes, []);
  });

  test('reservando trava a ação enquanto a reserva está no ar', async () => {
    // O contrato é "não decidir sem ter reservado", e o hook o cumpre somando
    // `idle` a `pending`. O tique de `idle` não é observável daqui — o `act()`
    // do `renderHook` já despachou o efeito quando o teste lê `result` —,
    // então o que se trava aqui é o contrato, não o valor do status.
    comUsuarioLogado();
    const reserva = respostaSegurada();
    instalarTenantFalso(() => reserva.promessa);

    const { result } = renderizarHook(() => useReservaLiberacao(ID));
    assert.equal(result.current.reservando, true);

    reserva.liberar();
    await waitFor(() => assert.equal(result.current.reservando, false));
  });

  test('reserva recusada vira ApiError no hook e sai de reservando', async () => {
    comUsuarioLogado();
    instalarTenantFalso(() => ({ status: 500 }));

    const { result } = renderizarHook(() => useReservaLiberacao(ID));

    await waitFor(() => assert.equal(result.current.reservando, false));
    assert.ok(result.current.erro instanceof ApiError);
    assert.equal(result.current.erro?.status, 500);
  });
});

describe('useReservaLiberacao — devolução ao sair', () => {
  test('sair sem decidir devolve a liberação para a fila', async () => {
    comUsuarioLogado();
    const servidor = instalarTenantFalso(SEMPRE_OK);

    const { unmount } = renderizarHook(() => useReservaLiberacao(ID));
    await waitFor(() => assert.equal(servidor.requisicoes.length, 1));

    unmount();
    await waitFor(() => assert.deepEqual(rotas(servidor.requisicoes), ['reserve', 'release']));
  });

  test('sair depois de decidir NÃO devolve', async () => {
    // Decidida não se devolve: a situação final é `2`/`3`, não `0`.
    comUsuarioLogado();
    const servidor = instalarTenantFalso(SEMPRE_OK);

    const { result, unmount } = renderizarHook(() => useReservaLiberacao(ID));
    await waitFor(() => assert.equal(result.current.reservando, false));

    result.current.marcarDecidida();
    unmount();

    await deixarAssentar();
    assert.deepEqual(rotas(servidor.requisicoes), ['reserve']);
  });

  test('reserva recusada NÃO devolve — o release derrubaria outro usuário', async () => {
    // Sem isto, sair de uma liberação que já estava em análise com outra
    // pessoa a devolveria para a fila por baixo dela.
    comUsuarioLogado();
    const servidor = instalarTenantFalso((req) =>
      req.url.includes('/reserve/') ? { status: 409 } : SEMPRE_OK(),
    );

    const { result, unmount } = renderizarHook(() => useReservaLiberacao(ID));
    await waitFor(() => assert.equal(result.current.reservando, false));

    unmount();

    await deixarAssentar();
    assert.deepEqual(rotas(servidor.requisicoes), ['reserve']);
  });

  test('sem usuário logado não devolve nada', async () => {
    comAparelhoAtivo();
    const servidor = instalarTenantFalso(SEMPRE_OK);

    const { unmount } = renderizarHook(() => useReservaLiberacao(ID));
    unmount();

    await deixarAssentar();
    assert.deepEqual(servidor.requisicoes, []);
  });
});

describe('useReservaLiberacao — sair antes de a reserva voltar (docs/analise §7.1.4)', () => {
  test('a devolução espera a reserva resolver, e só então sai', async () => {
    // O defeito do original: sair antes de a resposta chegar deixava a
    // liberação presa em `'1'`. O caso segura a reserva no ar, desmonta, e
    // exige que nada saia enquanto ela não voltar.
    comUsuarioLogado();
    const reserva = respostaSegurada();
    const servidor = instalarTenantFalso((req) =>
      req.url.includes('/reserve/') ? reserva.promessa : SEMPRE_OK(),
    );

    const { unmount } = renderizarHook(() => useReservaLiberacao(ID));
    await waitFor(() => assert.equal(servidor.requisicoes.length, 1));

    unmount();
    await deixarAssentar();
    assert.deepEqual(rotas(servidor.requisicoes), ['reserve'], 'devolveu antes da reserva voltar');

    reserva.liberar();
    await waitFor(() => assert.deepEqual(rotas(servidor.requisicoes), ['reserve', 'release']));
  });

  test('reserva que só falha depois do unmount também não devolve', async () => {
    comUsuarioLogado();
    const reserva = respostaSegurada({ status: 500 });
    const servidor = instalarTenantFalso((req) =>
      req.url.includes('/reserve/') ? reserva.promessa : SEMPRE_OK(),
    );

    const { unmount } = renderizarHook(() => useReservaLiberacao(ID));
    await waitFor(() => assert.equal(servidor.requisicoes.length, 1));

    unmount();
    reserva.liberar();

    await deixarAssentar();
    assert.deepEqual(rotas(servidor.requisicoes), ['reserve']);
  });

  test('falha ao devolver não derruba nada — o usuário já saiu', async () => {
    comUsuarioLogado();
    const avisos: unknown[] = [];
    const warnOriginal = console.warn;
    console.warn = (...args: unknown[]) => avisos.push(args[0]);

    const servidor = instalarTenantFalso((req) =>
      req.url.includes('/release/') ? { status: 500 } : SEMPRE_OK(),
    );

    try {
      const { unmount } = renderizarHook(() => useReservaLiberacao(ID));
      await waitFor(() => assert.equal(servidor.requisicoes.length, 1));

      unmount();
      await waitFor(() => assert.equal(servidor.requisicoes.length, 2));
      await waitFor(() => assert.equal(avisos.length, 1));
      assert.match(String(avisos[0]), /devolver a liberação/i);
    } finally {
      console.warn = warnOriginal;
    }
  });
});
