import { useQuery } from '@tanstack/react-query';

import { listarEmpresasDoUsuario } from '@/features/empresa/api/empresa.api';
import { empresaKeys } from '@/features/empresa/api/empresa.keys';
import { gravarEmpresasEmCache, lerEmpresasEmCache } from '@/features/empresa/lib/empresas-cache';
import { useCurrentUser } from '@/shared/stores/session.store';

/**
 * Empresas do usuário logado, com cópia em disco.
 *
 * O hook liga API + sessão + cache: a lista vem do tenant e é gravada no MMKV
 * a cada resposta, porque é ela que sustenta o login offline (plano F2) —
 * papel que no original era da tabela `COMPANYS` do SQLite (docs/analise §3.1).
 *
 * O que está gravado entra como `initialData` **já vencido**
 * (`initialDataUpdatedAt: 0`): a tela abre instantânea com a lista da última
 * sessão e a revalidação acontece por baixo. Sem servidor, o `data` continua
 * sendo o cache e a tela decide o que fazer com o `error`.
 */
export function useEmpresasDoUsuario() {
  const user = useCurrentUser();
  const userCode = user?.code ?? '';

  return useQuery({
    queryKey: empresaKeys.doUsuario(userCode),
    queryFn: async () => {
      const empresas = await listarEmpresasDoUsuario(userCode);
      gravarEmpresasEmCache(userCode, empresas);
      return empresas;
    },
    enabled: user !== null,
    initialData: () => lerEmpresasEmCache(userCode) ?? undefined,
    initialDataUpdatedAt: 0,
  });
}
