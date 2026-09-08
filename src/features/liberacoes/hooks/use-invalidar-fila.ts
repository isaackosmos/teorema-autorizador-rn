import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { liberacoesKeys } from '@/features/liberacoes/api/liberacoes.keys';

/**
 * Marca a fila de liberações como desatualizada, sem tocar no resto do cache
 * da feature.
 *
 * É o contrato público da fila para quem está fora dela — hoje, o roteamento
 * de push, que precisa atualizar a lista sem saber que tela está montada e sem
 * importar nada de dentro desta feature além deste callback (CLAUDE.md §2).
 *
 * Invalida `liberacoesKeys.fila`, não `all`: a análise de crédito e o
 * histórico de compras do cliente não mudam porque chegou uma liberação nova
 * (CLAUDE.md §9, dívida D5).
 */
export function useInvalidarFila(): () => void {
  const queryClient = useQueryClient();

  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: liberacoesKeys.fila });
  }, [queryClient]);
}
