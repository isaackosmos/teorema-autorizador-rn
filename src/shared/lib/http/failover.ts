import { isAxiosError } from 'axios';

import { getSession } from '@/shared/stores/session.store';

import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import type { Device } from '@/shared/types/session.types';

/**
 * Fallback primário → secundário em runtime (plano de migração F1).
 *
 * O onboarding (A3) elege `serverUrlActive` uma vez e nunca mais; se esse
 * endereço cai com o app aberto, toda chamada ao tenant passa a falhar e o
 * secundário fica parado na sessão. Aqui a requisição que não obteve resposta
 * é reenviada **uma vez** contra o outro endereço, e o que responder vira o
 * ativo — as requisições seguintes já nascem nele.
 *
 * Mora em `shared/lib/http/` de propósito: nenhuma tela e nenhuma feature
 * repetem o teste de conexão, que é o que a ficha pede. É também o que impede
 * de reusar o `ping()` de `features/auth` — `shared/` não importa de
 * `features/` (CLAUDE.md §2). Reenviar a própria requisição resolve os dois
 * problemas de uma vez e ainda gasta menos ida ao servidor que um probe
 * seguido do reenvio.
 */

/**
 * Os dois campos são **internos de `shared/lib/http/`**: a augmentation é
 * global (entra no tipo de toda chamada, `centralApi` inclusive) porque a
 * alternativa seria `as` sobre o config, que o §5.12 recusa. Feature nenhuma
 * deve passá-los — quem o fizer desliga o failover sem violar camada alguma.
 */
declare module 'axios' {
  interface AxiosRequestConfig {
    /**
     * A `baseURL` veio do chamador, não da sessão. É o teste de conexão do
     * onboarding, que existe justamente para descobrir o endereço: fazer
     * failover dentro dele seria circular.
     */
    callerBaseURL?: boolean;
    /** Esta requisição já gastou a tentativa contra o endereço alternativo. */
    didFailover?: boolean;
  }
}

/**
 * O endereço configurado que **não** é o que esta requisição acabou de usar.
 *
 * A comparação é contra o endereço usado, e não contra o `serverUrlActive`
 * corrente, para que requisições que falharam juntas não se atrapalhem: depois
 * que a primeira elege o alternativo, a segunda ainda calcula corretamente o
 * seu — o que dispensa promessa compartilhada e estado de módulo aqui.
 */
export function alternativoPara(usado: string, device: Device): string | null {
  const configurados = [device.serverUrlPrimary, device.serverUrlSecondary];
  return configurados.find((url): url is string => url !== null && url !== usado) ?? null;
}

/**
 * Liga o failover à instância do tenant.
 *
 * Sem espera artificial entre as tentativas (CLAUDE.md §5.10) e sem poller de
 * reconexão: a retomada acontece na próxima requisição, que é o gatilho
 * natural. Quando os dois endereços falham, o erro sobe como sempre subiu e o
 * `OfflineBanner` aparece — só que agora "offline" significa mesmo que nenhum
 * dos dois respondeu, como o comentário de `session.store.ts` já prometia.
 */
/** Config e endereço de uma tentativa que vale a pena — o config vem junto para dispensar cast. */
interface Reenvio {
  config: AxiosRequestConfig;
  alternativo: string;
}

/** Método cujo reenvio não cria fato novo do outro lado. */
function ehIdempotente(metodo: string | undefined): boolean {
  const verbo = (metodo ?? 'get').toLowerCase();
  return verbo === 'get' || verbo === 'head';
}

/**
 * O endereço para onde reenviar, ou `null` quando não se deve reenviar nada.
 *
 * Reúne as cinco recusas num lugar só — cada uma por um motivo diferente:
 *
 * - **houve resposta**: um 4xx/5xx prova que o endereço está vivo, e trocar de
 *   servidor por erro de negócio mandaria a mesma recusa para o outro lado. (O
 *   `SessionError` do interceptor de request cai aqui também, por não ser
 *   `AxiosError`: sem endereço nenhum não há o que trocar.)
 * - **`callerBaseURL`**: é o teste de conexão do onboarding, que existe para
 *   descobrir qual endereço responde — trocar por baixo dele tornaria a
 *   resposta dele uma mentira.
 * - **`didFailover`**: a tentativa já foi gasta. É esta marca que impede o
 *   vai-e-volta infinito entre primário e secundário.
 * - **não idempotente**: "sem resposta" inclui **timeout**, e aí o Orion pode
 *   já ter gravado. Como o primário e o secundário são dois endereços do
 *   **mesmo** tenant (docs/analise §3.1, `BuscaEnderecos`), reenviar um
 *   `/remoteauthorization/authorize` autorizaria a mesma liberação duas vezes.
 *   Decisão é dinheiro, e o repositório trata assim em todo lugar — até o
 *   `probe-orion` se recusa a disparar decisão por engano (§1). Quem reelege o
 *   endereço, então, é a próxima leitura: a fila é refeita o tempo todo, e o
 *   custo é o usuário repetir o toque se decidiu no instante exato da queda.
 * - **sem alternativo**: só um endereço configurado, ou os dois iguais.
 */
function destinoDoReenvio(error: unknown): Reenvio | null {
  if (!isAxiosError(error) || error.response) return null;

  const { config } = error;
  if (!config || config.callerBaseURL || config.didFailover) return null;
  if (!ehIdempotente(config.method) || !config.baseURL) return null;

  const alternativo = alternativoPara(config.baseURL, getSession().device);
  return alternativo === null ? null : { config, alternativo };
}

export function withFailover(instance: AxiosInstance): AxiosInstance {
  instance.interceptors.response.use(undefined, async (error: unknown) => {
    const reenvio = destinoDoReenvio(error);
    if (!reenvio) throw error;

    const { config, alternativo } = reenvio;

    config.didFailover = true;
    config.baseURL = alternativo;

    const resposta = await instance.request(config);

    // Só grava depois de a resposta chegar: endereço que respondeu é endereço
    // que serve. Gravar antes deixaria a sessão apontando para um segundo
    // endereço morto.
    getSession().setDevice({ serverUrlActive: alternativo });

    return resposta;
  });

  return instance;
}
