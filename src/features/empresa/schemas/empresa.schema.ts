import { z } from 'zod';

import type { Company } from '@/shared/types/session.types';

/**
 * `GET /v1/application/companyfromuser/{usercode}` — empresas que o usuário
 * pode operar. Não é a empresa **licenciada** do aparelho: essa vem do
 * servidor central e mora em `device.companyCode` (docs/analise §3.1, §4.2).
 *
 * O `transform` declara `Company` como saída de propósito: é o mesmo tipo que
 * a sessão guarda, então uma divergência entre payload e sessão quebra a
 * compilação aqui, na borda, e não numa tela.
 */
export const empresaSchema = z
  .object({
    COMPANY_ID: z.coerce.number(),
    COMPANY_CODE: z.string(),
    COMPANY_NAME: z.string(),
  })
  .transform((raw): Company => ({
    id: raw.COMPANY_ID,
    code: raw.COMPANY_CODE,
    name: raw.COMPANY_NAME.trim(),
  }));

export const empresaListSchema = z.array(empresaSchema);

/**
 * A mesma lista, como ela volta do MMKV — já traduzida, porque o que se grava
 * é o modelo do domínio e não o payload do Orion. Disco escrito por uma versão
 * anterior do app não é confiável, então a leitura também valida.
 */
export const empresasEmCacheSchema = z.array(
  z.object({
    id: z.number(),
    code: z.string(),
    name: z.string(),
  }),
);
