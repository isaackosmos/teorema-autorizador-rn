import { create } from 'zustand';

import type { EstadoPush } from '@/features/push/lib/registro-push';

interface EstadoPushState {
  /** `null` enquanto o registro ainda não rodou nesta execução. */
  estado: EstadoPush | null;
  definir: (estado: EstadoPush) => void;
}

/**
 * Resultado da última tentativa de registro para push.
 *
 * É estado do cliente, não de servidor (CLAUDE.md §4.8): quem escreve é o hook
 * de registro, no layout da área autenticada; quem lê é o aviso de permissão,
 * na tela de menu. Sem o store, as duas pontas teriam de virar uma só.
 *
 * **Não é persistido de propósito.** A permissão mora no sistema operacional e
 * o usuário pode mudá-la fora do app; restaurar do disco seria repetir uma
 * resposta velha como se fosse a atual.
 */
export const useEstadoPushStore = create<EstadoPushState>()((set) => ({
  estado: null,
  definir: (estado) => set({ estado }),
}));
