import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { LiberacaoCard } from '@/features/liberacoes/components/liberacao-card';
import { useLiberacoesPendentes } from '@/features/liberacoes/hooks/use-liberacoes-pendentes';
import { filtrarLiberacoes } from '@/features/liberacoes/lib/filtrar-liberacoes';
import { QueryState } from '@/shared/components/ui/query-state';
import { Screen } from '@/shared/components/ui/screen';
import { SearchField } from '@/shared/components/ui/search-field';

import type { Liberacao } from '@/features/liberacoes/schemas/liberacao.schema';
import type { Href } from 'expo-router';

/**
 * Tela de referência do padrão "lista com TanStack Query".
 *
 * A tela não faz fetch, não guarda os itens em `useState` e não conhece axios:
 * pede o hook, trata os três estados e renderiza. O único `useState` é o termo
 * de busca — estado de UI, não dado de servidor.
 */
export default function LiberacoesScreen() {
  const router = useRouter();
  const { data, isLoading, error, refetch, isRefetching } = useLiberacoesPendentes();
  const [busca, setBusca] = useState('');

  const visiveis = useMemo(() => filtrarLiberacoes(data ?? [], busca), [data, busca]);
  const termo = busca.trim();

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
      <View className="px-4 pt-4">
        <SearchField
          value={busca}
          onChangeText={setBusca}
          accessibilityLabel="Buscar liberação"
          placeholder="Cliente, mensagem ou origem"
        />
      </View>

      <FlatList
        data={visiveis}
        keyExtractor={(item) => item.id}
        contentContainerClassName="grow gap-3 p-4"
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <LiberacaoCard liberacao={item} onPress={(alvo) => router.push(rotaDaLiberacao(alvo))} />
        )}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        // Só cai aqui com a lista filtrada vazia: a busca continua na tela,
        // senão não haveria como limpar o termo.
        ListEmptyComponent={
          <QueryState
            isLoading={false}
            error={null}
            isEmpty
            emptyMessage={
              termo
                ? `Nenhuma liberação encontrada para "${termo}".`
                : 'Nenhuma liberação pendente.'
            }
          />
        }
      />
    </Screen>
  );
}

/**
 * Destino do item. Borderô não passa por reserva (docs/analise §3.3) — abre
 * direto o web system do autorizador financeiro.
 */
function rotaDaLiberacao(liberacao: Liberacao): Href {
  if (liberacao.isBordero) {
    return {
      pathname: '/(app)/web/[sistema]',
      params: { sistema: 'autorizador', sequencia: liberacao.borderoSequencia ?? '' },
    };
  }

  return { pathname: '/(app)/liberacoes/[id]', params: { id: liberacao.id } };
}
