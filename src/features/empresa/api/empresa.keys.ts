/**
 * Query keys da feature. Hierárquicas, para invalidar por prefixo:
 * `queryClient.invalidateQueries({ queryKey: empresaKeys.all })`.
 */
export const empresaKeys = {
  all: ['empresa'] as const,
  logo: (codeCompany: string) => [...empresaKeys.all, 'logo', codeCompany] as const,
};
