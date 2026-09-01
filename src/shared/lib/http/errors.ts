import { isAxiosError } from 'axios';

/**
 * Erro normalizado de API.
 *
 * O app Delphi comparava a *mensagem* de erro por string
 * (`sMotivo = 'Erro ao requisitar servidor 400'`), o que virou código morto
 * assim que o servidor passou a devolver `{"erro": "..."}`
 * (docs/analise §7.1.3). Aqui a decisão é sempre por `status`.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly payload?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** 4xx: erro de negócio/entrada — não adianta repetir a requisição. */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /** Sem resposta do servidor: offline, DNS, timeout. */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

/** Extrai a mensagem que o Orion manda no corpo do erro. */
function extractServerMessage(payload: unknown): string | undefined {
  if (typeof payload === 'string' && payload.trim() !== '') return payload;
  if (payload && typeof payload === 'object') {
    const body = payload as Record<string, unknown>;
    for (const key of ['erro', 'mensagem', 'message', 'error'] as const) {
      const value = body[key];
      if (typeof value === 'string' && value.trim() !== '') return value;
    }
  }
  return undefined;
}

/** Converte qualquer coisa lançada por um cliente HTTP em `ApiError`. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (isAxiosError(error)) {
    const status = error.response?.status ?? 0;
    const message =
      extractServerMessage(error.response?.data) ??
      (status === 0
        ? 'Não foi possível falar com o servidor. Verifique a conexão.'
        : `Erro ao requisitar servidor (${status}).`);

    return new ApiError(status, message, error.response?.data);
  }

  return new ApiError(0, error instanceof Error ? error.message : 'Erro inesperado.');
}
