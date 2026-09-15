import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { queryClient } from '@/shared/config/query-client';
import { ApiError, ContractError } from '@/shared/lib/http/errors';

/**
 * A política de retry lida como o TanStack Query a lê: a função que está na
 * configuração, e não uma cópia do predicado escrita aqui — copiar a regra para
 * o teste provaria a cópia.
 */
function deveRepetir(erro: Error, falhasAnteriores = 0): boolean {
  const politica = queryClient.getDefaultOptions().queries?.retry;
  if (typeof politica !== 'function') {
    assert.fail('a política de retry deixou de ser uma função');
  }

  return politica(falhasAnteriores, erro);
}

describe('queryClient — o que não adianta repetir', () => {
  /**
   * O ponto da dívida D12: payload malformado é determinístico, e sem esta
   * regra cada consulta com contrato quebrado ia três vezes ao servidor para
   * receber exatamente o mesmo corpo.
   */
  test('resposta fora do contrato não se repete', () => {
    const erro = new ContractError('Resposta inesperada do servidor na fila de liberações.');

    assert.equal(deveRepetir(erro), false);
    assert.equal(deveRepetir(erro, 1), false);
  });

  test('erro de negócio (4xx) não se repete', () => {
    for (const status of [400, 401, 404]) {
      assert.equal(deveRepetir(new ApiError(status, 'x')), false, `status ${status}`);
    }
  });

  test('falha do servidor e falta de rede se repetem, até o limite', () => {
    // 5xx e status 0 podem ser transitórios — é o caso em que insistir paga.
    for (const erro of [new ApiError(500, 'x'), new ApiError(0, 'x'), new Error('x')]) {
      assert.equal(deveRepetir(erro, 0), true, erro.message);
      assert.equal(deveRepetir(erro, 1), true, erro.message);
      assert.equal(deveRepetir(erro, 2), false, erro.message);
    }
  });
});
