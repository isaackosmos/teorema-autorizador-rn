import { z } from 'zod';

import { orionDateToIso } from '@/shared/lib/format/date';

/**
 * Respostas do Orion vêm com os nomes das colunas do Firebird
 * (SCREAMING_SNAKE). Todo payload é traduzido para camelCase aqui, na borda —
 * nenhuma tela enxerga nome de coluna do ERP.
 */

export const loginResponseSchema = z
  .object({
    // O Orion devolve o JWT num campo chamado `TOKEN` — não é typo, não
    // "corrija" para `JWT`. Da borda para dentro o nome do domínio é `jwt`.
    TOKEN: z.string(),
    USUARIO_ID: z.coerce.number(),
    USUARIO_CODIGO: z.string(),
    USUARIO_NOME: z.string().nullish(),
    DEVICE_STATUS: z.coerce.number().nullish(),
  })
  .transform((raw) => ({
    jwt: raw.TOKEN,
    id: raw.USUARIO_ID,
    code: raw.USUARIO_CODIGO.padStart(3, '0'),
    name: raw.USUARIO_NOME ?? '',
    deviceStatus: raw.DEVICE_STATUS ?? null,
  }));

export type LoginResponse = z.output<typeof loginResponseSchema>;

const optionalText = z
  .string()
  .nullish()
  .transform((value) => value?.trim() || null);

/**
 * `GET /v1/application/companyinformation` — empresa **licenciada** para o par
 * documento + `systemcode` (≠ empresa corrente escolhida no login).
 *
 * O código e o id voltam para o servidor central no registro do aparelho
 * (`companycode` / `companyid`, docs/analise §3.1 e §5.1).
 */
export const empresaLicenciadaSchema = z
  .object({
    CLIFOR_CODIGO: z.coerce.string(),
    CLIFOR_ID: z.coerce.number(),
  })
  .transform((raw) => ({
    code: raw.CLIFOR_CODIGO,
    id: raw.CLIFOR_ID,
  }));

export type EmpresaLicenciada = z.output<typeof empresaLicenciadaSchema>;

/**
 * `GET /v1/application/getserverurl` — endereços do tenant.
 *
 * Só o primário é obrigatório: sem ele não há o que testar no ping (A3).
 * O secundário alimenta o fallback e o de impressão não é usado por este app,
 * mas é gravado porque o registro do aparelho o devolve ao servidor.
 */
export const enderecosServidorSchema = z
  .object({
    SERVER_URL_PRIMARY: z.string().trim().min(1),
    SERVER_URL_SECONDARY: optionalText,
    SERVER_URL_PRINT: optionalText,
  })
  .transform((raw) => ({
    primary: raw.SERVER_URL_PRIMARY,
    secondary: raw.SERVER_URL_SECONDARY,
    print: raw.SERVER_URL_PRINT,
  }));

export type EnderecosServidor = z.output<typeof enderecosServidorSchema>;

/**
 * `GET /v1/auth/setup/{documento}` — bases que o tenant expõe para o
 * documento. O `token` identifica a base no header `tokendatabase`.
 */
export const baseDadosSchema = z
  .object({
    DB_TOKEN: z.string().min(1),
    CUSTOMER_NAME: optionalText,
  })
  .transform((raw) => ({
    token: raw.DB_TOKEN,
    nome: raw.CUSTOMER_NAME,
  }));

export const baseDadosListSchema = z.array(baseDadosSchema);

export type BaseDados = z.output<typeof baseDadosSchema>;

/**
 * Motivo de recusa do registro. O servidor central responde **200 com uma
 * palavra em texto puro** nesses três casos (docs/analise §3.1) — não é erro
 * HTTP, é resposta de negócio, e é o que alimenta o estado de erro de licença.
 */
export const MotivoLicenca = {
  Bloqueado: 'bloqueado',
  SemLicencas: 'licencas',
  DemoExpirada: 'demo',
} as const;

export type MotivoLicenca = (typeof MotivoLicenca)[keyof typeof MotivoLicenca];

/**
 * `POST /v1/application/register` — ou o registro nasce (`{id, expiration}`),
 * ou vem o motivo da recusa. O resultado é uma união discriminada: quem chama
 * decide por `ok`, sem comparar texto solto.
 */
export const registroResultadoSchema = z.union([
  z
    .enum([MotivoLicenca.Bloqueado, MotivoLicenca.SemLicencas, MotivoLicenca.DemoExpirada])
    .transform((motivo) => ({ ok: false as const, motivo })),
  z
    .object({
      id: z.coerce.number(),
      expiration: optionalText,
    })
    .transform((raw) => ({
      ok: true as const,
      registerId: raw.id,
      // Demo tem validade; licença paga vem sem `expiration`.
      registerExpiration: orionDateToIso(raw.expiration),
    })),
]);

export type RegistroResultado = z.output<typeof registroResultadoSchema>;
