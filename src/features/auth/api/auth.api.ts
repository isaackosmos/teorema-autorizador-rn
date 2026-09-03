import {
  companyListSchema,
  empresaLicenciadaSchema,
  enderecosServidorSchema,
  loginResponseSchema,
} from '@/features/auth/schemas/auth.schema';
import { preparePassword } from '@/features/auth/lib/password';
import { env } from '@/shared/config/env';
import { centralApi, tenantApi } from '@/shared/lib/http/client';
import { ApiError } from '@/shared/lib/http/errors';

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

/**
 * Empresa licenciada para o documento, no servidor central.
 *
 * O Orion responde **200 com `{}`** quando não existe licença para o par
 * documento + `systemcode`, e o app Delphi decidia comparando o corpo com a
 * string `'{}'` (docs/analise §7.1.3, §7.1.8). Aqui a resposta sem os campos da
 * empresa vira `ApiError` 404 **na borda**: da tela para dentro a decisão é por
 * `status`, como no resto do app. Quando o servidor padronizar o erro (🔒 B4 do
 * plano de migração), só esta função muda.
 */
export async function buscarEmpresaLicenciada(documento: string) {
  const { data } = await centralApi.get('/v1/application/companyinformation', {
    params: { document: documento, systemcode: env.systemCode },
  });

  const empresa = empresaLicenciadaSchema.safeParse(data);
  if (!empresa.success) {
    throw new ApiError(
      404,
      'Documento ou licença não encontrado para o documento informado.',
      data,
    );
  }

  return empresa.data;
}

/** Endereços do tenant. Mesmo contrato de corpo vazio de `buscarEmpresaLicenciada`. */
export async function buscarEnderecosServidor(documento: string) {
  const { data } = await centralApi.get('/v1/application/getserverurl', {
    params: { document: documento },
  });

  const enderecos = enderecosServidorSchema.safeParse(data);
  if (!enderecos.success) {
    throw new ApiError(404, 'Nenhum servidor cadastrado para este documento.', data);
  }

  return enderecos.data;
}
