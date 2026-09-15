import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';

import { listarBases, registrarAparelho } from '@/features/auth/api/auth.api';
import { assertForaDeContrato } from '@/shared/lib/testing/erro-de-contrato';
import { instalarCentralFalso, instalarTenantFalso } from '@/shared/lib/testing/http-falso';
import { encerrarTeste } from '@/shared/lib/testing/render-hook';
import { comAparelhoAtivo } from '@/shared/lib/testing/sessao-de-teste';

import type { RegistroAparelhoRequest } from '@/features/auth/schemas/registro-aparelho.schema';

/**
 * Contrato das respostas do onboarding (ficha F3, dívida D12).
 *
 * O servidor falso é troca de adapter do axios: a resposta percorre a função de
 * `api/`, o interceptor e o `toApiError` de verdade, então o que o teste
 * observa é o erro que a tela receberia (CLAUDE.md §1).
 */

beforeEach(() => {
  // `listarBases` sai pelo tenant, e sem endereço resolvido o interceptor de
  // request recusa a chamada antes de sair — mediria a guarda, não o contrato.
  comAparelhoAtivo();
});

afterEach(encerrarTeste);

const DOCUMENTO = '11.222.333/0001-81';

const REGISTRO: RegistroAparelhoRequest = {
  documento: DOCUMENTO,
  companyCode: '1',
  companyId: 42,
  nomeAparelho: 'Aparelho de teste',
  apelido: 'Balcão',
  nomeUsuario: 'Fulano de Tal',
  contato: '(31) 99999-0000',
  serverUrlPrimary: 'https://tenant.teste',
  serverUrlSecondary: null,
  serverUrlPrint: null,
  userLogin: 'FULANO',
  userId: 7,
};

describe('listarBases — resposta fora do contrato', () => {
  test('erro em vez de lista vira ApiError, não ZodError', async () => {
    // O que o Orion responde quando o documento não tem base: um objeto onde o
    // app espera um array. Sem `safeParse` isso subia como ZodError, e a tela
    // exibia o dump JSON dos issues.
    instalarTenantFalso(() => ({ status: 200, corpo: { erro: 'documento sem base' } }));

    await assertForaDeContrato(() => listarBases(DOCUMENTO), 'listarBases');
  });

  test('lista válida continua traduzida para o domínio', async () => {
    instalarTenantFalso(() => ({
      status: 200,
      corpo: [{ DB_TOKEN: 'tok-base', CUSTOMER_NAME: '  Cliente Teste  ' }],
    }));

    assert.deepEqual(await listarBases(DOCUMENTO), [{ token: 'tok-base', nome: 'Cliente Teste' }]);
  });
});

describe('registrarAparelho — resposta fora do contrato', () => {
  test('corpo que não é nem registro nem motivo vira ApiError', async () => {
    instalarCentralFalso(() => ({ status: 200, corpo: { status: 'ok' } }));

    await assertForaDeContrato(() => registrarAparelho(REGISTRO), 'registrarAparelho');
  });

  test('registro criado continua atravessando a união', async () => {
    instalarCentralFalso(() => ({ status: 200, corpo: { id: '9', expiration: '' } }));

    const resultado = await registrarAparelho(REGISTRO);

    assert.equal(resultado.ok, true);
    assert.equal(resultado.ok && resultado.registerId, 9);
  });

  test('recusa de licença continua sendo resposta de negócio, não erro', async () => {
    // 200 com uma palavra em texto puro (docs/analise §3.1). Confundir isso com
    // desacordo de contrato esconderia o motivo real da recusa.
    instalarCentralFalso(() => ({ status: 200, corpo: 'licencas' }));

    const resultado = await registrarAparelho(REGISTRO);

    assert.equal(resultado.ok, false);
    assert.equal(!resultado.ok && resultado.motivo, 'licencas');
  });
});
