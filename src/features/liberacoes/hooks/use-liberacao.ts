import { useQuery } from '@tanstack/react-query';

import { liberacoesPendentesOptions } from '@/features/liberacoes/hooks/use-liberacoes-pendentes';
import { useCurrentUser } from '@/shared/stores/session.store';

/**
 * Uma liberação da fila, para a tela de análise.
 *
 * O Orion não expõe rota de item: `searchpending` é a única fonte, e a tela de
 * análise recorta o mesmo cache com `select` em vez de buscar de novo. Fora da
 * fila (já decidida por outro, ou aberta por link antigo) o resultado é `null`
 * — nunca um objeto meio preenchido.
 */
export function useLiberacao(id: string) {
  const user = useCurrentUser();

  return useQuery({
    ...liberacoesPendentesOptions(user?.code ?? null),
    select: (fila) => fila.find((liberacao) => liberacao.id === id) ?? null,
  });
}
