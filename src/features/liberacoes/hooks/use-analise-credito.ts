import { useQuery } from '@tanstack/react-query';

import { buscarAnaliseCredito } from '@/features/liberacoes/api/liberacoes.api';
import { liberacoesKeys } from '@/features/liberacoes/api/liberacoes.keys';

/**
 * Análise de crédito do cliente da liberação.
 *
 * Sem empresa ou sem cliente a query não roda: o atalho para esta tela só
 * aparece quando a liberação traz `CLIFOR_CODIGO` (docs/analise §3.3), e
 * chamar a rota com um segmento vazio devolveria 404.
 */
export function useAnaliseCredito(empresa: string | null, cliente: string | null) {
  return useQuery({
    queryKey: liberacoesKeys.credito(empresa ?? '', cliente ?? ''),
    queryFn: () => buscarAnaliseCredito(empresa!, cliente!),
    enabled: empresa !== null && cliente !== null,
  });
}
