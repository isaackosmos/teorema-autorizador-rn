import { create } from 'zustand';

import type { BorderoAbertura } from '@/features/liberacoes/schemas/bordero-abertura.schema';

/**
 * Canal de **ida** da tela de análise para o web system do autorizador
 * financeiro — gêmeo do `bordero-retorno.store.ts`, que faz a volta.
 *
 * O contexto de abertura (`sequencia` e o texto livre de resposta) não pode ser
 * parâmetro de rota: parâmetro de rota é URL, e URL entra em histórico — a
 * mesma classe de problema do JWT no fragmento do original (docs/analise §5.3,
 * §7.1.9). A análise publica aqui o payload já validado por
 * `borderoAberturaSchema` e a rota web consome uma vez, pelo `sistema` que ela
 * mesma recebeu.
 *
 * Não é persistido — vale só para a ida e volta dentro da mesma navegação.
 */
interface BorderoAberturaState {
  abertura: BorderoAbertura | null;
  /** Chamado pela análise, imediatamente antes de navegar. */
  publicar: (abertura: BorderoAbertura) => void;
  /** Lê e limpa; só a rota daquele `sistema` consome, para não vazar contexto. */
  consumir: (sistema: string) => BorderoAbertura | null;
}

export const useBorderoAberturaStore = create<BorderoAberturaState>()((set, get) => ({
  abertura: null,

  publicar: (abertura) => set({ abertura }),

  consumir: (sistema) => {
    const { abertura } = get();
    if (!abertura || abertura.sistema !== sistema) return null;

    set({ abertura: null });
    return abertura;
  },
}));
