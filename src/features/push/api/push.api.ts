import { tokenPushRequestSchema } from '@/features/push/schemas/token-push.schema';
import { centralApi } from '@/shared/lib/http/client';

import type { TokenPushRequest } from '@/features/push/schemas/token-push.schema';

/**
 * Serviço de API do push: uma função por endpoint, sem estado e sem React.
 */

/**
 * Guarda o token deste aparelho no servidor central.
 *
 * Vai no `centralApi` porque quem guarda o par `register_id` → `push_token` é
 * o `orion2`, não a base do cliente (CLAUDE.md §4.1).
 *
 * Sucesso é status 2xx. Nada de olhar o corpo procurando `'{}'`, que foi como
 * o app Delphi criou erro a cada mudança de formatação (docs/analise §7.1.8).
 */
export async function registrarTokenPush(input: TokenPushRequest): Promise<void> {
  await centralApi.post('/v1/application/tokenpush', tokenPushRequestSchema.parse(input));
}
