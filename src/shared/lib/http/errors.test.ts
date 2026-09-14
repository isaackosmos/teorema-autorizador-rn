import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { AxiosError, AxiosHeaders } from 'axios';

import { ApiError, toApiError } from '@/shared/lib/http/errors';

import type { AxiosResponse } from 'axios';

/** Erro do axios como o interceptor o recebe: com ou sem resposta. */
function axiosErro(status?: number, data?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const response =
    status === undefined
      ? undefined
      : ({ status, data, statusText: '', headers: {}, config } as AxiosResponse);

  return new AxiosError('falhou', undefined, config, {}, response);
}

describe('ApiError — a classificação é por status', () => {
  test('4xx é erro de cliente', () => {
    for (const status of [400, 401, 404, 499]) {
      assert.equal(new ApiError(status, 'x').isClientError, true, `status ${status}`);
    }
  });

  test('fora de 4xx não é erro de cliente', () => {
    for (const status of [0, 200, 399, 500, 503]) {
      assert.equal(new ApiError(status, 'x').isClientError, false, `status ${status}`);
    }
  });

  test('status 0 é ausência de resposta', () => {
    assert.equal(new ApiError(0, 'x').isNetworkError, true);
    assert.equal(new ApiError(500, 'x').isNetworkError, false);
  });

  test('é instância de Error e mantém name e message', () => {
    const erro = new ApiError(404, 'não achei');
    assert.ok(erro instanceof Error);
    assert.equal(erro.name, 'ApiError');
    assert.equal(erro.message, 'não achei');
  });

  test('o payload é preservado para quem precisar desempatar', () => {
    const payload = { erro: 'cadastro' };
    assert.deepEqual(new ApiError(401, 'x', payload).payload, payload);
    assert.equal(new ApiError(401, 'x').payload, undefined);
  });
});

describe('toApiError — tudo que é lançado vira ApiError', () => {
  test('ApiError passa direto, sem reembrulhar', () => {
    const original = new ApiError(404, 'não achei', { erro: 'x' });
    assert.equal(toApiError(original), original);
  });

  test('erro do axios com resposta preserva status e corpo', () => {
    const convertido = toApiError(axiosErro(422, { erro: 'campo inválido' }));
    assert.equal(convertido.status, 422);
    assert.deepEqual(convertido.payload, { erro: 'campo inválido' });
  });

  test('erro do axios sem resposta vira status 0', () => {
    // Offline, DNS, timeout: não há status HTTP para classificar.
    const convertido = toApiError(axiosErro());
    assert.equal(convertido.status, 0);
    assert.equal(convertido.isNetworkError, true);
    assert.match(convertido.message, /Verifique a conexão/);
  });

  test('Error comum vira status 0 com a mensagem original', () => {
    assert.equal(toApiError(new Error('boom')).status, 0);
    assert.equal(toApiError(new Error('boom')).message, 'boom');
  });

  test('o que não é Error vira status 0 com mensagem genérica', () => {
    for (const jogado of ['texto', 42, null, undefined, { a: 1 }]) {
      const convertido = toApiError(jogado);
      assert.equal(convertido.status, 0, `${JSON.stringify(jogado)}`);
      assert.equal(convertido.message, 'Erro inesperado.');
    }
  });
});

describe('toApiError — mensagem do corpo do Orion', () => {
  test('as quatro chaves são aceitas, na ordem de precedência', () => {
    assert.equal(toApiError(axiosErro(400, { erro: 'A' })).message, 'A');
    assert.equal(toApiError(axiosErro(400, { mensagem: 'B' })).message, 'B');
    assert.equal(toApiError(axiosErro(400, { message: 'C' })).message, 'C');
    assert.equal(toApiError(axiosErro(400, { error: 'D' })).message, 'D');
    assert.equal(toApiError(axiosErro(400, { erro: 'A', message: 'C' })).message, 'A');
  });

  test('corpo em texto puro é a própria mensagem', () => {
    assert.equal(toApiError(axiosErro(403, 'bloqueado')).message, 'bloqueado');
  });

  test('corpo vazio ou sem chave conhecida cai na mensagem por status', () => {
    for (const data of [undefined, null, '', '   ', {}, { outro: 'x' }, { erro: '  ' }, [1, 2]]) {
      const convertido = toApiError(axiosErro(503, data));
      assert.equal(convertido.message, 'Erro ao requisitar servidor (503).', JSON.stringify(data));
    }
  });

  test('valor não-texto na chave conhecida é ignorado', () => {
    assert.equal(
      toApiError(axiosErro(500, { erro: 42 })).message,
      'Erro ao requisitar servidor (500).',
    );
  });
});
