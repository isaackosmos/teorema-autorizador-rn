import { z } from 'zod';

/**
 * Corpo do `POST /v1/application/tokenpush` no servidor central.
 *
 * O contrato é o que o original já manda: `{register_id, push_token}`
 * (docs/analise §5.2). O schema traduz camelCase → nome de campo do endpoint,
 * para que nenhum hook precise conhecer `push_token`.
 *
 * **A plataforma não vai junto de propósito.** `getDevicePushTokenAsync()`
 * devolve `type: 'ios' | 'android'` (docs/decisao-push.md §4.1), então o dado
 * existe e é de graça — mas o servidor ainda não tem campo para ele
 * (§10, pergunta 2), e inventar chave num contrato aberto é pior do que
 * esperar a resposta. Quando o Orion aceitar, entra aqui e em mais lugar
 * nenhum.
 */
export const tokenPushRequestSchema = z
  .object({
    registerId: z.number(),
    token: z.string().min(1),
  })
  .transform((v) => ({
    register_id: v.registerId,
    push_token: v.token,
  }));

export type TokenPushRequest = z.input<typeof tokenPushRequestSchema>;
