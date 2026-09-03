import { Redirect, Stack } from 'expo-router';

import { useSessionStore } from '@/shared/stores/session.store';

/** Área autenticada. Sem usuário ou sem empresa corrente, volta ao onboarding. */
export default function AppLayout() {
  const user = useSessionStore((s) => s.user);
  const company = useSessionStore((s) => s.company);

  if (!user) return <Redirect href="/(auth)/login" />;
  if (!company) return <Redirect href="/(auth)/empresa" />;

  return (
    <Stack screenOptions={{ headerShown: true, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="menu" options={{ headerShown: false }} />
      <Stack.Screen name="liberacoes/index" options={{ title: 'Liberações Remotas' }} />
      <Stack.Screen name="liberacoes/[id]/index" options={{ title: 'Análise' }} />
      <Stack.Screen name="liberacoes/[id]/cliente" options={{ title: 'Dados do cliente' }} />
      <Stack.Screen name="notificacoes" options={{ title: 'Notificações' }} />
      <Stack.Screen name="web/[sistema]" options={{ headerShown: false }} />
    </Stack>
  );
}
