import { Text, View } from 'react-native';

import { useSessionStore } from '@/shared/stores/session.store';

/**
 * Aviso de que o app não está falando com o servidor.
 *
 * O estado vem da sessão (`online`), que o cliente HTTP marca a partir do
 * resultado real das requisições. Não há botão "testar conexão": no app
 * Delphi esse botão existia no layout de offline e **não tinha handler**
 * nenhum (`BtnTestaConexao`). A retomada de conexão é o fallback
 * primário → secundário do plano F1, não um toque do usuário.
 */
export function OfflineBanner() {
  const online = useSessionStore((s) => s.online);

  if (online) return null;

  return (
    <View
      accessibilityRole="alert"
      className="rounded-lg border border-pendente/40 bg-pendente/15 px-3 py-2"
    >
      <Text className="text-xs font-semibold text-pendente">Sem conexão com o servidor</Text>
      <Text className="text-xs text-pendente">O que está na tela pode estar desatualizado.</Text>
    </View>
  );
}
