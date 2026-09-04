import { queryOptions, useQuery } from '@tanstack/react-query';

import { listarPendentes } from '@/features/liberacoes/api/liberacoes.api';
import { liberacoesKeys } from '@/features/liberacoes/api/liberacoes.keys';
import { useCurrentUser } from '@/shared/stores/session.store';

/**
 * Opções da fila do usuário.
 *
 * Ficam aqui, e não repetidas em cada hook, porque a tela de análise lê o
 * **mesmo** cache por outro recorte (`use-liberacao.ts`): duas `queryFn` para a
 * mesma chave dariam duas verdades sobre a mesma fila.
 */
export function liberacoesPendentesOptions(userCode: string | null) {
  return queryOptions({
    queryKey: liberacoesKeys.pendentes(userCode ?? ''),
    queryFn: () => listarPendentes(userCode!),
    enabled: userCode !== null,
  });
}

/** Fila de liberações do usuário logado. */
export function useLiberacoesPendentes() {
  const user = useCurrentUser();

  return useQuery(liberacoesPendentesOptions(user?.code ?? null));
}
