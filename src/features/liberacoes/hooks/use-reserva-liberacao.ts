import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import { devolver, reservar } from '@/features/liberacoes/api/liberacoes.api';
import { useCurrentUser } from '@/shared/stores/session.store';

import type { ApiError } from '@/shared/lib/http/errors';

/**
 * Reserva a liberação ao abrir a análise e devolve para a fila ao sair sem
 * decidir (docs/analise §3.3).
 *
 * A devolução só acontece quando **esta** sessão conseguiu reservar: sem isso
 * a liberação está em análise com outro usuário e o `release` derrubaria o
 * trabalho dele. A trava do servidor ainda é fictícia (plano 🔒 B3), então a
 * tela não promete exclusividade a ninguém.
 *
 * Falhar ao devolver não segura o usuário na tela — ele volta para a fila
 * mesmo assim, como no original.
 */
export function useReservaLiberacao(id: string) {
  const user = useCurrentUser();
  const userCode = user?.code ?? null;

  const { mutateAsync, status, error } = useMutation<void, ApiError>({
    mutationFn: () => reservar(id, userCode!),
  });

  const decididaRef = useRef(false);

  /** Decidida não se devolve: a situação final é `2`/`3`, não `0`. */
  const marcarDecidida = useCallback(() => {
    decididaRef.current = true;
  }, []);

  useEffect(() => {
    if (!userCode) return;

    const reserva = mutateAsync().then(
      () => true,
      () => false,
    );

    return () => {
      if (decididaRef.current) return;

      // Espera a reserva resolver: sair antes de a chamada voltar não pode
      // deixar a liberação presa em `'1'` (docs/analise §7.1.4).
      reserva
        .then((reservada) => (reservada ? devolver(id, userCode) : undefined))
        .catch((falha: unknown) => {
          console.warn('Falha ao devolver a liberação para a fila.', falha);
        });
    };
  }, [id, userCode, mutateAsync]);

  return {
    // `idle` também trava a decisão: entre montar a tela e o efeito disparar a
    // reserva ainda não aconteceu, e decidir aí seria decidir sem reservar.
    reservando: status === 'idle' || status === 'pending',
    erro: error,
    marcarDecidida,
  };
}
