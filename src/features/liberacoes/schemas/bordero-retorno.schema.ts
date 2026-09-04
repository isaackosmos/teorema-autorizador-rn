import { z } from 'zod';

/**
 * Retorno do web system do autorizador financeiro para a liberação que o abriu.
 *
 * `situacao`: `S` todos aprovados · `N` todos reprovados · `P` parcial · vazio
 * quando o usuário só fechou a tela (docs/analise §3.3). Quem **calcula** S/N/P
 * é o borderô — servidor e HTML; o app só repassa (docs/analise §7.3.21).
 *
 * Situação desconhecida cai em vazio: preservar a situação anterior da
 * liberação é sempre o caminho seguro.
 */
const situacaoBorderoSchema = z
  .string()
  .nullish()
  .transform((valor) => (valor ?? '').trim().toUpperCase())
  .pipe(z.enum(['', 'S', 'N', 'P']).catch(''));

export type SituacaoBordero = z.output<typeof situacaoBorderoSchema>;

/**
 * Payload que volta do HTML. O original concatenava `delphi://` com o JSON e
 * lia a sequência da última palavra de um label (docs/analise §7.1.7): aqui a
 * ponte é tipada e a sequência é campo próprio.
 */
export const borderoRetornoSchema = z.object({
  sequencia: z.coerce.string(),
  situacao: situacaoBorderoSchema,
  resposta: z
    .string()
    .nullish()
    .transform((valor) => valor?.trim() ?? ''),
});

export type BorderoRetorno = z.output<typeof borderoRetornoSchema>;
