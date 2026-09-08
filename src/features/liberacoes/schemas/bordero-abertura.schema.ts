import { z } from 'zod';

import { decisaoSchema } from '@/features/liberacoes/schemas/liberacao.schema';

/**
 * Contexto de **ida** da análise para o web system do autorizador financeiro —
 * irmão do `borderoRetornoSchema`, que cobre a volta.
 *
 * Existe para o texto livre do usuário não viajar como parâmetro de rota: na
 * URL de `(app)/web/[sistema]` fica só `sistema`, que é o parâmetro da rota e
 * não é dado de ninguém (docs/decisao-webview-sessao §7b, CLAUDE.md §4.11).
 *
 * `sistema` é a chave de quem pode consumir: só a rota aberta com esse
 * parâmetro lê o contexto, do mesmo jeito que na volta só o dono da
 * `sequencia` consome.
 */
export const borderoAberturaSchema = z.object({
  sistema: z.string().trim().min(1),
  /** Do payload (`borderoSequencia`), nunca de um label (docs/analise §7.1.7). */
  sequencia: z.string().trim().min(1),
  /** O mesmo texto que acompanharia a decisão — mesmo limite, uma regra só. */
  resposta: decisaoSchema.shape.resposta,
});

export type BorderoAbertura = z.output<typeof borderoAberturaSchema>;
