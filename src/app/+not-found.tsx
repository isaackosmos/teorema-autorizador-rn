import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

import { Screen } from '@/shared/components/ui/screen';

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: 'Tela não encontrada' }} />
      <Screen>
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <Text className="text-center text-base text-foreground">Esta tela não existe.</Text>
          <Link href="/" className="text-base font-semibold text-primary">
            Voltar para o início
          </Link>
        </View>
      </Screen>
    </>
  );
}
