import { useQuery } from '@tanstack/react-query';

import { listarPendentes } from '@/features/liberacoes/api/liberacoes.api';
import { liberacoesKeys } from '@/features/liberacoes/api/liberacoes.keys';
import { useCurrentUser } from '@/shared/stores/session.store';

/** Fila de liberações do usuário logado. */
export function useLiberacoesPendentes() {
  const user = useCurrentUser();

  return useQuery({
    queryKey: liberacoesKeys.pendentes(user?.code ?? ''),
    queryFn: () => listarPendentes(user!.code),
    enabled: user !== null,
  });
}
