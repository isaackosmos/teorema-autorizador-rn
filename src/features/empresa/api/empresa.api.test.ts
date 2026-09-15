import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';

import { listarEmpresasDoUsuario } from '@/features/empresa/api/empresa.api';
import { assertForaDeContrato } from '@/shared/lib/testing/erro-de-contrato';
import { instalarTenantFalso } from '@/shared/lib/testing/http-falso';
import { encerrarTeste } from '@/shared/lib/testing/render-hook';
import { comUsuarioLogado } from '@/shared/lib/testing/sessao-de-teste';

beforeEach(() => {
  comUsuarioLogado();
});

afterEach(encerrarTeste);

const USER_CODE = '005';

describe('listarEmpresasDoUsuario — resposta fora do contrato', () => {
  test('erro em vez de lista vira ApiError, não ZodError', async () => {
    instalarTenantFalso(() => ({ status: 200, corpo: { erro: 'usuário sem empresa' } }));

    await assertForaDeContrato(() => listarEmpresasDoUsuario(USER_CODE), 'listarEmpresasDoUsuario');
  });

  test('empresa sem código também é contrato quebrado', async () => {
    // `COMPANY_CODE` é o que a sessão guarda e o que as telas do app usam para
    // falar de empresa: sem ele a linha não vira `Company`.
    instalarTenantFalso(() => ({
      status: 200,
      corpo: [{ COMPANY_ID: 42, COMPANY_NAME: 'Teorema' }],
    }));

    await assertForaDeContrato(() => listarEmpresasDoUsuario(USER_CODE), 'empresa sem código');
  });

  test('lista válida continua traduzida para o domínio', async () => {
    instalarTenantFalso(() => ({
      status: 200,
      corpo: [{ COMPANY_ID: '42', COMPANY_CODE: '1', COMPANY_NAME: '  Teorema  ' }],
    }));

    assert.deepEqual(await listarEmpresasDoUsuario(USER_CODE), [
      { id: 42, code: '1', name: 'Teorema' },
    ]);
  });
});
