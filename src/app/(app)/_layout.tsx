import { Redirect, Stack } from 'expo-router';

import { useInvalidarFila } from '@/features/liberacoes/hooks/use-invalidar-fila';
import { useRegistrarPush } from '@/features/push/hooks/use-registrar-push';
import { useRoteamentoPush } from '@/features/push/hooks/use-roteamento-push';
import { TipoNotificacao } from '@/features/push/schemas/push-payload.schema';
import { useSessionStore } from '@/shared/stores/session.store';

/** Área autenticada. Sem usuário ou sem empresa corrente, volta ao onboarding. */
export default function AppLayout() {
  const user = useSessionStore((s) => s.user);
  const company = useSessionStore((s) => s.company);

  if (!user) return <Redirect href="/(auth)/login" />;
  if (!company) return <Redirect href="/(auth)/empresa" />;

  return (
    <>
      <PushDaAreaAutenticada />

      <Stack screenOptions={{ headerShown: true, headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="menu" options={{ headerShown: false }} />
        <Stack.Screen name="liberacoes/index" options={{ title: 'Liberações Remotas' }} />
        <Stack.Screen name="liberacoes/[id]/index" options={{ title: 'Análise' }} />
        <Stack.Screen name="liberacoes/[id]/cliente" options={{ title: 'Dados do cliente' }} />
        <Stack.Screen name="notificacoes" options={{ title: 'Notificações' }} />
        {/* O título real é o do sistema aberto, e quem o define é a própria
            rota. O cabeçalho fica visível de propósito: sem ele, uma página que
            não implemente `navegacao:fechar` prenderia o usuário na WebView. */}
        <Stack.Screen name="web/[sistema]" options={{ title: 'Web system' }} />
      </Stack>
    </>
  );
}

/**
 * Liga o push enquanto a área autenticada está montada. Não renderiza nada:
 * é o ponto de composição onde a feature de push encontra a de liberações —
 * nenhuma das duas importa a outra (CLAUDE.md §2).
 *
 * Fica em um componente próprio, e não no `AppLayout`, para que os hooks só
 * rodem depois das guardas de sessão: registrar aparelho e navegar por
 * notificação são coisas de quem já está dentro.
 */
function PushDaAreaAutenticada() {
  const invalidarFila = useInvalidarFila();

  useRegistrarPush();
  useRoteamentoPush({
    // Push de liberação atualiza **só** a fila. Invalidar o prefixo inteiro da
    // feature refaria a análise de crédito de todo cliente em cache a cada
    // notificação recebida (CLAUDE.md §9, dívida D5). `cotacao` não aparece
    // aqui porque abre um web system, que não tem cache do TanStack Query.
    atualizarPorTipo: { [TipoNotificacao.Liberacao]: invalidarFila },
  });

  return null;
}
