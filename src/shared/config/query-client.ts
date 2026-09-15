import { QueryClient } from '@tanstack/react-query';

import { ApiError, ContractError } from '@/shared/lib/http/errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      // Repetir um 4xx só reproduz o mesmo erro de negócio; repetir uma
      // resposta fora do contrato só reproduz o mesmo payload malformado, que
      // é determinístico (CLAUDE.md §9, dívida D12). Nos dois casos a segunda
      // ida ao servidor é desperdício, e a terceira também.
      retry: (failureCount, error) => {
        if (error instanceof ContractError) return false;
        if (error instanceof ApiError && error.isClientError) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
