import { useMutation } from '@tanstack/react-query';

import { ping } from '@/features/auth/api/auth.api';
import { ApiError } from '@/shared/lib/http/errors';
import { useSessionStore } from '@/shared/stores/session.store';

import type { ConexaoPayload } from '@/features/auth/schemas/conexao.schema';

/** Qual endereço respondeu ao `/v1/ping`. */
export type OrigemConexao = 'primario' | 'secundario';

/**
 * Passo 1 do onboarding: descobre o endereço do tenant que responde.
 *
 * Testa o primário e, falhando, o secundário — a mesma ordem do original
 * (`DefineConexao` → `DefineConexao2`), sem os dois diálogos empilhados que
 * ele mostrava quando os dois falhavam (docs/analise §7.1.8). O endereço que
 * respondeu vira `device.serverUrlActive`, e é dele que todas as outras
 * chamadas ao tenant saem.
 */
export function useTestarConexao() {
  const setDevice = useSessionStore((s) => s.setDevice);

  return useMutation({
    mutationFn: async ({ serverUrlPrimary, serverUrlSecondary }: ConexaoPayload) => {
      if (await ping(serverUrlPrimary)) {
        return { url: serverUrlPrimary, origem: 'primario' as OrigemConexao };
      }

      if (serverUrlSecondary && (await ping(serverUrlSecondary))) {
        return { url: serverUrlSecondary, origem: 'secundario' as OrigemConexao };
      }

      throw new ApiError(0, 'Nenhum dos endereços respondeu. Confira o endereço e a rede.');
    },
    onSuccess: ({ url }, { serverUrlPrimary, serverUrlSecondary }) => {
      // Os endereços digitados também são gravados: o usuário pode ter
      // corrigido o que veio do servidor central. Secundário vazio entra na
      // sessão como nulo — não como texto vazio — para o fallback do plano F1
      // ter um caso só.
      setDevice({
        serverUrlPrimary,
        serverUrlSecondary: serverUrlSecondary || null,
        serverUrlActive: url,
      });
    },
  });
}
