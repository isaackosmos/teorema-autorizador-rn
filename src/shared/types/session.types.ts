/** Situação do aparelho no licenciamento (era `DEVICE_INFO.DEVICE_STATUS`). */
export const DeviceStatus = {
  NaoRegistrado: 0,
  Ativo: 1,
  Bloqueado: 2,
} as const;

export type DeviceStatus = (typeof DeviceStatus)[keyof typeof DeviceStatus];

/** Dados de licenciamento/registro do aparelho, resolvidos no servidor central. */
export interface Device {
  status: DeviceStatus;
  /** CNPJ/CPF da empresa licenciada. */
  companyDocument: string | null;
  /** Código da empresa licenciada (`CLIFOR_CODIGO`); vai no registro do aparelho. */
  companyCode: string | null;
  /** Id da empresa licenciada (`CLIFOR_ID`); vai no registro do aparelho. */
  companyId: number | null;
  /** Id do registro deste aparelho no servidor central. */
  registerId: number | null;
  /** Identifica a base do tenant; vai no header `tokendatabase` do login. */
  tokenDatabase: string | null;
  serverUrlPrimary: string | null;
  serverUrlSecondary: string | null;
  serverUrlPrint: string | null;
  /** URL que respondeu ao `/v1/ping` — é a usada em todas as chamadas. */
  serverUrlActive: string | null;
  /** Validade da licença/demo, ISO 8601. */
  registerExpiration: string | null;
}

/** Usuário logado no servidor do tenant. */
export interface User {
  jwt: string;
  id: number;
  /** Sempre 3 dígitos, com zero à esquerda. */
  code: string;
  name: string;
}

/** Empresa escolhida após o login (≠ empresa licenciada). */
export interface Company {
  id: number;
  code: string;
  name: string;
}
