import { z } from 'zod';

import { formatarDocumento, isDocumentoValido } from '@/features/auth/lib/documento';

/**
 * Entrada da tela de documento da empresa.
 *
 * Máscara e validação moram **aqui**, não em evento de tecla do campo
 * (docs/plano-migracao A2 · CLAUDE.md §4.7). O usuário digita como quiser; o
 * `transform` entrega o documento na forma que o Orion compara.
 */
export const documentoSchema = z.object({
  documento: z
    .string()
    .trim()
    .min(1, 'Informe o CNPJ ou CPF da empresa')
    .refine(isDocumentoValido, 'CNPJ ou CPF inválido')
    .transform(formatarDocumento),
});

export type DocumentoInput = z.input<typeof documentoSchema>;
export type DocumentoPayload = z.output<typeof documentoSchema>;
