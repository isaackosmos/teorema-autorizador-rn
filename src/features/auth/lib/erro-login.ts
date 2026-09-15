import { erroLoginSchema, MotivoServidor } from '@/features/auth/schemas/erro-login.schema';
import { ApiError, ContractError, SessionError } from '@/shared/lib/http/errors';

/**
 * Mapa de erro do login: o que falhou vira um motivo, e o motivo vira a
 * mensagem que o formulário mostra.
 *
 * Este é o **único** ponto do app que decide por que o login não passou
 * (plano-migracao.md, ficha A4). O app Delphi espalhava a decisão e a tomava
 * comparando o texto da mensagem, o que virou código morto assim que o
 * servidor mudou a redação (docs/analise §7.1.3): aqui a decisão é por
 * `ApiError.status`, e o genérico é o caminho normal, não o acidente.
 */

export const MotivoLoginFalhou = {
  Rede: 'rede',
  SemServidor: 'sem-servidor',
  Credencial: 'credencial',
  AparelhoSemRegistro: 'aparelho-sem-registro',
  Requisicao: 'requisicao',
  Servidor: 'servidor',
  Contrato: 'contrato',
  Desconhecido: 'desconhecido',
} as const;

export type MotivoLoginFalhou = (typeof MotivoLoginFalhou)[keyof typeof MotivoLoginFalhou];

const MENSAGEM_LOGIN: Record<MotivoLoginFalhou, string> = {
  [MotivoLoginFalhou.Rede]: 'Não foi possível falar com o servidor. Verifique a conexão.',
  // Distinto de `Rede` desde a F1: aqui nem se tentou falar com ninguém, porque
  // o aparelho não tem endereço de tenant resolvido. Enquanto os dois
  // compartilhavam o status 0, isto aparecia como "Verifique a conexão" e
  // mandava o usuário olhar o wi-fi por um problema de configuração
  // (era a dívida D9). Não manda refazer a configuração pelo mesmo motivo da
  // mensagem abaixo: `resolverEtapa` devolveria o usuário ao login (D10).
  [MotivoLoginFalhou.SemServidor]:
    'Este aparelho ainda não tem o servidor configurado. Procure o responsável.',
  [MotivoLoginFalhou.Credencial]: 'Usuário ou senha inválidos.',
  // `cadastro` é sobre o **aparelho**, não sobre o usuário: o `registerid`
  // enviado no login não existe mais no central (docs/analise §3.1, "Aparelho
  // com registro excluído"). A mensagem não manda refazer a configuração
  // porque hoje isso não resolve — nada no app derruba o `registerId` morto
  // (dívida D10 do CLAUDE.md §9). Prometer o caminho seria pior que não tê-lo.
  [MotivoLoginFalhou.AparelhoSemRegistro]:
    'O registro deste aparelho foi removido. Procure o responsável para registrá-lo novamente.',
  [MotivoLoginFalhou.Requisicao]: 'O servidor recusou o login. Confira a base selecionada.',
  [MotivoLoginFalhou.Servidor]: 'O servidor do cliente falhou. Tente novamente em instantes.',
  // Sem "tente novamente": a resposta fora do contrato é determinística e vai
  // chegar igual na segunda vez. É o que o 🔒 B1 vai produzir no dia em que o
  // contrato novo subir com qualquer campo fora do lugar.
  [MotivoLoginFalhou.Contrato]:
    'O servidor respondeu de um jeito que este app não entende. Procure o responsável.',
  [MotivoLoginFalhou.Desconhecido]: 'Não foi possível entrar. Tente novamente.',
};

/**
 * Único lugar do app que **decide** por texto do corpo de erro — dívida D8 do
 * CLAUDE.md §9, que morre quando o 🔒 B4 entregar código de erro estável.
 * (Ler o texto para *exibir* é outra coisa, e mora em `shared`:
 * `extractServerMessage` em `lib/http/errors.ts`.)
 */
function motivoDoCorpo(payload: unknown): MotivoLoginFalhou | null {
  const motivo = erroLoginSchema.safeParse(payload);
  if (!motivo.success) return null;

  // `usuario` e `senha` compartilham a mensagem de propósito: responder
  // "este usuário não existe" entrega a lista de logins válidos a quem tenta
  // adivinhar (docs/decisao-hash-senha.md §3(3), risco R7 — o mesmo que o
  // servidor vai corrigir junto do B4).
  return motivo.data === MotivoServidor.Cadastro
    ? MotivoLoginFalhou.AparelhoSemRegistro
    : MotivoLoginFalhou.Credencial;
}

/**
 * Os três motivos que o **tipo** do erro já decide, antes de qualquer status.
 *
 * Vêm primeiro porque os três têm status que mentiria se lido sozinho:
 * `SessionError` é 4xx e cairia no genérico "o servidor recusou o login" — mas
 * servidor nenhum recusou nada, a requisição não chegou a sair; `ContractError`
 * é 502 e cairia em "tente novamente em instantes", que para payload
 * determinístico é mentira (F3).
 */
function motivoPeloTipo(error: ApiError): MotivoLoginFalhou | null {
  if (error instanceof SessionError) return MotivoLoginFalhou.SemServidor;
  if (error instanceof ContractError) return MotivoLoginFalhou.Contrato;
  if (error.isNetworkError) return MotivoLoginFalhou.Rede;
  return null;
}

/**
 * A entrada é `unknown`, e não `ApiError`, porque o tipo do erro da mutation é
 * asserção do TanStack, não garantia: a checagem abaixo é a defesa real.
 */
export function motivoDoErroDeLogin(error: unknown): MotivoLoginFalhou {
  if (!(error instanceof ApiError)) return MotivoLoginFalhou.Desconhecido;

  const peloTipo = motivoPeloTipo(error);
  if (peloTipo) return peloTipo;

  if (error.status >= 500) return MotivoLoginFalhou.Servidor;

  // 401 é inequivocamente credencial; 400 é requisição malformada, e é assim
  // que uma divergência de contrato chega enquanto o 🔒 B1 não cai. Acusar
  // "usuário ou senha inválidos" aí faria o usuário redigitar para sempre.
  if (error.status === 401) return motivoDoCorpo(error.payload) ?? MotivoLoginFalhou.Credencial;
  if (error.status === 400) return motivoDoCorpo(error.payload) ?? MotivoLoginFalhou.Requisicao;

  if (error.isClientError) return MotivoLoginFalhou.Requisicao;
  return MotivoLoginFalhou.Desconhecido;
}

/** Mensagem única do formulário, vinda do estado do `useMutation`. */
export function mensagemDeErroDeLogin(error: unknown): string {
  return MENSAGEM_LOGIN[motivoDoErroDeLogin(error)];
}
