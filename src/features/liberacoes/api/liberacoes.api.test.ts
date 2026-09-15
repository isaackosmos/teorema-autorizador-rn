import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';

import {
  buscarAnaliseCredito,
  buscarHistoricoCompras,
  listarPendentes,
} from '@/features/liberacoes/api/liberacoes.api';
import { assertForaDeContrato } from '@/shared/lib/testing/erro-de-contrato';
import { instalarTenantFalso } from '@/shared/lib/testing/http-falso';
import { encerrarTeste } from '@/shared/lib/testing/render-hook';
import { comUsuarioLogado } from '@/shared/lib/testing/sessao-de-teste';

beforeEach(() => {
  comUsuarioLogado();
});

afterEach(encerrarTeste);

const USER_CODE = '005';
const EMPRESA = '1';
const CLIENTE = '00042';

/** Linha da fila com o mínimo que o schema exige. */
function linha(sequencia: string) {
  return { LIBERACAO_SEQUENCIA: sequencia, LIBERACAO_LIBERADA: '0' };
}

describe('listarPendentes — resposta fora do contrato', () => {
  test('erro em vez de fila vira ApiError, não ZodError', async () => {
    instalarTenantFalso(() => ({ status: 200, corpo: { erro: 'usuário sem permissão' } }));

    await assertForaDeContrato(() => listarPendentes(USER_CODE), 'listarPendentes');
  });

  test('a fila válida continua sem a sequência 0', async () => {
    // O filtro roda **depois** da validação, e é o que mantém fora da tela a
    // linha que o app Delphi listava sem poder decidir (docs/analise §3.3).
    instalarTenantFalso(() => ({ status: 200, corpo: [linha('0'), linha('7')] }));

    const fila = await listarPendentes(USER_CODE);

    assert.deepEqual(
      fila.map((liberacao) => liberacao.id),
      ['7'],
    );
  });
});

describe('dados do cliente — resposta fora do contrato', () => {
  test('análise de crédito em texto vira ApiError, não ZodError', async () => {
    instalarTenantFalso(() => ({ status: 200, corpo: 'sem análise para o cliente' }));

    await assertForaDeContrato(
      () => buscarAnaliseCredito(EMPRESA, CLIENTE),
      'buscarAnaliseCredito',
    );
  });

  test('cliente sem análise continua sendo ausência, não erro', async () => {
    // Lista vazia é resposta legítima: o cliente existe e não tem análise.
    instalarTenantFalso(() => ({ status: 200, corpo: [] }));

    assert.equal(await buscarAnaliseCredito(EMPRESA, CLIENTE), null);
  });

  test('histórico de compras fora de lista vira ApiError, não ZodError', async () => {
    instalarTenantFalso(() => ({ status: 200, corpo: { erro: 'cliente inexistente' } }));

    await assertForaDeContrato(
      () => buscarHistoricoCompras(EMPRESA, CLIENTE),
      'buscarHistoricoCompras',
    );
  });

  test('histórico ausente continua virando lista vazia', async () => {
    instalarTenantFalso(() => ({ status: 200, corpo: null }));

    assert.deepEqual(await buscarHistoricoCompras(EMPRESA, CLIENTE), []);
  });
});
