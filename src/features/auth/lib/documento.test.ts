import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  formatarDocumento,
  isDocumentoValido,
  somenteDigitos,
} from '@/features/auth/lib/documento';
import { documentoSchema } from '@/features/auth/schemas/documento.schema';

/**
 * O original não conferia dígito verificador nenhum: qualquer texto seguia
 * para o servidor central (docs/plano-migracao A2). Estes casos são a regra
 * que substituiu isso.
 */
const CNPJ_VALIDO = '11222333000181';
const CPF_VALIDO = '52998224725';

describe('somenteDigitos', () => {
  test('remove máscara, espaço e letra', () => {
    assert.equal(somenteDigitos('11.222.333/0001-81'), CNPJ_VALIDO);
    assert.equal(somenteDigitos(' 529.982.247-25 '), CPF_VALIDO);
    assert.equal(somenteDigitos('abc'), '');
  });
});

describe('isDocumentoValido', () => {
  test('aceita CNPJ e CPF válidos, com ou sem máscara', () => {
    assert.ok(isDocumentoValido(CNPJ_VALIDO));
    assert.ok(isDocumentoValido('11.222.333/0001-81'));
    assert.ok(isDocumentoValido(CPF_VALIDO));
    assert.ok(isDocumentoValido('529.982.247-25'));
  });

  test('recusa dígito verificador errado', () => {
    assert.equal(isDocumentoValido('11222333000182'), false);
    assert.equal(isDocumentoValido('52998224726'), false);
  });

  test('recusa documento com todos os dígitos iguais', () => {
    // Passam na conta do módulo 11, mas não são documento.
    assert.equal(isDocumentoValido('11111111111'), false);
    assert.equal(isDocumentoValido('00000000000000'), false);
  });

  test('recusa comprimento fora de 11 e 14', () => {
    assert.equal(isDocumentoValido(''), false);
    assert.equal(isDocumentoValido('1122233300018'), false);
    assert.equal(isDocumentoValido('112223330001811'), false);
  });

  test('recusa texto sem dígito', () => {
    assert.equal(isDocumentoValido('nao sou documento'), false);
  });
});

describe('formatarDocumento', () => {
  test('aplica a máscara que o Orion compara', () => {
    // O documento vai ao servidor **com** máscara: é a forma gravada em
    // CLIFOR_DOCUMENTO (docs/analise §5.1).
    assert.equal(formatarDocumento(CNPJ_VALIDO), '11.222.333/0001-81');
    assert.equal(formatarDocumento(CPF_VALIDO), '529.982.247-25');
  });

  test('entrada já mascarada não é mascarada duas vezes', () => {
    assert.equal(formatarDocumento('11.222.333/0001-81'), '11.222.333/0001-81');
  });

  test('comprimento inesperado devolve só os dígitos', () => {
    assert.equal(formatarDocumento('123'), '123');
  });
});

describe('documentoSchema — a regra mora no schema, não no evento de tecla', () => {
  test('entrada crua sai mascarada', () => {
    assert.equal(documentoSchema.parse({ documento: CNPJ_VALIDO }).documento, '11.222.333/0001-81');
  });

  test('espaço em volta é aparado antes de validar', () => {
    assert.equal(
      documentoSchema.parse({ documento: `  ${CPF_VALIDO}  ` }).documento,
      '529.982.247-25',
    );
  });

  test('campo vazio pede o documento', () => {
    const erro = documentoSchema.safeParse({ documento: '   ' });
    assert.equal(erro.success, false);
    assert.equal(erro.error?.issues[0]?.message, 'Informe o CNPJ ou CPF da empresa');
  });

  test('documento inválido tem a mensagem do refine', () => {
    const erro = documentoSchema.safeParse({ documento: '11222333000182' });
    assert.equal(erro.success, false);
    assert.equal(erro.error?.issues[0]?.message, 'CNPJ ou CPF inválido');
  });
});
