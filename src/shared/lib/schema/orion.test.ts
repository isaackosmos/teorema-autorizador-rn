import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { optionalText } from '@/shared/lib/schema/orion';

describe('optionalText — ausência tem uma forma só', () => {
  /**
   * Texto do Firebird chega preenchido com espaço. Se `''` e `null`
   * sobrevivessem como coisas diferentes, a tela precisaria checar as duas —
   * e uma delas viraria linha vazia (docs/analise §7.2.12).
   */
  const ausencias = [null, undefined, '', ' ', '\t', '\n  '];

  for (const valor of ausencias) {
    test(`${JSON.stringify(valor)} vira null`, () => {
      assert.equal(optionalText.parse(valor), null);
    });
  }

  test('texto com conteúdo é aparado nas pontas', () => {
    assert.equal(optionalText.parse('  ACME LTDA  '), 'ACME LTDA');
  });

  test('espaço interno é preservado', () => {
    assert.equal(optionalText.parse('ACME  LTDA'), 'ACME  LTDA');
  });

  test('zero em texto não é ausência', () => {
    assert.equal(optionalText.parse('0'), '0');
  });

  test('número é recusado — a peça é de texto', () => {
    assert.equal(optionalText.safeParse(0).success, false);
  });
});
