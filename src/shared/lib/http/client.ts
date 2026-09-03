import { create as createAxios, isAxiosError, type AxiosInstance } from 'axios';

import { env } from '@/shared/config/env';
import { ApiError, toApiError } from '@/shared/lib/http/errors';
import { getSession } from '@/shared/stores/session.store';

/**
 * Marca a conectividade na sessão a partir do resultado real das requisições.
 * É o sinal que o indicador de offline do chrome lê. O teste explícito de
 * primário → secundário (plano F1) refina esta marcação depois, sem mudar
 * quem a consome.
 */
function marcarConexao(online: boolean): void {
  const session = getSession();
  if (session.online !== online) session.setOnline(online);
}

/** Toda resposta de erro vira `ApiError`, para ninguém tratar `AxiosError` cru. */
function withErrorNormalization(instance: AxiosInstance): AxiosInstance {
  instance.interceptors.response.use(
    (response) => {
      marcarConexao(true);
      return response;
    },
    (error: unknown) => {
      // Offline é *falta de resposta*: um 4xx/5xx prova que há conexão, e o
      // `ApiError` lançado no interceptor de request (servidor ainda não
      // resolvido) não é erro de rede. A distinção é por tipo, não por texto.
      if (isAxiosError(error) && !error.response) marcarConexao(false);
      return Promise.reject(toApiError(error));
    },
  );
  return instance;
}

/**
 * Servidor central da Teorema (`orion2`): licença, registro de aparelho e push.
 * Token fixo — é o mesmo em toda instalação, então não vale como segredo.
 */
export const centralApi = withErrorNormalization(
  createAxios({
    baseURL: env.centralApiUrl,
    timeout: env.httpTimeoutMs,
    headers: { Authorization: `Bearer ${env.centralApiToken}` },
  }),
);

/**
 * Servidor do cliente (tenant). A `baseURL` só existe depois que o `/v1/ping`
 * escolheu entre o endereço primário e o secundário, então é resolvida a cada
 * requisição a partir da sessão — nunca fixada na criação da instância.
 */
export const tenantApi = withErrorNormalization(createAxios({ timeout: env.httpTimeoutMs }));

tenantApi.interceptors.request.use((config) => {
  const { device, user } = getSession();

  if (!device.serverUrlActive) {
    throw new ApiError(0, 'Servidor do cliente ainda não foi resolvido.');
  }

  config.baseURL = device.serverUrlActive;

  if (user?.jwt) {
    config.headers.set('Authorization', `Bearer ${user.jwt}`);
  }
  if (device.tokenDatabase) {
    config.headers.set('tokendatabase', device.tokenDatabase);
  }

  return config;
});
