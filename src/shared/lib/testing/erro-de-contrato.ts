import assert from 'node:assert/strict';

import { ApiError, ContractError } from '@/shared/lib/http/errors';

/**
 * A negativa que a ficha F3 existe para provar: **nenhum `ZodError` escapa da
 * camada de API**.
 *
 * Mora no harness porque são três arquivos de teste afirmando exatamente o
 * mesmo sobre seis funções (CLAUDE.md §5.7), e porque a afirmação tem três
 * partes que só valem juntas: chegou como `ApiError` (a tela decide por
 * `status`, §4.1), está marcado como fora de contrato (o retry para, dívida
 * D12) e o status é 502 (a falha é do outro lado).
 */
export async function assertForaDeContrato(
  acao: () => Promise<unknown>,
  contexto: string,
): Promise<void> {
  await assert.rejects(acao(), (erro: unknown) => {
    assert.ok(erro instanceof ApiError, `${contexto}: ZodError cru escapou da camada de API`);
    assert.ok(erro instanceof ContractError, `${contexto}: não foi marcado como fora de contrato`);
    assert.equal(erro.status, 502, contexto);
    return true;
  });
}
