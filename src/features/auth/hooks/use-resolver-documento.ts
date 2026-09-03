import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { buscarEmpresaLicenciada, buscarEnderecosServidor } from '@/features/auth/api/auth.api';
import { useSessionStore } from '@/shared/stores/session.store';

import type { DocumentoPayload } from '@/features/auth/schemas/documento.schema';

/**
 * Resolve o documento da empresa no servidor central: valida a licença e
 * descobre os endereços do tenant.
 *
 * As duas chamadas são sequenciais de propósito — sem licença para o documento
 * não há por que perguntar endereço. A sessão só é tocada no `onSuccess`: um
 * documento recusado não deixa rastro no aparelho (docs/plano-migracao A2).
 *
 * O CNPJ de demonstração não tem tratamento especial: no original ele ligava
 * um `IsDemo` no cliente (docs/analise §3.1), aqui é um documento como outro
 * qualquer e quem responde se é demo é o servidor.
 */
export function useResolverDocumento() {
  const router = useRouter();
  const setDevice = useSessionStore((s) => s.setDevice);

  return useMutation({
    mutationFn: async ({ documento }: DocumentoPayload) => {
      const empresa = await buscarEmpresaLicenciada(documento);
      const enderecos = await buscarEnderecosServidor(documento);
      return { documento, empresa, enderecos };
    },
    onSuccess: ({ documento, empresa, enderecos }) => {
      setDevice({
        companyDocument: documento,
        companyCode: empresa.code,
        companyId: empresa.id,
        serverUrlPrimary: enderecos.primary,
        serverUrlSecondary: enderecos.secondary,
        serverUrlPrint: enderecos.print,
      });

      router.replace('/(auth)/configuracao');
    },
  });
}
