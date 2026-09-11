import { z } from 'zod';

/**
 * Corpo de erro do `POST /v1/auth/login`.
 *
 * O controller do Orion devolve `{"erro": "<motivo>"}` no 400 (docs/analise
 * §7.1.3), e os três motivos que o login usa estão em docs/analise §3.1:
 * `usuario` ("Usuário não encontrado"), `senha` ("Senha não confere") e
 * `cadastro` ("Aparelho com registro excluído").
 *
 * É o que hoje separa o aparelho sem registro de uma credencial inválida — os
 * dois chegam com o mesmo status enquanto o servidor não devolver código
 * estável (🔒 B4 do plano de migração).
 *
 * O corpo vem da rede, então entra como desconhecido e é validado aqui em vez
 * de lido por cast. Quem chama usa `safeParse`: corpo fora deste contrato não é
 * erro, é o caminho genérico do mapeamento (`lib/erro-login.ts`). O motivo é
 * normalizado antes de comparar porque nada disso foi visto contra servidor
 * real ainda (🔒 B1) — caixa ou espaço sobrando não podem custar a mensagem.
 */
export const MotivoServidor = {
  Usuario: 'usuario',
  Senha: 'senha',
  Cadastro: 'cadastro',
} as const;

export type MotivoServidor = (typeof MotivoServidor)[keyof typeof MotivoServidor];

export const erroLoginSchema = z
  .object({
    erro: z
      .string()
      .transform((valor) => valor.trim().toLowerCase())
      .pipe(z.enum([MotivoServidor.Usuario, MotivoServidor.Senha, MotivoServidor.Cadastro])),
  })
  .transform((raw) => raw.erro);
