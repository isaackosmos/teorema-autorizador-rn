import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import { useLogin } from '@/features/auth/hooks/use-login';
import { useHistoricoUsuariosStore } from '@/features/auth/stores/historico-usuarios.store';
import { ApiError } from '@/shared/lib/http/errors';
import { instalarTenantFalso } from '@/shared/lib/testing/http-falso';
import { encerrarTeste, renderizarHook } from '@/shared/lib/testing/render-hook';
import { comAparelhoAtivo } from '@/shared/lib/testing/sessao-de-teste';
import { navegacoesRegistradas } from '@/shared/lib/testing/stubs/expo-router';
import { useSessionStore } from '@/shared/stores/session.store';
import { DeviceStatus } from '@/shared/types/session.types';

import type { Resposta } from '@/shared/lib/testing/http-falso';

/**
 * O hook orquestra mutation + sessão + histórico + navegação. O que ele
 * **não** faz é tão importante quanto: a senha não entra na sessão nem no
 * histórico em lugar nenhum (docs/analise §7.1.9).
 */

const CREDENCIAL = { username: 'FULANO', password: 'segredo' };

/** Resposta do Orion, com os nomes de coluna que o schema traduz. */
const RESPOSTA_LOGIN = {
  TOKEN: 'jwt.abc.123',
  USUARIO_ID: 7,
  USUARIO_CODIGO: '5',
  USUARIO_NOME: 'Fulano de Tal',
};

function servidorRespondendo(corpo: unknown, status = 200) {
  return instalarTenantFalso((): Resposta => ({ status, corpo }));
}

afterEach(async () => {
  // Desmontar primeiro: mexer no store com componente ainda montado agenda
  // render depois do fim do teste, e o runner acusa "atividade assíncrona
  // após o teste".
  await encerrarTeste();
  useHistoricoUsuariosStore.setState({ usuarios: [] });
});

describe('useLogin — sucesso', () => {
  test('grava o usuário traduzido na sessão', async () => {
    comAparelhoAtivo();
    servidorRespondendo(RESPOSTA_LOGIN);
    const { result } = renderizarHook(() => useLogin());

    await result.current.mutateAsync(CREDENCIAL);

    const user = useSessionStore.getState().user;
    assert.equal(user?.jwt, 'jwt.abc.123');
    assert.equal(user?.code, '005', 'o código vem preenchido com zeros do schema');
    assert.equal(user?.username, 'FULANO', 'o login digitado é o userlogin do registro');
  });

  test('a senha não vai para a sessão nem para o histórico', async () => {
    comAparelhoAtivo();
    servidorRespondendo(RESPOSTA_LOGIN);
    const { result } = renderizarHook(() => useLogin());

    await result.current.mutateAsync(CREDENCIAL);

    const gravado = JSON.stringify({
      sessao: useSessionStore.getState(),
      historico: useHistoricoUsuariosStore.getState(),
    });
    assert.doesNotMatch(gravado, /segredo/, 'senha vazou para o estado do app');
  });

  test('o acesso entra no histórico só com o username', async () => {
    comAparelhoAtivo();
    servidorRespondendo(RESPOSTA_LOGIN);
    const { result } = renderizarHook(() => useLogin());

    await result.current.mutateAsync(CREDENCIAL);

    const recentes = useHistoricoUsuariosStore.getState().usuarios;
    assert.equal(recentes.length, 1);
    assert.equal(recentes[0]?.username, 'FULANO');
  });

  test('aparelho ativo segue para a escolha de empresa', async () => {
    comAparelhoAtivo({ status: DeviceStatus.Ativo });
    servidorRespondendo(RESPOSTA_LOGIN);
    const { result } = renderizarHook(() => useLogin());

    await result.current.mutateAsync(CREDENCIAL);

    assert.deepEqual(navegacoesRegistradas(), [{ metodo: 'replace', destino: '/(auth)/empresa' }]);
  });

  test('aparelho não registrado segue para a configuração', async () => {
    // O registro exige um usuário autenticado (`userlogin`/`userid`), então
    // este é o caminho normal do primeiro login, não um erro.
    comAparelhoAtivo({ status: DeviceStatus.NaoRegistrado });
    servidorRespondendo(RESPOSTA_LOGIN);
    const { result } = renderizarHook(() => useLogin());

    await result.current.mutateAsync(CREDENCIAL);

    assert.deepEqual(navegacoesRegistradas(), [
      { metodo: 'replace', destino: '/(auth)/configuracao' },
    ]);
  });
});

describe('useLogin — aparelho bloqueado', () => {
  const RESPOSTA_BLOQUEADO = { ...RESPOSTA_LOGIN, DEVICE_STATUS: DeviceStatus.Bloqueado };

  test('marca o aparelho como bloqueado e não loga ninguém', async () => {
    comAparelhoAtivo({ status: DeviceStatus.Ativo });
    servidorRespondendo(RESPOSTA_BLOQUEADO);
    const { result } = renderizarHook(() => useLogin());

    await result.current.mutateAsync(CREDENCIAL);

    assert.equal(useSessionStore.getState().device.status, DeviceStatus.Bloqueado);
    assert.equal(useSessionStore.getState().user, null, 'não pode entrar com aparelho bloqueado');
    assert.deepEqual(navegacoesRegistradas(), [], 'não navega para lugar nenhum');
  });

  test('mesmo bloqueado, o acesso entra no histórico', async () => {
    // Quem digitou não tem culpa da licença: o servidor aceitou a credencial.
    comAparelhoAtivo();
    servidorRespondendo(RESPOSTA_BLOQUEADO);
    const { result } = renderizarHook(() => useLogin());

    await result.current.mutateAsync(CREDENCIAL);

    assert.equal(useHistoricoUsuariosStore.getState().usuarios[0]?.username, 'FULANO');
  });
});

describe('useLogin — erro tipado', () => {
  const casos: { nome: string; resposta: Resposta; status: number }[] = [
    { nome: 'credencial recusada', resposta: { status: 401 }, status: 401 },
    { nome: 'requisição recusada', resposta: { status: 400 }, status: 400 },
    { nome: 'servidor com falha', resposta: { status: 500 }, status: 500 },
    { nome: 'sem rede', resposta: { rede: 'falhou' }, status: 0 },
  ];

  for (const caso of casos) {
    test(`${caso.nome} vira ApiError ${caso.status} e não toca a sessão`, async () => {
      comAparelhoAtivo();
      instalarTenantFalso(() => caso.resposta);
      const { result } = renderizarHook(() => useLogin());

      await assert.rejects(result.current.mutateAsync(CREDENCIAL), (erro: unknown) => {
        assert.ok(erro instanceof ApiError, 'não chegou como ApiError');
        assert.equal(erro.status, caso.status);
        return true;
      });

      assert.equal(useSessionStore.getState().user, null);
      assert.deepEqual(useHistoricoUsuariosStore.getState().usuarios, []);
      assert.deepEqual(navegacoesRegistradas(), []);
    });
  }

  test('payload fora do contrato também vira ApiError, não ZodError', async () => {
    // `login()` normaliza o contrato na borda com `safeParse` — é o que
    // permite a tela decidir por `status` (CLAUDE.md §4.1).
    comAparelhoAtivo();
    servidorRespondendo({ SEM_TOKEN: true });
    const { result } = renderizarHook(() => useLogin());

    await assert.rejects(result.current.mutateAsync(CREDENCIAL), (erro: unknown) => {
      assert.ok(erro instanceof ApiError, 'ZodError cru chegou até o hook');
      return true;
    });
  });
});
