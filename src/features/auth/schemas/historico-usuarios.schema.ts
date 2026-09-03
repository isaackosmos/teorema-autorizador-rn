import { z } from 'zod';

/**
 * Histórico de logins deste aparelho — sucessor da tabela `LOGIN_HISTORY` do
 * SQLite do app Delphi (docs/analise §4.1).
 *
 * São dois campos, e a lista do que **não** está aqui é a parte importante: o
 * original guardava a senha em texto claro no mesmo banco e a recarregava no
 * splash (docs/analise §7.1.9). Nada além do login digitado e da data do
 * último acesso é gravado — o histórico existe para não redigitar o usuário.
 *
 * O `USER_CODE` do original também ficou de fora: quem resolve o código do
 * usuário é o `/v1/auth/login`, não o disco.
 */
export const usuarioRecenteSchema = z.object({
  /** Mesmo formato do `loginSchema`: o Orion espera o login em maiúsculas. */
  username: z.string().trim().min(1).toUpperCase(),
  /** ISO 8601. Só ordena e informa a lista; não vale como sessão. */
  ultimoAcesso: z.iso.datetime(),
});

/**
 * A lista como ela volta do MMKV. Disco escrito por uma versão anterior do
 * app não é confiável, então a leitura valida — e, porque o Zod remove chave
 * desconhecida, um campo de senha gravado por qualquer outra versão morre
 * aqui, na borda, em vez de chegar à tela.
 */
export const historicoUsuariosSchema = z.array(usuarioRecenteSchema);

export type UsuarioRecente = z.output<typeof usuarioRecenteSchema>;
