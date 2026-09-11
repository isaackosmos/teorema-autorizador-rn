import { somenteDigitos } from '@/features/auth/lib/documento';
import { preparePassword } from '@/features/auth/lib/password';
import {
  baseDadosListSchema,
  empresaLicenciadaSchema,
  enderecosServidorSchema,
  loginResponseSchema,
  registroResultadoSchema,
} from '@/features/auth/schemas/auth.schema';
import { registroAparelhoRequestSchema } from '@/features/auth/schemas/registro-aparelho.schema';
import { env } from '@/shared/config/env';
import { centralApi, tenantApi } from '@/shared/lib/http/client';
import { ApiError } from '@/shared/lib/http/errors';

import type { LoginPayload } from '@/features/auth/schemas/login.schema';
import type { RegistroAparelhoRequest } from '@/features/auth/schemas/registro-aparelho.schema';

/**
 * Serviço de API: uma função por endpoint, sem estado e sem React.
 * Recebe/devolve tipos do domínio; a tradução do payload fica nos schemas.
 */

export async function login(payload: LoginPayload, registerId: number | null) {
  const { data } = await tenantApi.post('/v1/auth/login', {
    username: payload.username,
    password: preparePassword(payload.password),
    // No primeiro login o aparelho ainda não tem registro: o original omitia
    // o campo nesse caso (docs/analise §3.1) e o servidor conta com isso —
    // mandar `null` derruba o login que precede o registro.
    ...(registerId === null ? {} : { registerid: registerId }),
  });

  // Normalizado na borda, como em `buscarEmpresaLicenciada`: o `parse` roda
  // **depois** do interceptor de resposta, então um payload fora do contrato
  // subiria como `ZodError` cru e furaria o `ApiError` que a mutation promete.
  // Os campos deste schema nunca foram vistos num payload real (🔒 B1), e é
  // exatamente aí que a divergência vai aparecer.
  const usuario = loginResponseSchema.safeParse(data);
  if (!usuario.success) {
    throw new ApiError(502, 'Resposta inesperada do servidor no login.', data);
  }

  return usuario.data;
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

/**
 * Bases que o tenant expõe para o documento (aba "Bancos" do original).
 *
 * Vai só com os dígitos: o servidor aplica a máscara antes de comparar
 * (`TMyClaims.Setup`), e é assim que o app Delphi chamava.
 */
export async function listarBases(documento: string) {
  const { data } = await tenantApi.get(`/v1/auth/setup/${somenteDigitos(documento)}`);
  return baseDadosListSchema.parse(data);
}

/**
 * Registra o aparelho no servidor central e consome uma licença.
 *
 * `userlogin` e `userid` são exigidos pelo servidor (`Validate('CreateRegister')`),
 * e é por isso que o registro **acontece depois do login** — como no original,
 * onde a aba de identificação só aparecia com o usuário autenticado.
 */
export async function registrarAparelho(input: RegistroAparelhoRequest) {
  const { data } = await centralApi.post('/v1/application/register', {
    ...registroAparelhoRequestSchema.parse(input),
    systemcode: env.systemCode,
  });

  return registroResultadoSchema.parse(data);
}
