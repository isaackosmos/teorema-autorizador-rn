import { z } from 'zod';

/**
 * Respostas do Orion vêm com os nomes das colunas do Firebird
 * (SCREAMING_SNAKE). Todo payload é traduzido para camelCase aqui, na borda —
 * nenhuma tela enxerga nome de coluna do ERP.
 */

export const loginResponseSchema = z
  .object({
    JWT: z.string(),
    USUARIO_ID: z.coerce.number(),
    USUARIO_CODIGO: z.string(),
    USUARIO_NOME: z.string().nullish(),
    DEVICE_STATUS: z.coerce.number().nullish(),
  })
  .transform((raw) => ({
    jwt: raw.JWT,
    id: raw.USUARIO_ID,
    code: raw.USUARIO_CODIGO.padStart(3, '0'),
    name: raw.USUARIO_NOME ?? '',
    deviceStatus: raw.DEVICE_STATUS ?? null,
  }));

export type LoginResponse = z.output<typeof loginResponseSchema>;

export const companySchema = z
  .object({
    COMPANY_ID: z.coerce.number(),
    COMPANY_CODE: z.string(),
    COMPANY_NAME: z.string(),
  })
  .transform((raw) => ({
    id: raw.COMPANY_ID,
    code: raw.COMPANY_CODE,
    name: raw.COMPANY_NAME,
  }));

export const companyListSchema = z.array(companySchema);
