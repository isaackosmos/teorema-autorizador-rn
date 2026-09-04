import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { AnaliseLiberacao } from '@/features/liberacoes/components/analise-liberacao';
import { DecisaoFeedback } from '@/features/liberacoes/components/decisao-feedback';
import { useLiberacao } from '@/features/liberacoes/hooks/use-liberacao';
import { queryState } from '@/shared/components/ui/query-state';
import { Screen } from '@/shared/components/ui/screen';

import type { Decisao } from '@/features/liberacoes/schemas/liberacao.schema';

/**
 * Análise da liberação — onde o dinheiro é decidido (plano C2).
 *
 * A rota só compõe: `useLiberacao` recorta a fila, `<AnaliseLiberacao>` cuida
 * de reserva, devolução e decisão, e o feedback é estado desta tela.
 */
export default function LiberacaoDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [decidida, setDecidida] = useState<Decisao | null>(null);

  const { data: liberacao, isLoading, error, refetch } = useLiberacao(id);

  // Decidida, a liberação sai da fila na invalidação — por isso o feedback vive
  // aqui, e não depende de ainda achar o item na lista.
  if (decidida) {
    return (
      <Screen edges={['bottom']}>
        <DecisaoFeedback decisao={decidida} onVoltar={() => router.back()} />
      </Screen>
    );
  }

  const estado = queryState({
    isLoading,
    error,
    onRetry: refetch,
    isEmpty: !liberacao,
    emptyMessage: 'Esta liberação não está mais na fila.',
  });
  if (estado || !liberacao) return <Screen edges={['bottom']}>{estado}</Screen>;

  return (
    <Screen edges={['bottom']}>
      <AnaliseLiberacao liberacao={liberacao} onConcluir={setDecidida} />
    </Screen>
  );
}
