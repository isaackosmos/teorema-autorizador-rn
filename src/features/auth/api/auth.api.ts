import { companyListSchema, loginResponseSchema } from '@/features/auth/schemas/auth.schema';
import { preparePassword } from '@/features/auth/lib/password';
import { tenantApi } from '@/shared/lib/http/client';

import type { LoginPayload } from '@/features/auth/schemas/login.schema';

/**
 * Serviço de API: uma função por endpoint, sem estado e sem React.
 * Recebe/devolve tipos do domínio; a tradução do payload fica nos schemas.
 */

export async function login(payload: LoginPayload, registerId: number) {
  const { data } = await tenantApi.post('/v1/auth/login', {
    username: payload.username,
    password: preparePassword(payload.password),
    registerid: registerId,
  });

  return loginResponseSchema.parse(data);
}

/** Testa um endereço de servidor. Devolve `false` em vez de lançar. */
export async function ping(baseUrl: string): Promise<boolean> {
  try {
    await tenantApi.get('/v1/ping', { baseURL: baseUrl, timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

export async function listCompaniesFromUser(userCode: string) {
  const { data } = await tenantApi.get(`/v1/application/companyfromuser/${userCode}`);
  return companyListSchema.parse(data);
}
