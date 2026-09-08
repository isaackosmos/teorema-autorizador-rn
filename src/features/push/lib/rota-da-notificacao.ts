import { TipoNotificacao } from '@/features/push/schemas/push-payload.schema';

import type { PushPayload } from '@/features/push/schemas/push-payload.schema';
import type { Href } from 'expo-router';

/**
 * Destino de cada notificação, decidido pelo payload.
 *
 * O original perguntava se o form existia e, quando não existia, **não fazia
 * nada** (docs/analise §3.2). Aqui a notificação sempre tem um destino, e é o
 * router que leva até ele.
 *
 * O `Href` só é rede de segurança depois que os tipos de rota são gerados em
 * `.expo/types` — num checkout limpo o `tsc` aceita rota inexistente
 * (docs/decisao-push.md §8, achado 1). Vale lembrar ao mexer nos caminhos daqui.
 */
export function rotaDaNotificacao(payload: PushPayload): Href {
  if (payload.tipo === TipoNotificacao.Liberacao) {
    return { pathname: '/(app)/liberacoes/[id]', params: { id: payload.id } };
  }

  return { pathname: '/(app)/web/[sistema]', params: { sistema: 'autcotacao' } };
}
