import { Text, View } from 'react-native';

import { Screen } from '@/shared/components/ui/screen';

/** PENDENTE — ver o índice de telas no CLAUDE.md. */
export default function ConfiguracaoScreen() {
  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-2 px-8">
        <Text className="text-lg font-semibold text-foreground">Configuração</Text>
        <Text className="text-center text-sm text-muted">
          Endereços primário/secundário, registro do aparelho e licença.
        </Text>
        <Text className="text-center text-xs text-pendente">Tela ainda não migrada.</Text>
      </View>
    </Screen>
  );
}
