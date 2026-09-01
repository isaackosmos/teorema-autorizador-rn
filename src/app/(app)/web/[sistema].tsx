import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { Screen } from '@/shared/components/ui/screen';

/**
 * PENDENTE — contêiner único dos web systems (`autcompras`, `autcotacao`,
 * `reqcompras`, `autorizador`).
 *
 * O app Delphi tinha três forms idênticos para isso, além do `TFrmWebSystems`
 * genérico (docs/analise §7.3.21). Aqui é uma rota só, parametrizada.
 *
 * Depende de `react-native-webview`, ainda não instalado. Ao implementar:
 * NÃO passar o JWT no fragmento da URL como o app original faz — ele fica no
 * histórico e no cache da WebView (docs/analise §7.1.9).
 */
export default function WebSystemScreen() {
  const { sistema } = useLocalSearchParams<{ sistema: string }>();

  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-2 px-8">
        <Text className="text-lg font-semibold text-foreground">Web system: {sistema}</Text>
        <Text className="text-center text-xs text-pendente">Tela ainda não migrada.</Text>
      </View>
    </Screen>
  );
}
