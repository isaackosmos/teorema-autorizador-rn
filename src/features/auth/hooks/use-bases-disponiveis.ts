import { useQuery } from '@tanstack/react-query';

import { listarBases } from '@/features/auth/api/auth.api';
import { authKeys } from '@/features/auth/api/auth.keys';
import { useSessionStore } from '@/shared/stores/session.store';

/**
 * Bases que o tenant expõe para o documento.
 *
 * Só faz sentido depois que o ping elegeu um endereço — antes disso a
 * requisição nem sairia do app (o interceptor do `tenantApi` barra).
 */
export function useBasesDisponiveis() {
  const documento = useSessionStore((s) => s.device.companyDocument);
  const serverUrlActive = useSessionStore((s) => s.device.serverUrlActive);

  return useQuery({
    queryKey: authKeys.bases(documento ?? ''),
    queryFn: () => listarBases(documento!),
    enabled: documento !== null && serverUrlActive !== null,
  });
}
