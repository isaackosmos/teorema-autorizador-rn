import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { montarSessaoInit, scriptSessaoInit } from '@/features/web-systems/lib/sessao-web';
import { mesmaOrigem } from '@/features/web-systems/lib/sistemas-web';
import { parseMensagemWeb } from '@/features/web-systems/schemas/mensagem-web.schema';

import type { ContextoWeb } from '@/features/web-systems/lib/sessao-web';
import type { SistemaWeb } from '@/features/web-systems/lib/sistemas-web';
import type WebView from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';

/**
 * Quanto se espera pelo `sessao:solicitar` depois de a página carregar.
 *
 * Não é espera artificial das que o §5.10 proíbe — nada é adiado por causa
 * dela: é o prazo para descobrir que a página **não** implementa o handshake,
 * caso em que a tela precisa dizer isso em vez de ficar em branco para sempre.
 */
const ESPERA_HANDSHAKE_MS = 5000;

interface HandshakeWebOptions {
  sistema: SistemaWeb;
  /** Origem do tenant, já normalizada por `origemDe`. */
  origem: string;
  /**
   * Lido a cada handshake, e não recebido pronto: o contexto é consumido uma
   * vez na montagem da rota (CLAUDE.md §4.11) e precisa sobreviver a uma
   * recarga da página, que refaz o handshake.
   */
  obterContexto: () => ContextoWeb | null;
  onRetorno: (retorno: unknown) => void;
  onFechar: () => void;
}

/**
 * O lado do app no handshake da decisão B6 (docs/decisao-webview-sessao §13).
 *
 * A página anuncia que está pronta (`sessao:solicitar`) e o app responde com
 * **um** payload injetado — sessão e contexto juntos, nada na URL. Quem começa
 * é a página, e é isso que elimina a corrida do
 * `injectedJavaScriptBeforeContentLoaded` no Android (§3.1).
 *
 * Efeito colateral bem-vindo: recarregar a página refaz a sessão sozinho, o
 * que aposenta o `_t=<unix>` que o original grudava na URL (docs/analise §5.3).
 */
export function useHandshakeWeb({
  sistema,
  origem,
  obterContexto,
  onRetorno,
  onFechar,
}: HandshakeWebOptions) {
  const webViewRef = useRef<WebView>(null);
  const urlAtual = useRef(origem);
  const espera = useEsperaHandshake();

  const responder = useCallback(() => {
    // Fora da origem do tenant não se responde: seria injetar a sessão do
    // usuário em página estranha (docs/decisao-webview-sessao §9).
    if (!mesmaOrigem(urlAtual.current, origem)) return;

    const mensagem = montarSessaoInit(sistema, obterContexto());
    if (!mensagem) return;

    webViewRef.current?.injectJavaScript(scriptSessaoInit(mensagem));
  }, [obterContexto, origem, sistema]);

  const aoReceberMensagem = useCallback(
    (event: WebViewMessageEvent) => {
      const mensagem = parseMensagemWeb(event.nativeEvent.data);
      if (!mensagem) return; // entrada não confiável: descarta em silêncio (§4.8)

      switch (mensagem.tipo) {
        case 'sessao:solicitar':
          espera.concluir();
          responder();
          return;
        case 'bordero:retorno':
          onRetorno(mensagem.retorno);
          return;
        case 'navegacao:fechar':
          onFechar();
          return;
      }
    },
    [espera, onFechar, onRetorno, responder],
  );

  const recarregar = useCallback(() => {
    espera.limpar();
    webViewRef.current?.reload();
  }, [espera]);

  /**
   * Trava a navegação na origem do tenant. Sem isso, um link para fora leva a
   * WebView junto — e o `onMessage` continuaria valendo para a página nova.
   *
   * O parâmetro é tipado pela forma, não pelo tipo da biblioteca: só a URL
   * interessa, e assim o arquivo não depende do arranjo interno de tipos do
   * `react-native-webview`.
   */
  const permitirNavegacao = useCallback(
    (requisicao: { url: string }) => mesmaOrigem(requisicao.url, origem),
    [origem],
  );

  const aoNavegar = useCallback((estado: { url: string }) => {
    urlAtual.current = estado.url;
  }, []);

  return {
    webViewRef,
    /** A página carregou e não pediu a sessão: ou não implementa o contrato, ou quebrou. */
    semHandshake: espera.expirou,
    aoReceberMensagem,
    aoTerminarCarga: espera.armar,
    aoNavegar,
    permitirNavegacao,
    recarregar,
  };
}

/**
 * O prazo entre a página carregar e pedir a sessão.
 *
 * Fica em um hook próprio porque é a única parte com ciclo de vida: o resto do
 * handshake é reação a mensagem. `armar` a cada carga, `concluir` quando a
 * página pediu, `limpar` antes de recarregar.
 */
function useEsperaHandshake() {
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expirou, setExpirou] = useState(false);

  const cancelar = useCallback(() => {
    if (espera.current) clearTimeout(espera.current);
    espera.current = null;
  }, []);

  useEffect(() => cancelar, [cancelar]);

  const armar = useCallback(() => {
    cancelar();
    espera.current = setTimeout(() => setExpirou(true), ESPERA_HANDSHAKE_MS);
  }, [cancelar]);

  const concluir = useCallback(() => {
    cancelar();
    setExpirou(false);
  }, [cancelar]);

  const limpar = useCallback(() => setExpirou(false), []);

  // Objeto memoizado: ele entra nas dependências dos callbacks de quem chama,
  // e recriá-lo a cada render trocaria o `onMessage` da WebView à toa.
  return useMemo(() => ({ expirou, armar, concluir, limpar }), [expirou, armar, concluir, limpar]);
}
