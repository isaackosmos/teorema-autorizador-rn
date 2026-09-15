import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import { tenantApi } from '@/shared/lib/http/client';
import { ApiError } from '@/shared/lib/http/errors';
import { instalarTenantFalso, respostaSegurada } from '@/shared/lib/testing/http-falso';
import { encerrarTeste } from '@/shared/lib/testing/render-hook';
import { comAparelhoAtivo } from '@/shared/lib/testing/sessao-de-teste';
import { useSessionStore } from '@/shared/stores/session.store';

import type { Resposta } from '@/shared/lib/testing/http-falso';

/**
 * Failover em runtime (plano F1).
 *
 * O servidor falso é troca de adapter, então a requisição percorre os
 * interceptores de verdade — que é justamente o que está sendo testado aqui.
 * Um mock do módulo de API não veria nada disso.
 */

const PRIMARIO = 'https://primario.teste';
const SECUNDARIO = 'https://secundario.teste';

/** Responde por endereço: quem não está na lista de vivos cai como rede. */
function servidorVivoEm(...vivos: string[]) {
  return instalarTenantFalso(({ baseURL }): Resposta =>
    baseURL !== undefined && vivos.includes(baseURL)
      ? { status: 200, corpo: { ok: true } }
      : { rede: 'falhou' },
  );
}

/** Os dois endereços configurados, com o primário ativo. */
function comOsDoisEnderecos(): void {
  comAparelhoAtivo({
    serverUrlPrimary: PRIMARIO,
    serverUrlSecondary: SECUNDARIO,
    serverUrlActive: PRIMARIO,
  });
}

const enderecoAtivo = () => useSessionStore.getState().device.serverUrlActive;
const estaOnline = () => useSessionStore.getState().online;

/** Rejeição da requisição, para inspecionar o erro sem `try/catch`. */
function erroDe(promessa: Promise<unknown>): Promise<unknown> {
  return promessa.then(
    () => assert.fail('a requisição devia ter falhado'),
    (erro: unknown) => erro,
  );
}

afterEach(encerrarTeste);

describe('failover do tenant — elege o endereço que responde', () => {
  test('primário morto e secundário vivo: reenvia e elege o secundário', async () => {
    comOsDoisEnderecos();
    const servidor = servidorVivoEm(SECUNDARIO);

    const { data } = await tenantApi.get('/v1/remoteauthorization/searchpending/005');

    // O chamador recebe a resposta: para a feature, o failover não aconteceu.
    assert.deepEqual(data, { ok: true });
    assert.equal(servidor.requisicoes.length, 2);
    assert.equal(servidor.requisicoes[0]?.baseURL, PRIMARIO);
    assert.equal(servidor.requisicoes[1]?.baseURL, SECUNDARIO);
    assert.equal(enderecoAtivo(), SECUNDARIO);
    assert.equal(estaOnline(), true);
  });

  test('a eleição vale para as requisições seguintes', async () => {
    comOsDoisEnderecos();
    const servidor = servidorVivoEm(SECUNDARIO);

    await tenantApi.get('/v1/ping-1');
    await tenantApi.get('/v1/ping-2');

    // 2 da primeira (falha + reenvio) e **1** da segunda, que já nasceu no
    // endereço eleito. É o "sem duplicar o teste em cada tela" da ficha.
    assert.equal(servidor.requisicoes.length, 3);
    assert.equal(servidor.requisicoes[2]?.baseURL, SECUNDARIO);
  });

  test('volta para o primário quando é o secundário que cai', async () => {
    comAparelhoAtivo({
      serverUrlPrimary: PRIMARIO,
      serverUrlSecondary: SECUNDARIO,
      serverUrlActive: SECUNDARIO,
    });
    servidorVivoEm(PRIMARIO);

    await tenantApi.get('/v1/ping');

    // A recuperação é nos dois sentidos: o primário voltar não exige refazer
    // o onboarding.
    assert.equal(enderecoAtivo(), PRIMARIO);
  });

  test('requisição lenta não é mandada de volta ao endereço já derrubado', async () => {
    comOsDoisEnderecos();
    const lenta = respostaSegurada({ rede: 'falhou' });
    let primeiraDoB = true;

    const servidor = instalarTenantFalso(({ url, baseURL }) => {
      // A primeira ida de /v1/b fica no ar até a de /v1/a ter eleito o
      // secundário. É o que separa "alternativo do endereço que EU usei" de
      // "alternativo do ativo corrente": só a primeira leva /v1/b ao endereço
      // vivo, porque quando ela for tratada o ativo já será o secundário.
      if (url === '/v1/b' && primeiraDoB) {
        primeiraDoB = false;
        return lenta.promessa;
      }
      return baseURL === SECUNDARIO ? { status: 200, corpo: { ok: true } } : { rede: 'falhou' };
    });

    const b = tenantApi.get('/v1/b');
    await tenantApi.get('/v1/a');
    assert.equal(enderecoAtivo(), SECUNDARIO, 'a primeira já elegeu');

    lenta.liberar();
    await b;

    const reenvioDeB = servidor.requisicoes.filter((r) => r.url === '/v1/b').at(-1);
    assert.equal(reenvioDeB?.baseURL, SECUNDARIO);
  });
});

