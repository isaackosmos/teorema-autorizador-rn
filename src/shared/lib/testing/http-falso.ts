import { AxiosError, AxiosHeaders } from 'axios';

import { centralApi, tenantApi } from '@/shared/lib/http/client';

import type { AxiosAdapter, AxiosInstance, AxiosResponse } from 'axios';

/**
 * Servidor falso por **troca do adapter do axios**, não por mock do módulo de
 * API.
 *
 * A diferença importa: assim a requisição percorre a função de `api/`, o
 * interceptor real e o `toApiError` — e o que chega ao hook é um `ApiError`
 * de verdade, com `status`. Mockar `liberacoes.api` testaria o mock, e o
 * aceite da ficha é justamente "erro tipado".
 */

export interface Requisicao {
  metodo: string;
  url: string;
  corpo?: unknown;
  /** Endereço que a requisição de fato usou — é o que prova o failover da F1. */
  baseURL?: string;
}

/** O que o adapter deve responder à próxima requisição. */
export type Resposta =
  | { status: number; corpo?: unknown }
  /** Sem resposta: offline, DNS, timeout. Vira `ApiError` com status 0. */
  | { rede: 'falhou' };

interface ServidorFalso {
  /** Tudo que saiu, em ordem — inclusive o que não deveria ter saído. */
  requisicoes: readonly Requisicao[];
}

/**
 * Quem instalou, para `encerrarTeste()` desinstalar **depois** de desmontar.
 *
 * O teste não restaura o adapter por conta própria de propósito: restaurar
 * antes do `cleanup()` faz a devolução do `useReservaLiberacao` sair pelo axios
 * de verdade, e a resolução de DNS de um host inexistente segura o processo do
 * runner de pé. Foi assim que a suíte passou nos 13 casos e travou no arquivo.
 */
const instalados: (() => void)[] = [];

/** Chamado por `encerrarTeste()`. Não chame do caso de teste. */
export function restaurarServidores(): void {
  for (const restaurar of instalados.splice(0)) restaurar();
}

function respostaAxios(config: Parameters<AxiosAdapter>[0], status: number, corpo: unknown) {
  return {
    data: corpo,
    status,
    statusText: '',
    headers: new AxiosHeaders(),
    config,
  } as AxiosResponse;
}

/**
 * Instala o adapter numa instância. `responder` recebe cada requisição e diz o
 * que devolver — uma função, e não uma fila, para o teste poder responder
 * conforme a rota (reserve passa, release falha, por exemplo).
 *
 * Pode devolver uma promessa: é assim que o teste **segura** uma resposta no ar
 * para verificar quem espera por ela. Sem isso, tudo resolve no mesmo tick e
 * um `await` faltando na implementação passaria despercebido.
 */
export function instalarServidorFalso(
  api: AxiosInstance,
  responder: (requisicao: Requisicao) => Resposta | Promise<Resposta>,
): ServidorFalso {
  const requisicoes: Requisicao[] = [];
  const original = api.defaults.adapter;

  api.defaults.adapter = async (config) => {
    const requisicao: Requisicao = {
      metodo: (config.method ?? 'get').toUpperCase(),
      url: config.url ?? '',
      corpo: config.data,
      baseURL: config.baseURL,
    };
    requisicoes.push(requisicao);

    const resposta = await responder(requisicao);

    if ('rede' in resposta) {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    }

    const axiosResposta = respostaAxios(config, resposta.status, resposta.corpo);
    if (resposta.status >= 400) {
      throw new AxiosError(
        `Request failed with status code ${resposta.status}`,
        AxiosError.ERR_BAD_RESPONSE,
        config,
        {},
        axiosResposta,
      );
    }

    return axiosResposta;
  };

  instalados.push(() => {
    api.defaults.adapter = original;
  });

  return { requisicoes };
}

type Responder = (requisicao: Requisicao) => Resposta | Promise<Resposta>;

/** Atalho para o servidor do cliente, que é quem a maioria dos hooks chama. */
export function instalarTenantFalso(responder: Responder) {
  return instalarServidorFalso(tenantApi, responder);
}

/** Atalho para o servidor central (licença, registro de aparelho, push). */
export function instalarCentralFalso(responder: Responder) {
  return instalarServidorFalso(centralApi, responder);
}

/** Responde 200 com corpo vazio a qualquer coisa. */
export const SEMPRE_OK = (): Resposta => ({ status: 200, corpo: {} });

/**
 * Uma resposta que só chega quando o teste mandar. Serve para provar quem
 * espera por ela — não é `setTimeout` disfarçado: nada é cronometrado, o teste
 * é quem resolve (CLAUDE.md §5.10).
 */
export function respostaSegurada(resposta: Resposta = { status: 200, corpo: {} }) {
  let liberar!: () => void;
  const promessa = new Promise<Resposta>((resolve) => {
    liberar = () => resolve(resposta);
  });

  return { promessa, liberar };
}

/**
 * Dá tempo de a requisição que **não deveria sair** ter saído.
 *
 * `waitFor` não serve para afirmar negativa: ele retorna na primeira avaliação
 * bem-sucedida, e uma condição que já é verdadeira passa sem esperar nada — o
 * teste vira no-op. Um `await Promise.resolve()` também não basta: uma chamada
 * do axios atravessa `Axios.request`, o interceptor e o adapter, o que leva
 * mais de um microtask.
 *
 * Não é a espera artificial que o §5.10 proíbe: aquela é do app, "para dar
 * tempo do skeleton aparecer". Esta é a única forma de observar a ausência de
 * um efeito assíncrono.
 */
export function deixarAssentar(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 20));
}
