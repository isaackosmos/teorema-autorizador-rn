import { z } from 'zod';

/**
 * Contrato da ponte entre o app e o HTML dos web systems
 * (docs/decisao-webview-sessao §13.3) — a decisão B6, opção A′.
 *
 * Uma ponte só, nos dois sentidos: `postMessage` do HTML para cá,
 * `injectJavaScript` daqui para lá. O original tinha dois protocolos para a
 * mesma coisa (`app://menu` e `delphi://<json>` concatenado, docs/analise
 * §5.3) e lia a sessão do fragmento da URL.
 *
 * Este arquivo cobre o **que chega** — entrada não confiável, igual à rede e ao
 * disco (CLAUDE.md §4.8). O que sai é montado em `lib/sessao-web.ts`.
 */

/**
 * Versão do contrato. Mensagem com outro `v` é descartada em silêncio pelas
 * duas pontas: é o que permite subir uma v2 sem quebrar app já instalado.
 */
export const VERSAO_MENSAGEM_WEB = 1;

const envelope = { v: z.literal(VERSAO_MENSAGEM_WEB) };

export const mensagemWebSchema = z.discriminatedUnion('tipo', [
  /** A página está pronta e pede a sessão. Sem carga: quem sabe o que mandar é o app. */
  z.object({ ...envelope, tipo: z.literal('sessao:solicitar') }),
  /**
   * Resultado do borderô. Publica **e** fecha: mensagem única elimina a corrida
   * entre publicar o retorno e desmontar a rota.
   *
   * `retorno` fica como `unknown` de propósito — quem sabe validá-lo é o
   * `borderoRetornoSchema`, que é da feature `liberacoes`, e feature não
   * importa feature (CLAUDE.md §2). Quem faz a ponte é a rota (§4.12).
   */
  z.object({ ...envelope, tipo: z.literal('bordero:retorno'), retorno: z.unknown() }),
  /** Fecha a tela sem resultado. Substitui `app://menu` e `delphi://`. */
  z.object({ ...envelope, tipo: z.literal('navegacao:fechar') }),
]);

export type MensagemWeb = z.output<typeof mensagemWebSchema>;

/**
 * Texto cru da ponte → mensagem tipada, ou `null`.
 *
 * `null` para qualquer coisa fora do contrato — JSON inválido, versão
 * diferente, tipo desconhecido — e quem chama descarta em silêncio.
 */
export function parseMensagemWeb(data: string): MensagemWeb | null {
  try {
    const mensagem = mensagemWebSchema.safeParse(JSON.parse(data));
    return mensagem.success ? mensagem.data : null;
  } catch {
    return null;
  }
}
