import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  analiseCreditoSchema,
  historicoComprasSchema,
} from '@/features/liberacoes/schemas/cliente.schema';

describe('analiseCreditoSchema — numérico ausente nunca vira zero', () => {
  /**
   * O caso que justifica o schema inteiro: `z.coerce.number()` transformaria
   * `''` em `0`, e a tela exibiria "R$ 0,00" como se fosse limite de crédito
   * real. No original o campo equivalente aparecia como `FALTA IMPL...` em
   * produção (docs/analise §7.2.12) — errado, mas visivelmente errado.
   */
  const ausencias = [
    ['string vazia', ''],
    ['string só de espaço', '   '],
    ['null', null],
    ['undefined', undefined],
    ['texto não numérico', 'FALTA IMPL'],
    ['NaN em texto', 'NaN'],
  ] as const;

  for (const [nome, valor] of ausencias) {
    test(`${nome} vira null`, () => {
      const analise = analiseCreditoSchema.parse([{ CLIFOR_CREDITO_LIMITE: valor }]);
      assert.equal(analise?.limiteCredito, null, `${nome} não pode virar número`);
    });
  }

  test('zero de verdade continua zero', () => {
    // Ausência e zero são coisas diferentes: limite zerado é uma informação.
    const analise = analiseCreditoSchema.parse([{ CLIFOR_CREDITO_LIMITE: 0 }]);
    assert.equal(analise?.limiteCredito, 0);
  });

  test('número em texto é convertido', () => {
    const analise = analiseCreditoSchema.parse([{ CLIFOR_CREDITO_LIMITE: '1500.75' }]);
    assert.equal(analise?.limiteCredito, 1500.75);
  });

  test('número negativo passa', () => {
    const analise = analiseCreditoSchema.parse([{ MEDIA_ATRASO: -3 }]);
    assert.equal(analise?.mediaAtraso, -3);
  });
});

describe('analiseCreditoSchema — as duas formas do payload', () => {
  const linha = { CC_SITUACAO: 'A', MAIOR_VALOR: 900 };

  test('linha dentro de array (forma de searchpending)', () => {
    assert.equal(analiseCreditoSchema.parse([linha])?.maiorCompra, 900);
  });

  test('objeto solto', () => {
    assert.equal(analiseCreditoSchema.parse(linha)?.maiorCompra, 900);
  });

  test('array vazio é cliente sem histórico, não erro', () => {
    assert.equal(analiseCreditoSchema.parse([]), null);
  });

  test('null e undefined viram null', () => {
    assert.equal(analiseCreditoSchema.parse(null), null);
    assert.equal(analiseCreditoSchema.parse(undefined), null);
  });

  test('só a primeira linha é usada', () => {
    const analise = analiseCreditoSchema.parse([linha, { MAIOR_VALOR: 111 }]);
    assert.equal(analise?.maiorCompra, 900);
  });
});

describe('analiseCreditoSchema — datas e situação', () => {
  test('data brasileira do Orion vira ISO na borda', () => {
    const analise = analiseCreditoSchema.parse([{ PRIMEIRA_DATA: '05/03/2024' }]);
    assert.equal(analise?.primeiraCompra.data, '2024-03-05');
  });

  test('data ausente fica null', () => {
    assert.equal(analiseCreditoSchema.parse([{ ULTIMA_DATA: '  ' }])?.ultimaCompra.data, null);
  });

  test('CC_SITUACAO é exibida crua, sem mapa inventado', () => {
    // A análise do legado não registra a tabela de códigos → rótulos.
    assert.equal(analiseCreditoSchema.parse([{ CC_SITUACAO: 'B' }])?.situacaoCadastro, 'B');
  });

  test('nenhum nome de coluna do Firebird sobrevive à borda', () => {
    // A árvore inteira: `primeiraCompra` e `ultimaCompra` são aninhados.
    const analise = analiseCreditoSchema.parse([{ CC_SITUACAO: 'A', PRIMEIRA_DATA: '05/03/2024' }]);
    const arvore = JSON.stringify(analise);
    assert.doesNotMatch(arvore, /"[A-Z]{2,}_/, `vazou coluna do ERP: ${arvore}`);
  });
});

describe('historicoComprasSchema', () => {
  test('título quitado é reconhecido por S maiúsculo ou minúsculo', () => {
    const titulos = historicoComprasSchema.parse([
      { FINANCEIRO_BAIXADO: 'S' },
      { FINANCEIRO_BAIXADO: 's' },
      { FINANCEIRO_BAIXADO: ' S ' },
    ]);
    assert.deepEqual(
      titulos.map((titulo) => titulo.isBaixado),
      [true, true, true],
    );
  });

  test('título em aberto e campo ausente não são quitados', () => {
    const titulos = historicoComprasSchema.parse([{ FINANCEIRO_BAIXADO: 'N' }, {}]);
    assert.deepEqual(
      titulos.map((titulo) => titulo.isBaixado),
      [false, false],
    );
  });

  test('lista ausente vira lista vazia, não null', () => {
    // A tela itera direto no resultado.
    assert.deepEqual(historicoComprasSchema.parse(null), []);
    assert.deepEqual(historicoComprasSchema.parse(undefined), []);
  });

  test('emissão e valor com ponto decimal são traduzidos', () => {
    const titulos = historicoComprasSchema.parse([
      { FINANCEIRO_DATA_EMISSAO: '31/12/2026', FINANCEIRO_VALOR: '250.00' },
    ]);
    assert.equal(titulos[0]?.emissao, '2026-12-31');
    assert.equal(titulos[0]?.valor, 250);
  });

  test('valor com vírgula decimal é descartado em silêncio — dívida D11', () => {
    // Não é o comportamento desejado, é o comportamento atual: `'250,00'` não
    // converte, vira `null`, e o título aparece sem valor **sem relato** —
    // enquanto `liberacao.schema.ts` relata o caso simétrico. Qual separador o
    // Orion usa em FINANCEIRO_VALOR nunca foi visto com dado real (🔒 B1), e a
    // análise só registra que COMPRA_VALOR_TOTAL vem em centavos: formato
    // numérico ali não é uniforme e não se afirma sem verificar.
    assert.equal(historicoComprasSchema.parse([{ FINANCEIRO_VALOR: '250,00' }])[0]?.valor, null);
  });
});
