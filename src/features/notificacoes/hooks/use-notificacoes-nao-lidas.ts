import { skipToken, useQuery } from '@tanstack/react-query';

import { notificacoesKeys } from '@/features/notificacoes/api/notificacoes.keys';
import { useCurrentUser } from '@/shared/stores/session.store';

/**
 * Quantidade exibida no badge do cabeçalho.
 *
 * Sai do **cache** da query de notificações, não de contador em variável
 * global: no app Delphi o badge era um `TLabel` com o texto `'0'` fixo no
 * `.fmx`, que nenhum código atualizava (docs/analise §7.2.11, plano B1).
 *
 * `skipToken` desliga o fetch enquanto o servidor não tem endpoint de
 * notificações (plano E2) — o hook só observa o cache. Cache vazio é badge
 * ausente, nunca um zero decorativo nem dado inventado. O formato do item da
 * lista é do Bloco E; aqui só a contagem importa, então o tipo fica `unknown[]`.
 */
export function useNotificacoesNaoLidas(): number {
  const user = useCurrentUser();

  const { data } = useQuery<unknown[], Error, number>({
    queryKey: notificacoesKeys.lista(user?.code ?? ''),
    queryFn: skipToken,
    select: (notificacoes) => notificacoes.length,
  });

  return data ?? 0;
}
