import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import { useRegistrarAparelho } from '@/features/auth/hooks/use-registrar-aparelho';
import { ApiError, SessionError } from '@/shared/lib/http/errors';
import { instalarCentralFalso } from '@/shared/lib/testing/http-falso';
import { encerrarTeste, renderizarHook } from '@/shared/lib/testing/render-hook';
import { comAparelhoAtivo, comUsuarioLogado } from '@/shared/lib/testing/sessao-de-teste';
import { navegacoesRegistradas } from '@/shared/lib/testing/stubs/expo-router';
import { comPlataforma } from '@/shared/lib/testing/stubs/react-native';
import { useSessionStore } from '@/shared/stores/session.store';
import { DeviceStatus } from '@/shared/types/session.types';

import type { Device } from '@/shared/types/session.types';

/**
 * Passo 2 do onboarding: registra o aparelho no central e consome uma licença.
 *
 * Duas regras do produto vivem aqui e o teste as separa de propósito: **recusa
 * de licença não é erro** (volta em `data.ok === false`, e é a tela que decide
 * o que mostrar), e a navegação de sucesso é **imediata** — o original parava
 * numa tela "Concluído" com `Sleep(5000)` (docs/analise §7.2.13).
 */

const FORMULARIO = { apelido: 'Tablet da portaria', nomeUsuario: 'Fulano', contato: '11999990000' };

afterEach(encerrarTeste);

describe('useRegistrarAparelho — pré-condições viram ApiError sem tocar a rede', () => {
  const faltando: { nome: string; patch: Partial<Device>; trecho: RegExp }[] = [
    {
      nome: 'documento da empresa',
      patch: { companyDocument: null },
      trecho: /Documento da empresa/i,
    },
    { nome: 'código da empresa', patch: { companyCode: null }, trecho: /Documento da empresa/i },
    { nome: 'id da empresa', patch: { companyId: null }, trecho: /Documento da empresa/i },
    {
      nome: 'endereço do servidor',
      patch: { serverUrlPrimary: null },
      trecho: /Endereço do servidor/i,
    },
  ];

  for (const caso of faltando) {
    test(`sem ${caso.nome} não sai requisição`, async () => {
      comUsuarioLogado();
      useSessionStore.setState((s) => ({ device: { ...s.device, ...caso.patch } }));
      const servidor = instalarCentralFalso(() => ({ status: 200, corpo: { id: 1 } }));
      const { result } = renderizarHook(() => useRegistrarAparelho());

      await assert.rejects(result.current.mutateAsync(FORMULARIO), (erro: unknown) => {
        assert.ok(erro instanceof SessionError);
        // Dívida D9 paga na F1: pré-condição de sessão tem status próprio, e
        // não mais o 0 que se passava por "sem rede" para quem olha
        // `isNetworkError`.
        assert.equal(erro.status, 424);
        assert.equal(erro.isNetworkError, false);
        assert.match(erro.message, caso.trecho);
        return true;
      });

      assert.deepEqual(servidor.requisicoes, [], 'não pode consumir licença sem os dados');
    });
  }

  test('sem usuário logado não registra — o central exige userlogin/userid', async () => {
    // É por isso que o registro acontece depois do login (plano A3/A5).
    comAparelhoAtivo();
    const servidor = instalarCentralFalso(() => ({ status: 200, corpo: { id: 1 } }));
    const { result } = renderizarHook(() => useRegistrarAparelho());

    await assert.rejects(result.current.mutateAsync(FORMULARIO), (erro: unknown) => {
      assert.ok(erro instanceof ApiError);
      assert.match(erro.message, /usuário do ERP/i);
      return true;
    });

    assert.deepEqual(servidor.requisicoes, []);
  });
});

