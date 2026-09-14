import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { borderoRetornoSchema } from '@/features/liberacoes/schemas/bordero-retorno.schema';

/**
 * O que volta do HTML do autorizador financeiro é entrada não confiável
 * (CLAUDE.md §4.8). Quem **calcula** S/N/P é o borderô; o app só repassa
 * (docs/analise §7.3.21) — nenhum caso aqui recalcula situação.
 */
function retorno(extra: Record<string, unknown> = {}) {
  return { sequencia: '45678', situacao: 'S', resposta: 'ok', ...extra };
}

describe('borderoRetornoSchema — situação', () => {
  test('os quatro valores do contrato passam', () => {
    for (const situacao of ['', 'S', 'N', 'P']) {
      assert.equal(borderoRetornoSchema.parse(retorno({ situacao })).situacao, situacao);
    }
  });

  test('minúscula é aceita e normalizada', () => {
    assert.equal(borderoRetornoSchema.parse(retorno({ situacao: 's' })).situacao, 'S');
    assert.equal(borderoRetornoSchema.parse(retorno({ situacao: ' p ' })).situacao, 'P');
  });

  test('situação desconhecida cai em vazio e não derruba o retorno', () => {
    // Preservar a situação anterior da liberação é sempre o caminho seguro;
    // vazio significa "o usuário só fechou a tela" (docs/analise §3.3).
    for (const situacao of ['X', 'SIM', '2', 'null']) {
      assert.equal(borderoRetornoSchema.parse(retorno({ situacao })).situacao, '');
    }
  });

  test('situação ausente ou nula cai em vazio', () => {
    assert.equal(borderoRetornoSchema.parse(retorno({ situacao: null })).situacao, '');
    assert.equal(borderoRetornoSchema.parse({ sequencia: '1' }).situacao, '');
  });
});

describe('borderoRetornoSchema — sequência e resposta', () => {
  test('sequência numérica vira string, porque é chave de comparação', () => {
    // Ela tem de bater com a `contexto.sequencia` que abriu a rota; comparar
    // 45678 com '45678' falharia em silêncio.
    assert.equal(borderoRetornoSchema.parse(retorno({ sequencia: 45678 })).sequencia, '45678');
  });

  test('sequência ausente é recusada', () => {
    assert.equal(borderoRetornoSchema.safeParse({ situacao: 'S' }).success, false);
  });

  test('resposta é aparada, e a ausência vira vazio em vez de null', () => {
    const comEspaco = borderoRetornoSchema.parse(retorno({ resposta: '  com ressalva  ' }));
    assert.equal(comEspaco.resposta, 'com ressalva');
    assert.equal(borderoRetornoSchema.parse(retorno({ resposta: null })).resposta, '');
    assert.equal(borderoRetornoSchema.parse({ sequencia: '1' }).resposta, '');
  });

  test('o payload concatenado do original não passa', () => {
    // `delphi://<json>` na URL (docs/analise §7.1.9).
    assert.equal(borderoRetornoSchema.safeParse('delphi://{"sequencia":"1"}').success, false);
    assert.equal(borderoRetornoSchema.safeParse(null).success, false);
  });
});
