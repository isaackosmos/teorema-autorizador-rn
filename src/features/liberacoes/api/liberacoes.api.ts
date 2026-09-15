import {
  analiseCreditoSchema,
  historicoComprasSchema,
} from '@/features/liberacoes/schemas/cliente.schema';
import { liberacaoListSchema } from '@/features/liberacoes/schemas/liberacao.schema';
import { tenantApi } from '@/shared/lib/http/client';
import { ContractError } from '@/shared/lib/http/errors';

const BASE = '/v1/remoteauthorization';

/** Sequência 0 não corresponde a nenhuma liberação real. */
const ID_INVALIDO = '0';

/**
 * Fila de liberações pendentes do usuário.
 * O filtro por tipo de solicitação e a alçada de desconto são aplicados no
 * servidor — o app não reimplementa nenhuma das duas regras.
 */
export async function listarPendentes(userCode: string) {
  const { data } = await tenantApi.get(`${BASE}/searchpending/${userCode}`);

  const fila = liberacaoListSchema.safeParse(data);
  if (!fila.success) {
    throw new ContractError('Resposta inesperada do servidor na fila de liberações.', data);
  }

  // `LIBERACAO_SEQUENCIA = 0` é linha inválida: não dá para reservar nem decidir.
  // O app Delphi a listava e só reclamava no toque ("Identificador de liberação
  // inválido", docs/analise §3.3) — aqui ela não chega à tela.
  return fila.data.filter((liberacao) => liberacao.id !== ID_INVALIDO);
}

/** Marca a liberação como "em análise" para este usuário. */
export async function reservar(id: string, userCode: string): Promise<void> {
  await tenantApi.get(`${BASE}/reserve/${id}/${userCode}`);
}

/** Devolve a liberação para a fila ao sair sem decidir. */
export async function devolver(id: string, userCode: string): Promise<void> {
  await tenantApi.get(`${BASE}/release/${id}/${userCode}`);
}

export async function autorizar(id: string, resposta: string): Promise<void> {
  await tenantApi.post(`${BASE}/authorize/${id}`, resposta);
}

export async function reprovar(id: string, resposta: string): Promise<void> {
  await tenantApi.post(`${BASE}/reject/${id}`, resposta);
}

/** Análise de crédito do cliente da liberação. `null` quando não há linha. */
export async function buscarAnaliseCredito(empresa: string, cliente: string) {
  const { data } = await tenantApi.get(`${BASE}/customerdataanalytics/${empresa}/${cliente}`);

  const analise = analiseCreditoSchema.safeParse(data);
  if (!analise.success) {
    throw new ContractError('Resposta inesperada do servidor na análise de crédito.', data);
  }

  return analise.data;
}

/** Títulos financeiros do cliente. */
export async function buscarHistoricoCompras(empresa: string, cliente: string) {
  const { data } = await tenantApi.get(`${BASE}/customerpurchasehistory/${empresa}/${cliente}`);

  const historico = historicoComprasSchema.safeParse(data);
  if (!historico.success) {
    throw new ContractError('Resposta inesperada do servidor no histórico de compras.', data);
  }

  return historico.data;
}
