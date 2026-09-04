import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { decisaoDoBordero } from '@/features/liberacoes/lib/bordero-decisao';
import { useBorderoRetornoStore } from '@/features/liberacoes/stores/bordero-retorno.store';

import type { Decisao } from '@/features/liberacoes/schemas/liberacao.schema';

/**
 * Aplica na liberação o que o web system do borderô devolveu, ao voltar para
 * a análise (docs/analise §3.3).
 *
 * `sequencia` é a do payload (`borderoSequencia`) — nunca a última palavra de
 * um label, como no original (docs/analise §7.1.7). Situação vazia não chama
 * `aplicar`: o usuário só fechou a tela e a situação anterior é preservada.
 */
export function useRetornoBordero(
  sequencia: string | null,
  aplicar: (decisao: Decisao, resposta: string) => void,
) {
  const consumir = useBorderoRetornoStore((s) => s.consumir);

  useFocusEffect(
    useCallback(() => {
      if (!sequencia) return;

      const retorno = consumir(sequencia);
      if (!retorno) return;

      const decisao = decisaoDoBordero(retorno.situacao);
      if (decisao) aplicar(decisao, retorno.resposta);
    }, [sequencia, consumir, aplicar]),
  );
}
