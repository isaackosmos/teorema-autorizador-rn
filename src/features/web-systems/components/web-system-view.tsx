import { useState } from 'react';
import { Text, View } from 'react-native';
import WebView from 'react-native-webview';

import { useHandshakeWeb } from '@/features/web-systems/hooks/use-handshake-web';
import { origemDe, urlDoSistema } from '@/features/web-systems/lib/sistemas-web';
import { Button } from '@/shared/components/ui/button';
import { useSessionStore } from '@/shared/stores/session.store';

import type { ContextoWeb } from '@/features/web-systems/lib/sessao-web';
import type { SistemaWeb } from '@/features/web-systems/lib/sistemas-web';

interface WebSystemViewProps {
  sistema: SistemaWeb;
  obterContexto: () => ContextoWeb | null;
  /** Payload cru do borderô — quem valida é a rota, dona das duas features. */
  onRetorno: (retorno: unknown) => void;
  onFechar: () => void;
}

/**
 * A WebView de um web system, com o handshake de sessão da decisão B6.
 *
 * A sessão **não** vai na URL: a página pede (`sessao:solicitar`) e o app
 * responde por injeção (docs/decisao-webview-sessao §13). Na URL fica só o
 * caminho do HTML — sem fragmento, sem query, sem `_t=<unix>`.
 */
export function WebSystemView({ sistema, obterContexto, onRetorno, onFechar }: WebSystemViewProps) {
  const baseUrl = useSessionStore((s) => s.device.serverUrlActive);
  const origem = baseUrl ? origemDe(baseUrl) : null;
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  const {
    webViewRef,
    semHandshake,
    aoReceberMensagem,
    aoTerminarCarga,
    aoNavegar,
    permitirNavegacao,
    recarregar,
  } = useHandshakeWeb({ sistema, origem: origem ?? '', obterContexto, onRetorno, onFechar });

  function tentarNovamente() {
    setErroCarga(null);
    recarregar();
  }

  if (!baseUrl || !origem) {
    return (
      <AvisoWeb
        titulo="Servidor não resolvido"
        mensagem="O endereço do servidor do cliente ainda não foi definido nesta instalação."
      />
    );
  }

  return (
    <View className="flex-1">
      <WebView
        ref={webViewRef}
        // Estilo real: componente de terceiro não passa pelo NativeWind — a
        // mesma exceção do `GestureHandlerRootView` (CLAUDE.md §4.9).
        style={{ flex: 1 }}
        source={{ uri: urlDoSistema(baseUrl, sistema) }}
        // Sem a prop `onMessage` a ponte não existe no Android.
        onMessage={aoReceberMensagem}
        onLoadEnd={aoTerminarCarga}
        onNavigationStateChange={aoNavegar}
        onShouldStartLoadWithRequest={permitirNavegacao}
        originWhitelist={[`${origem}/*`]}
        onError={({ nativeEvent }: { nativeEvent: { description: string } }) =>
          setErroCarga(nativeEvent.description)
        }
        // Nada de resíduo entre usuários: o aparelho é compartilhado, e era o
        // mesmo problema do JWT no fragmento, que ficava no cache e no
        // histórico (docs/analise §7.1.9).
        cacheEnabled={false}
        incognito
      />

      {erroCarga || semHandshake ? (
        <View className="absolute inset-0 bg-background">
          <AvisoWeb
            titulo={erroCarga ? 'Não foi possível abrir a página' : 'A página não pediu a sessão'}
            mensagem={
              erroCarga ??
              'A página carregou mas não solicitou a sessão. Se o problema continuar, é pendência do web system.'
            }
            onTentarNovamente={tentarNovamente}
          />
        </View>
      ) : null}
    </View>
  );
}

interface AvisoWebProps {
  titulo: string;
  mensagem: string;
  onTentarNovamente?: () => void;
}

/** Um aviso só, na própria tela — nada de diálogo empilhado (docs/analise §7.1.8). */
function AvisoWeb({ titulo, mensagem, onTentarNovamente }: AvisoWebProps) {
  return (
    <View accessibilityRole="alert" className="flex-1 items-center justify-center gap-3 px-8">
      <Text className="text-center text-base font-semibold text-foreground">{titulo}</Text>
      <Text className="text-center text-sm text-muted">{mensagem}</Text>
      {onTentarNovamente ? (
        <Button title="Tentar novamente" variant="outline" onPress={onTentarNovamente} />
      ) : null}
    </View>
  );
}
