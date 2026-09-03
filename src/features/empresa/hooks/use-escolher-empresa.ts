import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { useSessionStore } from '@/shared/stores/session.store';

import type { Company } from '@/shared/types/session.types';

/**
 * Fecha a escolha da empresa: grava a empresa corrente na sessão e abre o menu.
 *
 * Só a empresa **escolhida** vai para o store — a lista continua sendo dado de
 * servidor, no cache da query (CLAUDE.md §4.8). É o único ponto que define
 * `company`, e é por isso que a troca de empresa pelo chrome (Bloco B) vai
 * reusar este hook em vez de escrever no store por conta própria.
 */
export function useEscolherEmpresa() {
  const router = useRouter();
  const setCompany = useSessionStore((s) => s.setCompany);

  return useCallback(
    (empresa: Company) => {
      setCompany(empresa);
      router.replace('/(app)/menu');
    },
    [router, setCompany],
  );
}
