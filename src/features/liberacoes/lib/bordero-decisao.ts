import { Decisao } from '@/features/liberacoes/schemas/liberacao.schema';

import type { SituacaoBordero } from '@/features/liberacoes/schemas/bordero-retorno.schema';

/**
 * Situação devolvida pelo borderô → decisão da liberação de origem
 * (docs/analise §3.3).
 *
 * `null` significa "não decidir": a liberação continua como estava. É o caso
 * de quem só fechou o web system sem finalizar nada.
 */
export function decisaoDoBordero(situacao: SituacaoBordero): Decisao | null {
  switch (situacao) {
    // Parcial autoriza junto com o total: a liberação só existe para destravar
    // o borderô, e o rateio de quem foi aprovado é do próprio borderô.
    case 'S':
    case 'P':
      return Decisao.Autorizar;
    case 'N':
      return Decisao.Reprovar;
    default:
      return null;
  }
}
