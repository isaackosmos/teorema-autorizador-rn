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
  /**
   * Campos declarados e atribuídos no corpo do construtor, e **não** como
   * parameter properties (`constructor(readonly status: number, …)`): o
   * type-stripping do Node recusa essa sintaxe com
   * `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`, e é ele que roda `npm test` e o
   * `probe-orion`. Encolher isso de volta quebra os dois — o comportamento é
   * idêntico, só a sintaxe é que não sobrevive fora do Babel.
   */
  readonly status: number;
  readonly payload?: unknown;

  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
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

/**
 * Resposta **2xx que o schema recusou**: o servidor respondeu, e é a resposta
 * que está fora do contrato. Status 502 porque a falha é do outro lado.
 *
 * É um `ApiError` para a tela seguir decidindo por `status` (CLAUDE.md §4.1), e
 * é classe própria por causa do retry: payload malformado é determinístico, e
 * repetir a requisição só reproduz o mesmo corpo — cada consulta com contrato
 * quebrado virava três idas ao servidor (CLAUDE.md §9, dívida D12). Quem lê
 * essa distinção é `shared/config/query-client`.
 *
 * **Não é o mesmo que o 404 fabricado** de `buscarEmpresaLicenciada`: ali o
 * corpo vazio é o protocolo documentado do Orion para "não encontrado"
 * (docs/analise §7.1.8) — tem significado de negócio e não é desacordo de
 * contrato. Os dois casos continuam separados de propósito.
 */
export class ContractError extends ApiError {
  constructor(message: string, payload?: unknown) {
    super(502, message, payload);
    this.name = 'ContractError';
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
