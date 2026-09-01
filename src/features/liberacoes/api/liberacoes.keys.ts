/**
 * Query keys da feature. Sempre hierárquicas, para invalidar por prefixo:
 * `queryClient.invalidateQueries({ queryKey: liberacoesKeys.all })`.
 */
export const liberacoesKeys = {
  all: ['liberacoes'] as const,
  pendentes: (userCode: string) => [...liberacoesKeys.all, 'pendentes', userCode] as const,
  credito: (empresa: string, cliente: string) =>
    [...liberacoesKeys.all, 'credito', empresa, cliente] as const,
  historico: (empresa: string, cliente: string) =>
    [...liberacoesKeys.all, 'historico', empresa, cliente] as const,
};
