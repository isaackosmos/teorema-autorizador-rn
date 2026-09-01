import { Text, View } from 'react-native';

import { Screen } from '@/shared/components/ui/screen';

/**
 * PENDENTE — lista de notificações do sino.
 * No app original esta tela mostra JSON de teste hardcoded em produção
 * (docs/analise §7.2.11). Migrar só com dado real vindo do servidor.
 */
export default function NotificacoesScreen() {
  return (
    <Screen edges={['bottom']}>
      <View className="flex-1 items-center justify-center gap-2 px-8">
        <Text className="text-lg font-semibold text-foreground">Notificações</Text>
        <Text className="text-center text-xs text-pendente">Tela ainda não migrada.</Text>
      </View>
    </Screen>
  );
}
