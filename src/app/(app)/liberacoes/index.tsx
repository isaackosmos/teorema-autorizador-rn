import { useRouter } from 'expo-router';
import { FlatList, RefreshControl } from 'react-native';

import { LiberacaoCard } from '@/features/liberacoes/components/liberacao-card';
import { useLiberacoesPendentes } from '@/features/liberacoes/hooks/use-liberacoes-pendentes';
import { QueryState } from '@/shared/components/ui/query-state';
import { Screen } from '@/shared/components/ui/screen';

import type { Liberacao } from '@/features/liberacoes/schemas/liberacao.schema';

/**
 * Tela de referência do padrão "lista com TanStack Query".
 *
 * A tela não faz fetch, não guarda os itens em `useState` e não conhece axios:
 * pede o hook, trata os três estados e renderiza.
 */
export default function LiberacoesScreen() {
  const router = useRouter();
  const { data, isLoading, error, refetch, isRefetching } = useLiberacoesPendentes();

  function abrir(liberacao: Liberacao) {
    // Borderô não passa por reserva — abre direto o web system.
    if (liberacao.isBordero) {
      router.push({
        pathname: '/(app)/web/[sistema]',
        params: { sistema: 'autorizador', sequencia: liberacao.borderoSequencia ?? '' },
      });
      return;
    }

    router.push({ pathname: '/(app)/liberacoes/[id]', params: { id: liberacao.id } });
  }

  const estado = (
    <QueryState
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      isEmpty={data?.length === 0}
      emptyMessage="Nenhuma liberação pendente."
    />
  );

  if (estado) return <Screen edges={['bottom']}>{estado}</Screen>;

  return (
    <Screen edges={['bottom']}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerClassName="gap-3 p-4"
        renderItem={({ item }) => <LiberacaoCard liberacao={item} onPress={abrir} />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      />
    </Screen>
  );
}
