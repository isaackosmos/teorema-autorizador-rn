import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { lerPayloadPush } from '@/features/push/lib/payload-push';
import { rotaDaNotificacao } from '@/features/push/lib/rota-da-notificacao';

import type { TipoNotificacao } from '@/features/push/schemas/push-payload.schema';

interface RoteamentoPushOptions {
  /**
   * O que atualizar quando cada tipo de notificação chega — **um efeito por
   * tipo**, e nenhum efeito para o tipo que não tem cache a atualizar.
   *
   * É este formato que impede repetir a dívida D5 (CLAUDE.md §9) do lado do
   * push: invalidar o prefixo inteiro da feature refaria a análise de crédito
   * de todo cliente em cache a cada notificação, e quem dispara aqui é o
   * servidor, não o usuário (docs/decisao-push.md §6.4).
   */
  atualizarPorTipo?: Partial<Record<TipoNotificacao, () => void>>;
}

/**
 * Liga notificação a tela: recebida atualiza o cache, tocada leva à rota.
 *
 * Substitui o `GatilhoNotificacao` do original, que perguntava se o form
 * estava instanciado e, quando não estava, não fazia nada (docs/analise §3.2).
 * Aqui a atualização é invalidação de cache — funciona com a tela montada e é
 * inofensiva sem ela — e a navegação sai do payload.
 *
 * Uma entrada só cobre os dois casos de toque: `useLastNotificationResponse()`
 * devolve tanto a resposta que chegou com o app aberto quanto a que abriu o
 * app do zero.
 */
export function useRoteamentoPush({ atualizarPorTipo }: RoteamentoPushOptions = {}): void {
  const router = useRouter();
  const resposta = Notifications.useLastNotificationResponse();

  // Na composição o mapa costuma ser um literal, recriado a cada render.
  // Guardar a última versão numa ref mantém a inscrição do listener estável.
  const efeitos = useRef(atualizarPorTipo);
  useEffect(() => {
    efeitos.current = atualizarPorTipo;
  });

  useEffect(() => {
    const inscricao = Notifications.addNotificationReceivedListener((notificacao) => {
      const payload = lerPayloadPush(notificacao.request.content.data);
      if (payload) efeitos.current?.[payload.tipo]?.();
    });

    return () => inscricao.remove();
  }, []);

  useEffect(() => {
    // `undefined` é "ainda não se sabe" e `null` é "não houve resposta": tratar
    // os dois como iguais decidiria antes de saber (docs/decisao-push.md §4.1).
    if (!resposta) return;

    const payload = lerPayloadPush(resposta.notification.request.content.data);
    if (!payload) return;

    // Limpa antes de navegar, senão a mesma resposta reabre a rota a cada
    // remontagem deste layout. A versão síncrona é a atual — a `…Async` está
    // deprecada na 57.0.17 (docs/decisao-push.md §4.1).
    Notifications.clearLastNotificationResponse();
    router.push(rotaDaNotificacao(payload));
  }, [resposta, router]);
}
