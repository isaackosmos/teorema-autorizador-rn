import { create } from 'zustand';

import type { BorderoRetorno } from '@/features/liberacoes/schemas/bordero-retorno.schema';

/**
 * Canal de retorno do web system do autorizador financeiro para a tela de
 * análise que o abriu.
 *
 * O Expo Router não devolve valor de uma rota para a anterior, então o retorno
 * precisa de um lugar: o web system publica aqui o payload já validado por
 * `borderoRetornoSchema` e a análise consome uma vez, pela sequência que ela
 * mesma abriu. Sem isso sobraria o `delphi://<json>` concatenado do original
 * (docs/analise §7.1.9, plano D).
 *
 * Não é persistido — vale só para a ida e volta dentro da mesma navegação.
 */
interface BorderoRetornoState {
  retorno: BorderoRetorno | null;
  /** Chamado pelo web system ao fechar. */
  publicar: (retorno: BorderoRetorno) => void;
  /** Lê e limpa; só o dono da sequência consome, para não aplicar duas vezes. */
  consumir: (sequencia: string) => BorderoRetorno | null;
}

export const useBorderoRetornoStore = create<BorderoRetornoState>()((set, get) => ({
  retorno: null,

  publicar: (retorno) => set({ retorno }),

  consumir: (sequencia) => {
    const { retorno } = get();
    if (!retorno || retorno.sequencia !== sequencia) return null;

    set({ retorno: null });
    return retorno;
  },
}));
