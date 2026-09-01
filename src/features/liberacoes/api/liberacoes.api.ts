import { liberacaoListSchema } from '@/features/liberacoes/schemas/liberacao.schema';
import { tenantApi } from '@/shared/lib/http/client';

const BASE = '/v1/remoteauthorization';

/**
 * Fila de liberações pendentes do usuário.
 * O filtro por tipo de solicitação e a alçada de desconto são aplicados no
 * servidor — o app não reimplementa nenhuma das duas regras.
 */
export async function listarPendentes(userCode: string) {
  const { data } = await tenantApi.get(`${BASE}/searchpending/${userCode}`);
  return liberacaoListSchema.parse(data);
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

export async function buscarAnaliseCredito(empresa: string, cliente: string) {
  const { data } = await tenantApi.get(`${BASE}/customerdataanalytics/${empresa}/${cliente}`);
  return data;
}

export async function buscarHistoricoCompras(empresa: string, cliente: string) {
  const { data } = await tenantApi.get(`${BASE}/customerpurchasehistory/${empresa}/${cliente}`);
  return data;
}