describe('useRegistrarAparelho — registro aceito', () => {
  test('grava registro, validade e status Ativo, e segue para a empresa', async () => {
    comUsuarioLogado();
    instalarCentralFalso(() => ({ status: 200, corpo: { id: 31, expiration: '31/12/2026' } }));
    const { result } = renderizarHook(() => useRegistrarAparelho());

    await result.current.mutateAsync(FORMULARIO);

    const device = useSessionStore.getState().device;
    assert.equal(device.status, DeviceStatus.Ativo);
    assert.equal(device.registerId, 31);
    assert.equal(device.registerExpiration, '2026-12-31', 'a validade vem em ISO do schema');
  });

  test('a navegação é imediata, sem tela de "Concluído"', async () => {
    // O original gastava `Sleep(5000)` aqui (docs/analise §7.2.13, §5.10).
    comUsuarioLogado();
    instalarCentralFalso(() => ({ status: 200, corpo: { id: 31 } }));
    const { result } = renderizarHook(() => useRegistrarAparelho());

    await result.current.mutateAsync(FORMULARIO);

    assert.deepEqual(navegacoesRegistradas(), [{ metodo: 'replace', destino: '/(auth)/empresa' }]);
  });

  test('licença paga vem sem validade e isso não é erro', async () => {
    comUsuarioLogado();
    instalarCentralFalso(() => ({ status: 200, corpo: { id: 31 } }));
    const { result } = renderizarHook(() => useRegistrarAparelho());

    await result.current.mutateAsync(FORMULARIO);

    assert.equal(useSessionStore.getState().device.registerExpiration, null);
    assert.equal(useSessionStore.getState().device.status, DeviceStatus.Ativo);
  });

  test('em iOS o DEVICE_NAME muda de ramo', async () => {
    // `nomeDoAparelho()` tem um ramo por plataforma; o `DEVICE_NAME` é rótulo
    // e nada decide por ele, mas os dois ramos precisam produzir texto.
    const voltar = comPlataforma('ios');
    try {
      comUsuarioLogado();
      const servidor = instalarCentralFalso(() => ({ status: 200, corpo: { id: 31 } }));
      const { result } = renderizarHook(() => useRegistrarAparelho());

      await result.current.mutateAsync(FORMULARIO);

      const corpo = JSON.parse(String(servidor.requisicoes[0]?.corpo)) as Record<string, unknown>;
      assert.match(String(corpo['devicename']), /^iOS /);
    } finally {
      voltar();
    }
  });

  test('manda o usuário autenticado e a empresa licenciada no corpo', async () => {
    const user = comUsuarioLogado();
    const servidor = instalarCentralFalso(() => ({ status: 200, corpo: { id: 31 } }));
    const { result } = renderizarHook(() => useRegistrarAparelho());

    await result.current.mutateAsync(FORMULARIO);

    const corpo = JSON.parse(String(servidor.requisicoes[0]?.corpo)) as Record<string, unknown>;
    assert.equal(corpo['userlogin'], user.username);
    // O central recebe `userid` como texto — é o schema quem converte
    // (`registro-aparelho.schema.ts`), e é isso que o teste trava.
    assert.equal(corpo['userid'], String(user.id));
    assert.ok(corpo['systemcode'], 'o systemcode do .env acompanha o registro');
  });
});

describe('useRegistrarAparelho — recusa de licença não é erro', () => {
  // O central responde **200 com uma palavra em texto puro** (docs/analise §3.1).
  for (const motivo of ['bloqueado', 'licencas', 'demo']) {
    test(`"${motivo}" volta em data.ok=false, sem gravar nem navegar`, async () => {
      // Aparelho ainda não registrado: é o cenário real da recusa.
      comUsuarioLogado();
      useSessionStore.setState((s) => ({
        device: { ...s.device, status: DeviceStatus.NaoRegistrado, registerId: null },
      }));
      instalarCentralFalso(() => ({ status: 200, corpo: motivo }));
      const { result } = renderizarHook(() => useRegistrarAparelho());

      const resultado = await result.current.mutateAsync(FORMULARIO);

      assert.equal(resultado.ok, false);
      assert.equal(resultado.ok === false && resultado.motivo, motivo);

      const device = useSessionStore.getState().device;
      assert.equal(device.status, DeviceStatus.NaoRegistrado, 'recusa não ativa o aparelho');
      assert.equal(device.registerId, null);
      assert.deepEqual(navegacoesRegistradas(), [], 'recusa não avança o onboarding');
    });
  }
});

describe('useRegistrarAparelho — erro tipado', () => {
  test('500 do central chega como ApiError e não muda a sessão', async () => {
    comUsuarioLogado();
    const antes = useSessionStore.getState().device.registerId;
    instalarCentralFalso(() => ({ status: 500 }));
    const { result } = renderizarHook(() => useRegistrarAparelho());

    await assert.rejects(result.current.mutateAsync(FORMULARIO), (erro: unknown) => {
      assert.ok(erro instanceof ApiError);
      assert.equal(erro.status, 500);
      return true;
    });

    assert.equal(useSessionStore.getState().device.registerId, antes);
    assert.deepEqual(navegacoesRegistradas(), []);
  });

  test('sem rede chega como ApiError com status 0', async () => {
    comUsuarioLogado();
    instalarCentralFalso(() => ({ rede: 'falhou' }));
    const { result } = renderizarHook(() => useRegistrarAparelho());

    await assert.rejects(result.current.mutateAsync(FORMULARIO), (erro: unknown) => {
      assert.ok(erro instanceof ApiError);
      assert.equal(erro.status, 0);
      return true;
    });
  });
});