describe('failover do tenant — quando não há troca a fazer', () => {
  test('os dois mortos: erro de rede, offline, e exatamente duas tentativas', async () => {
    comOsDoisEnderecos();
    const servidor = servidorVivoEm();

    const erro = await erroDe(tenantApi.get('/v1/ping'));

    assert.ok(erro instanceof ApiError);
    assert.equal(erro.isNetworkError, true);
    // Só agora `online: false` significa o que o comentário do store promete:
    // nem o primário nem o secundário responderam.
    assert.equal(estaOnline(), false);
    // O número é o ponto: sem a marca de "já tentei", primário e secundário
    // ficariam se alternando para sempre.
    assert.equal(servidor.requisicoes.length, 2);
    assert.equal(enderecoAtivo(), PRIMARIO, 'endereço ativo não muda se nada respondeu');
  });

  test('decisão não é reenviada: POST não faz failover', async () => {
    // O reenvio da F1 vale só para método idempotente. "Sem resposta" inclui
    // timeout, e aí o Orion pode já ter gravado — como os dois endereços são
    // do mesmo tenant (docs/analise §3.1), reenviar autorizaria duas vezes.
    comOsDoisEnderecos();
    const servidor = servidorVivoEm(SECUNDARIO);

    const erro = await erroDe(
      tenantApi.post('/v1/remoteauthorization/authorize/9', { resposta: 'ok' }),
    );

    assert.ok(erro instanceof ApiError);
    assert.equal(erro.isNetworkError, true);
    assert.equal(servidor.requisicoes.length, 1, 'a decisão sai uma vez só');
    assert.equal(enderecoAtivo(), PRIMARIO, 'e não elege endereço pelo caminho');
  });

  test('sem secundário configurado não há para onde trocar', async () => {
    comAparelhoAtivo({
      serverUrlPrimary: PRIMARIO,
      serverUrlSecondary: null,
      serverUrlActive: PRIMARIO,
    });
    const servidor = servidorVivoEm();

    await erroDe(tenantApi.get('/v1/ping'));

    assert.equal(servidor.requisicoes.length, 1);
  });

  test('o teste de conexão do onboarding não faz failover', async () => {
    // Ele passa `baseURL` própria justamente para descobrir qual endereço
    // responde: trocar por baixo dele tornaria a resposta dele uma mentira.
    comOsDoisEnderecos();
    const servidor = servidorVivoEm(SECUNDARIO);

    await erroDe(tenantApi.get('/v1/ping', { baseURL: PRIMARIO }));

    assert.equal(servidor.requisicoes.length, 1);
    assert.equal(servidor.requisicoes[0]?.baseURL, PRIMARIO);
    assert.equal(enderecoAtivo(), PRIMARIO);
  });

  test('resposta de erro do servidor não dispara failover', async () => {
    // 4xx prova que o endereço está vivo — trocar de servidor por causa de um
    // erro de negócio mandaria a mesma requisição recusada para o outro lado.
    comOsDoisEnderecos();
    const servidor = instalarTenantFalso((): Resposta => ({ status: 404, corpo: {} }));

    const erro = await erroDe(tenantApi.get('/v1/ping'));

    assert.ok(erro instanceof ApiError);
    assert.equal(erro.status, 404);
    assert.equal(servidor.requisicoes.length, 1);
    assert.equal(enderecoAtivo(), PRIMARIO);
  });

  test('sem endereço nenhum é pré-condição, não rede', async () => {
    comAparelhoAtivo({ serverUrlActive: null });
    const servidor = servidorVivoEm(PRIMARIO, SECUNDARIO);

    const erro = await erroDe(tenantApi.get('/v1/ping'));

    assert.ok(erro instanceof ApiError);
    assert.equal(erro.status, 424, 'SessionError, não o 0 da dívida D9');
    // Nada chegou a sair: não há o que trocar quando não há endereço.
    assert.equal(servidor.requisicoes.length, 0);
    assert.equal(estaOnline(), true);
  });
});
