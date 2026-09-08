import { useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';

import { registrarAparelhoParaPush } from '@/features/push/lib/registro-push';
import { useEstadoPushStore } from '@/features/push/stores/estado-push.store';
import { useSessionStore } from '@/shared/stores/session.store';

/**
 * Registra este aparelho para push assim que a área autenticada monta.
 *
 * Roda no efeito e **não bloqueia navegação nenhuma**: falhou, o app funciona
 * inteiro e tenta de novo na próxima abertura (docs/decisao-push.md §6.3). Não
 * há `setTimeout` para "dar tempo" de nada — o original gastava um `Sleep`
 * antes de verificar a permissão (docs/analise §7.2.13).
 *
 * Erro de rede aqui é comum e esperado: `getDevicePushTokenAsync()` é
 * requisição, e o aparelho pode estar offline. Vira `console.warn`, não tela
 * de erro.
 */
export function useRegistrarPush(): void {
  const registerId = useSessionStore((s) => s.device.registerId);
  const definir = useEstadoPushStore((s) => s.definir);

  const { mutate } = useMutation({
    mutationFn: () => registrarAparelhoParaPush(registerId!),
    onSuccess: definir,
    onError: (falha: unknown) => {
      console.warn('[push] não foi possível registrar o aparelho para notificações.', falha);
    },
  });

  useEffect(() => {
    // Sem aparelho registrado não há `register_id`, e o `tokenpush` é
    // exatamente `{register_id, push_token}` (docs/analise §5.2).
    if (registerId === null) return;

    mutate();
  }, [registerId, mutate]);
}
