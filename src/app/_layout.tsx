import '../styles/global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { configurarExibicaoEmForeground } from '@/features/push/lib/exibicao-notificacao';
import { queryClient } from '@/shared/config/query-client';

// Precisa valer antes da primeira notificação chegar, e não depende de nenhum
// provider — por isso fica no módulo, não dentro do componente.
configurarExibicaoEmForeground();

/** Layout raiz: só monta providers. Nenhuma regra de negócio aqui. */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }} />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
