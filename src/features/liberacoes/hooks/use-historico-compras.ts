import { useQuery } from '@tanstack/react-query';

import { buscarHistoricoCompras } from '@/features/liberacoes/api/liberacoes.api';
import { liberacoesKeys } from '@/features/liberacoes/api/liberacoes.keys';

/** Títulos financeiros do cliente da liberação. */
export function useHistoricoCompras(empresa: string | null, cliente: string | null) {
  return useQuery({
    queryKey: liberacoesKeys.historico(empresa ?? '', cliente ?? ''),
    queryFn: () => buscarHistoricoCompras(empresa!, cliente!),
    enabled: empresa !== null && cliente !== null,
  });
}
