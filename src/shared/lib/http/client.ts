import { create as createAxios, isAxiosError, type AxiosInstance } from 'axios';

import { env } from '@/shared/config/env';
import { SessionError, toApiError } from '@/shared/lib/http/errors';
import { withFailover } from '@/shared/lib/http/failover';
import { getSession } from '@/shared/stores/session.store';

/**
 * Marca a conectividade na sessão a partir do resultado real das requisições.
 * É o sinal que o indicador de offline do chrome lê. Depois da F1, `false`
 * significa que **nem o primário nem o secundário** responderam: o failover já
 * tentou o outro endereço antes de o erro chegar aqui.
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
      // `SessionError` lançado no interceptor de request (servidor ainda não
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
 *
 * Sem failover: o endereço é único e vem do `.env`, não há para onde trocar.
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
 *
 * A ordem dos dois embrulhos importa: o failover precisa ver o `AxiosError`
 * cru para saber que não houve resposta, então entra **antes** da normalização
 * que transforma tudo em `ApiError`. Invertido, ele receberia um `ApiError` e
 * nunca reconheceria a falha de rede.
 */
export const tenantApi = withErrorNormalization(
  withFailover(createAxios({ timeout: env.httpTimeoutMs })),
);

tenantApi.interceptors.request.use((config) => {
  const { device, user } = getSession();

  // O teste de conexão do onboarding (plano A3) passa a `baseURL` explícita:
  // é justamente ele que descobre qual endereço vai virar `serverUrlActive`.
  // Fora desse caso, quem manda é a sessão.
  //
  // O carimbo é `??=` porque o reenvio do failover passa por aqui de novo já
  // com `baseURL` preenchida. É defesa em profundidade, não necessidade: hoje
  // o `didFailover` barra a terceira passagem antes de alguém reler a marca.
  config.callerBaseURL ??= config.baseURL !== undefined;

  const baseURL = config.baseURL ?? device.serverUrlActive;

  if (!baseURL) {
    throw new SessionError('Servidor do cliente ainda não foi resolvido.');
  }

  config.baseURL = baseURL;

  if (user?.jwt) {
    config.headers.set('Authorization', `Bearer ${user.jwt}`);
  }
  if (device.tokenDatabase) {
    config.headers.set('tokendatabase', device.tokenDatabase);
  }

  return config;
});
