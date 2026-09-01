import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { Screen } from '@/shared/components/ui/screen';

/**
 * PENDENTE — análise de crédito e histórico financeiro do cliente.
 * Não reproduzir os campos `FALTA IMPL...` (docs/analise §7.2.12).
 */
export default function ClienteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen edges={['bottom']}>
      <View className="flex-1 items-center justify-center gap-2 px-8">
        <Text className="text-lg font-semibold text-foreground">Cliente da liberação {id}</Text>
        <Text className="text-center text-xs text-pendente">Tela ainda não migrada.</Text>
      </View>
    </Screen>
  );
}
