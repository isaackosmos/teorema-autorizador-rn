import { Text, View } from 'react-native';

import { Screen } from '@/shared/components/ui/screen';

/** PENDENTE — ver o índice de telas no CLAUDE.md. */
export default function DocumentoScreen() {
  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-2 px-8">
        <Text className="text-lg font-semibold text-foreground">Documento da empresa</Text>
        <Text className="text-center text-sm text-muted">
          Valida CNPJ/CPF no servidor central e resolve as URLs do tenant.
        </Text>
        <Text className="text-center text-xs text-pendente">Tela ainda não migrada.</Text>
      </View>
    </Screen>
  );
}
