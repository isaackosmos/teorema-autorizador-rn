import { z } from 'zod';

/**
 * Entrada do passo de registro do aparelho.
 *
 * São os três campos que o original espalhava por duas abas (Identificação e
 * Configuração pessoal) e manda no `POST /v1/application/register`:
 * `devicealias`, `deviceusername` e `usercontact`.
 */
export const registroAparelhoSchema = z.object({
  apelido: z.string().trim().min(1, 'Informe um apelido para este aparelho'),
  nomeUsuario: z.string().trim().min(1, 'Informe o nome do usuário'),
  contato: z
    .string()
    .trim()
    .min(1, 'Informe um telefone de contato')
    .refine((valor) => valor.replace(/\D/g, '').length >= 10, 'Telefone incompleto'),
});

export type RegistroAparelhoInput = z.input<typeof registroAparelhoSchema>;
export type RegistroAparelhoPayload = z.output<typeof registroAparelhoSchema>;

/**
 * Corpo do `POST /v1/application/register`.
 *
 * O schema traduz nos dois sentidos: aqui é o domínio (camelCase) virando os
 * nomes que o endpoint espera, para que nenhum hook nem tela precise conhecer
 * `devicealias` ou `serverurlprimary`.
 *
 * Campos nulos vão como texto vazio porque é assim que o servidor lê
 * (`GetValue<String>(..., '')`) e grava — não há coluna nula do outro lado.
 */
export const registroAparelhoRequestSchema = z
  .object({
    documento: z.string().min(1),
    companyCode: z.string().min(1),
    companyId: z.number(),
    /** Modelo/plataforma do aparelho (era `ObtemIdentificador`). */
    nomeAparelho: z.string().min(1),
    apelido: z.string().min(1),
    nomeUsuario: z.string().min(1),
    contato: z.string().min(1),
    serverUrlPrimary: z.string().min(1),
    serverUrlSecondary: z.string().nullable(),
    serverUrlPrint: z.string().nullable(),
    userLogin: z.string().min(1),
    userId: z.number(),
  })
  .transform((v) => ({
    document: v.documento,
    companycode: v.companyCode,
    companyid: v.companyId,
    devicename: v.nomeAparelho,
    devicealias: v.apelido,
    deviceusername: v.nomeUsuario,
    usercontact: v.contato,
    serverurlprimary: v.serverUrlPrimary,
    serverurlsecondary: v.serverUrlSecondary ?? '',
    serverurlprint: v.serverUrlPrint ?? '',
    userlogin: v.userLogin,
    userid: String(v.userId),
  }));

export type RegistroAparelhoRequest = z.input<typeof registroAparelhoRequestSchema>;
