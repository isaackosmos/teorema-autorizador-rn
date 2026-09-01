import { z } from 'zod';

/** Entrada da tela de login. */
export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, 'Informe o usuário')
    // O Orion espera o login em maiúsculas.
    .transform((value) => value.toUpperCase()),
  password: z.string().min(1, 'Informe a senha'),
});

export type LoginInput = z.input<typeof loginSchema>;
export type LoginPayload = z.output<typeof loginSchema>;
