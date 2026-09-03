import { useQuery } from '@tanstack/react-query';

import { buscarLogo } from '@/features/empresa/api/empresa.api';
import { empresaKeys } from '@/features/empresa/api/empresa.keys';
import { useCurrentCompany } from '@/shared/stores/session.store';

/**
 * Logo da empresa corrente.
 *
 * O app Delphi baixava a imagem numa thread a cada `AjustaLayout` do menu —
 * ou seja, a cada abertura da tela (docs/analise §3.2). Aqui o download é uma
 * query cacheada: a logo não muda durante a sessão, então não é revalidada
 * (`staleTime` infinito) e não é descartada da memória (`gcTime` infinito).
 *
 * Logo é enfeite: falha não vira erro de tela e não se repete a requisição —
 * o cabeçalho cai no marcador com a inicial da empresa.
 */
export function useLogoEmpresa() {
  const company = useCurrentCompany();

  return useQuery({
    queryKey: empresaKeys.logo(company?.code ?? ''),
    queryFn: () => buscarLogo(company!.code),
    enabled: company !== null,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}
