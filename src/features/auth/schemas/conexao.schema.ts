import { z } from 'zod';

/**
 * Entrada do passo de conexão: os endereços do tenant.
 *
 * No original o endereço era digitado num **modal genérico de entrada de
 * texto** (`TFrmImput`), um por vez, sem validação (docs/plano-migracao A3).
 * Aqui é campo de formulário na própria tela, com a regra no schema.
 */

/** Tira barra final e caixa alta: a URL é comparada e concatenada como texto. */
function normalizarUrl(valor: string): string {
  return valor.toLowerCase().replace(/\/+$/, '');
}

const MENSAGEM_URL = 'Endereço inválido — informe com http:// ou https://';

const endereco = z
  .string()
  .trim()
  .min(1, 'Informe o endereço do servidor primário')
  .transform(normalizarUrl)
  .pipe(z.url({ error: MENSAGEM_URL, protocol: /^https?$/ }));

const enderecoOpcional = z
  .string()
  .trim()
  .transform(normalizarUrl)
  .refine((valor) => valor === '' || z.url({ protocol: /^https?$/ }).safeParse(valor).success, {
    error: MENSAGEM_URL,
  });

export const conexaoSchema = z.object({
  serverUrlPrimary: endereco,
  serverUrlSecondary: enderecoOpcional,
});

export type ConexaoInput = z.input<typeof conexaoSchema>;
export type ConexaoPayload = z.output<typeof conexaoSchema>;
