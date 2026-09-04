import { useLocalSearchParams } from 'expo-router';

import { DadosCliente } from '@/features/liberacoes/components/dados-cliente';
import { useLiberacao } from '@/features/liberacoes/hooks/use-liberacao';
import { queryState } from '@/shared/components/ui/query-state';
import { Screen } from '@/shared/components/ui/screen';

/**
 * Dados do cliente da liberação (plano C3).
 *
 * A rota só compõe. Empresa e cliente vêm do mesmo recorte de cache que a
 * análise usa (`useLiberacao`), porque são campos da própria liberação — a
 * tela não recebe código por parâmetro nem o adivinha da empresa da sessão.
 */
export default function ClienteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: liberacao, isLoading, error, refetch } = useLiberacao(id);

  const estado = queryState({
    isLoading,
    error,
    onRetry: refetch,
    isEmpty: !liberacao,
    emptyMessage: 'Esta liberação não está mais na fila.',
  });
  if (estado || !liberacao) return <Screen edges={['bottom']}>{estado}</Screen>;

  const empresa = liberacao.empresa.codigo;
  const cliente = liberacao.cliente.codigo;

  // Sem os dois códigos não há rota a chamar. Na prática não se chega aqui: o
  // atalho da análise só existe com `CLIFOR_CODIGO` (docs/analise §3.3).
  if (!empresa || !cliente) {
    return (
      <Screen edges={['bottom']}>
        {queryState({
          isLoading: false,
          error: null,
          isEmpty: true,
          emptyMessage: 'Esta liberação não identifica o cliente.',
        })}
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <DadosCliente empresa={empresa} cliente={cliente} nome={liberacao.cliente.nome} />
    </Screen>
  );
}
