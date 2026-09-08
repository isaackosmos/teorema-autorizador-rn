import { pushPayloadSchema } from '@/features/push/schemas/push-payload.schema';

import type { PushPayload } from '@/features/push/schemas/push-payload.schema';

/**
 * Lê o `data` de uma notificação, ou `null` se ele não casa com o contrato.
 *
 * Payload fora do contrato **não navega para lugar nenhum** e não atualiza
 * cache nenhum: é o oposto do original, que despejava o payload cru num `TMemo`
 * de depuração em produção (docs/analise §7.3.27).
 *
 * O canal do relato é o `console.warn` liberado pelo CLAUDE.md §5.4 — enquanto
 * o projeto não tem coletor, este é mais um ponto a trocar quando tiver.
 */
export function lerPayloadPush(data: unknown): PushPayload | null {
  const payload = pushPayloadSchema.safeParse(data);
  if (payload.success) return payload.data;

  console.warn(
    '[push] notificação com payload fora do contrato; ignorada. ' +
      `Recebido: ${JSON.stringify(data)}`,
  );
  return null;
}
