import { useCallback } from 'react';

import { useDecidirLiberacao } from '@/features/liberacoes/hooks/use-decidir-liberacao';
import { useReservaLiberacao } from '@/features/liberacoes/hooks/use-reserva-liberacao';
import { useRetornoBordero } from '@/features/liberacoes/hooks/use-retorno-bordero';

import type { Decisao, Liberacao } from '@/features/liberacoes/schemas/liberacao.schema';

/**
 * Orquestra a análise: reserva ao abrir, decisão com o texto livre de resposta
 * e o retorno do borderô alimentando essa mesma decisão.
 *
 * A tela só apresenta — nenhuma dessas regras mora no componente.
 */
export function useAnaliseLiberacao(liberacao: Liberacao, onConcluir: (decisao: Decisao) => void) {
  const { reservando, erro: erroReserva, marcarDecidida } = useReservaLiberacao(liberacao.id);
  const { mutate, isPending, variables, error: erroDecisao } = useDecidirLiberacao();

  const decidir = useCallback(
    (decisao: Decisao, resposta: string) => {
      // Sucesso é 2xx, e quem diz isso é o cliente HTTP — não o corpo comparado
      // com `'{}'` (docs/analise §7.1.8). O erro vira `erroDecisao` e aparece
      // uma vez só, dentro do formulário: nunca dois diálogos empilhados.
      mutate(
        { id: liberacao.id, decisao, resposta },
        {
          onSuccess: () => {
            marcarDecidida();
            onConcluir(decisao);
          },
        },
      );
    },
    [liberacao.id, marcarDecidida, mutate, onConcluir],
  );

  useRetornoBordero(liberacao.borderoSequencia, decidir);

  return {
    reservando,
    erroReserva,
    erroDecisao,
    /** Qual decisão está no servidor agora — só ela mostra o spinner. */
    decisaoPendente: isPending ? (variables?.decisao ?? null) : null,
    decidir,
  };
}
