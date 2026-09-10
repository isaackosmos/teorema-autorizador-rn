import { VERSAO_MENSAGEM_WEB } from '@/features/web-systems/schemas/mensagem-web.schema';
import { normalizarBaseUrl } from '@/features/web-systems/lib/sistemas-web';
import { getSession } from '@/shared/stores/session.store';

import type { SistemaWeb } from '@/features/web-systems/lib/sistemas-web';

/**
 * O que o app manda para o HTML no handshake — a metade de saída do contrato
 * de `mensagem-web.schema.ts` (docs/decisao-webview-sessao §13.3).
 *
 * Nada disso vai para a URL: no original a sessão inteira viajava no fragmento,
 * onde fica no histórico e no cache da WebView (docs/analise §5.3, §7.1.9).
 */

/** Campos que **todo** web system recebe. */
interface SessaoWebBase {
  baseUrl: string;
  token: string;
  userId: string;
}

/** Os três que também recebem empresa e código de usuário. */
interface SessaoWebCompleta extends SessaoWebBase {
  companyId: string;
  codeCompany: string;
  userCode: string;
}

export type SessaoWeb = SessaoWebBase | SessaoWebCompleta;

/** Contexto de abertura do borderô, quando a tela veio de uma liberação. */
export interface ContextoWeb {
  sequencia: string;
  resposta: string;
}

export interface MensagemSessaoInit {
  v: typeof VERSAO_MENSAGEM_WEB;
  tipo: 'sessao:init';
  sessao: SessaoWeb;
  contexto?: ContextoWeb;
}

/**
 * `reqcompras` é o único que não recebe empresa nem código de usuário
 * (docs/plano-migracao, Bloco D). Mandar campo a mais é vazamento sem
 * contrapartida.
 */
const SISTEMAS_SEM_EMPRESA: readonly SistemaWeb[] = ['reqcompras'];

/**
 * Recorte da sessão que aquele sistema espera, lido **na hora de responder** —
 * não congelado na montagem da tela: a página pode pedir a sessão de novo
 * depois de uma recarga, e o que vale é a sessão de agora.
 *
 * `null` quando a sessão ainda não dá para montar o payload. Não existe meio
 * payload: sem token não há chamada autenticada que a página possa fazer.
 */
export function montarSessaoWeb(sistema: SistemaWeb): SessaoWeb | null {
  const { device, user, company } = getSession();
  if (!device.serverUrlActive || !user) return null;

  const base: SessaoWebBase = {
    baseUrl: normalizarBaseUrl(device.serverUrlActive),
    token: user.jwt,
    userId: String(user.id),
  };

  if (SISTEMAS_SEM_EMPRESA.includes(sistema)) return base;
  if (!company) return null;

  return {
    ...base,
    companyId: String(company.id),
    codeCompany: company.code,
    userCode: user.code,
  };
}

/** Payload completo do `sessao:init`. `contexto` só existe quando há borderô. */
export function montarSessaoInit(
  sistema: SistemaWeb,
  contexto: ContextoWeb | null,
): MensagemSessaoInit | null {
  const sessao = montarSessaoWeb(sistema);
  if (!sessao) return null;

  return {
    v: VERSAO_MENSAGEM_WEB,
    tipo: 'sessao:init',
    sessao,
    ...(contexto ? { contexto } : {}),
  };
}

/**
 * JavaScript injetado na página para entregar a sessão.
 *
 * O duplo `JSON.stringify` é obrigatório, não estilo: o de dentro monta o JSON,
 * o de fora o transforma em literal de string JavaScript. É ele que neutraliza
 * aspas e barras invertidas de `resposta`, que é texto livre digitado pelo
 * usuário. `U+2028`/`U+2029` escapam à parte porque `JSON.stringify` os deixa
 * passar crus. O `true;` final evita o erro de valor de retorno não
 * serializável no iOS.
 */
export function scriptSessaoInit(mensagem: MensagemSessaoInit): string {
  const literal = JSON.stringify(JSON.stringify(mensagem))
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  return `window.__teoremaInit(JSON.parse(${literal})); true;`;
}
