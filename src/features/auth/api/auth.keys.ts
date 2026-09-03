/**
 * Query keys da feature. Hierárquicas, para invalidar por prefixo:
 * `queryClient.invalidateQueries({ queryKey: authKeys.all })`.
 */
export const authKeys = {
  all: ['auth'] as const,
  bases: (documento: string) => [...authKeys.all, 'bases', documento] as const,
};
