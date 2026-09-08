import { z } from 'zod';

/**
 * Tipos de notificação que o app sabe rotear.
 *
 * São os dois gatilhos que o `GatilhoNotificacao` do original tratava
 * (docs/analise §3.2): fila de liberações e autorização de cotação. A lista
 * real que o Orion manda hoje ainda é pergunta aberta do 🔒 B7
 * (docs/decisao-push.md §10, pergunta 5) — por isso tipo desconhecido é
 * descartado em vez de adivinhado.
 */
export const TipoNotificacao = {
  Liberacao: 'liberacao',
  Cotacao: 'cotacao',
} as const;

export type TipoNotificacao = (typeof TipoNotificacao)[keyof typeof TipoNotificacao];

/**
 * O `content.data` da notificação, validado.
 *
 * É entrada não confiável como qualquer resposta de rede (CLAUDE.md §4.8):
 * quem manda é o servidor, mas quem entrega é o sistema operacional, e no FCM
 * os valores de `data` chegam como texto no Android. A união discriminada é o
 * que permite decidir a rota pelo payload em vez de perguntar "esse form está
 * instanciado?", como fazia o original.
 *
 * `id` aceita texto ou número e sai sempre string, igual a `liberacao.id` —
 * `z.coerce.string()` não serve aqui porque transformaria um campo **ausente**
 * na string `'undefined'`.
 */
export const pushPayloadSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal(TipoNotificacao.Liberacao),
    id: z.union([z.string().trim().min(1), z.number()]).transform(String),
  }),
  z.object({ tipo: z.literal(TipoNotificacao.Cotacao) }),
]);

export type PushPayload = z.output<typeof pushPayloadSchema>;
