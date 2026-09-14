import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  parseMensagemWeb,
  VERSAO_MENSAGEM_WEB,
} from '@/features/web-systems/schemas/mensagem-web.schema';

/**
 * O que chega da WebView é entrada não confiável, igual à rede e ao disco
 * (CLAUDE.md §4.8). Tudo fora do contrato tem que virar `null` — o original
 * lia dois protocolos concatenados em URL e não validava nada
 * (docs/analise §5.3, §7.1.9).
 */
function bruta(payload: unknown): string {
  return JSON.stringify(payload);
}

describe('parseMensagemWeb — as três mensagens do contrato', () => {
  test('sessao:solicitar', () => {
    const msg = parseMensagemWeb(bruta({ v: VERSAO_MENSAGEM_WEB, tipo: 'sessao:solicitar' }));
    assert.equal(msg?.tipo, 'sessao:solicitar');
  });

  test('navegacao:fechar', () => {
    const msg = parseMensagemWeb(bruta({ v: VERSAO_MENSAGEM_WEB, tipo: 'navegacao:fechar' }));
    assert.equal(msg?.tipo, 'navegacao:fechar');
  });

  test('bordero:retorno carrega o payload sem validá-lo', () => {
    // `retorno` é `unknown` de propósito: quem sabe validá-lo é a feature
    // liberacoes, e feature não importa feature (CLAUDE.md §2).
    const retorno = { sequencia: '77', situacao: 'X' };
    const msg = parseMensagemWeb(
      bruta({ v: VERSAO_MENSAGEM_WEB, tipo: 'bordero:retorno', retorno }),
    );
    assert.equal(msg?.tipo, 'bordero:retorno');
    assert.deepEqual(msg?.tipo === 'bordero:retorno' && msg.retorno, retorno);
  });
});

describe('parseMensagemWeb — tudo fora do contrato vira null', () => {
  const foraDoContrato: [string, string][] = [
    ['JSON inválido', '{ nao fecha'],
    ['string vazia', ''],
    ['JSON que não é objeto', '"sessao:solicitar"'],
    ['null', 'null'],
    ['array', '[]'],
    ['sem envelope de versão', bruta({ tipo: 'sessao:solicitar' })],
    ['versão futura', bruta({ v: VERSAO_MENSAGEM_WEB + 1, tipo: 'sessao:solicitar' })],
    ['versão em texto', bruta({ v: String(VERSAO_MENSAGEM_WEB), tipo: 'sessao:solicitar' })],
    ['tipo desconhecido', bruta({ v: VERSAO_MENSAGEM_WEB, tipo: 'sessao:roubar' })],
    ['sem tipo', bruta({ v: VERSAO_MENSAGEM_WEB })],
    // O contrato (§13.3) manda `retorno` com { sequencia, situacao, resposta };
    // sem ele não há o que publicar no store nem chave para conferir.
    ['bordero:retorno sem carga', bruta({ v: VERSAO_MENSAGEM_WEB, tipo: 'bordero:retorno' })],
    ['protocolo do original', 'delphi://{"sequencia":"1"}'],
    ['navegação do original', 'app://menu'],
  ];

  for (const [nome, texto] of foraDoContrato) {
    test(nome, () => {
      assert.equal(parseMensagemWeb(texto), null, `${nome} não pode ser aceito`);
    });
  }

  test('JSON inválido não lança — quem chama descarta em silêncio', () => {
    assert.doesNotThrow(() => parseMensagemWeb('{{{'));
  });
});
