/** Raiz da feature. Fora deste arquivo ninguém monta array de key à mão. */
const RAIZ = ['liberacoes'] as const;

/**
 * Query keys da feature. Sempre hierárquicas, para invalidar por prefixo:
 * `queryClient.invalidateQueries({ queryKey: liberacoesKeys.all })`.
 *
 * `fila` existe para que dê para invalidar **só a fila**. `all` cobre também
 * `credito` e `historico`, então invalidar por ele refaz a análise de crédito
 * de todo cliente em cache — largo demais quando quem dispara é o servidor,
 * via push (CLAUDE.md §9, dívida D5; docs/decisao-push.md §6.4).
 */
export const liberacoesKeys = {
  all: RAIZ,
  fila: [...RAIZ, 'pendentes'] as const,
  pendentes: (userCode: string) => [...liberacoesKeys.fila, userCode] as const,
  credito: (empresa: string, cliente: string) =>
    [...liberacoesKeys.all, 'credito', empresa, cliente] as const,
  historico: (empresa: string, cliente: string) =>
    [...liberacoesKeys.all, 'historico', empresa, cliente] as const,
};
