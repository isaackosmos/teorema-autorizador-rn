import { create as createAxios, type AxiosInstance } from 'axios';

import { env } from '@/shared/config/env';
import { ApiError, toApiError } from '@/shared/lib/http/errors';
import { getSession } from '@/shared/stores/session.store';

/** Toda resposta de erro vira `ApiError`, para ninguém tratar `AxiosError` cru. */
function withErrorNormalization(instance: AxiosInstance): AxiosInstance {
  instance.interceptors.response.use(
    (response) => response,
    (error: unknown) => Promise.reject(toApiError(error)),
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
