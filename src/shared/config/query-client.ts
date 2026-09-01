import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/shared/lib/http/errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      // Repetir um 4xx só reproduz o mesmo erro de negócio.
      retry: (failureCount, error) =>
        error instanceof ApiError && error.isClientError ? false : failureCount < 2,
    },
    mutations: {
      retry: false,
    },
  },
});
