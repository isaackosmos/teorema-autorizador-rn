import { z } from 'zod';

/**
 * Variáveis de ambiente do app.
 *
 * O Metro só substitui `process.env.EXPO_PUBLIC_X` quando o acesso é literal —
 * por isso o objeto abaixo é montado à mão, sem loop nem índice dinâmico.
 *
 * Tudo que tem prefixo `EXPO_PUBLIC_` vai para dentro do bundle e é legível por
 * quem descompactar o APK/IPA. Não coloque segredo de verdade aqui.
 */
const envSchema = z.object({
  /** Servidor central da Teorema: licença, registro de aparelho e push. */
  centralApiUrl: z.url(),
  /** Código do sistema no licenciamento (era `uAppConts.CodigoSistema`). */
  systemCode: z.string().min(1),
  /** Token do servidor central. Compilado no bundle — ver aviso acima. */
  centralApiToken: z.string().min(1),
  /** Timeout padrão das requisições HTTP, em milissegundos. */
  httpTimeoutMs: z.coerce.number().int().positive(),
});

const parsed = envSchema.safeParse({
  centralApiUrl: process.env.EXPO_PUBLIC_CENTRAL_API_URL,
  systemCode: process.env.EXPO_PUBLIC_SYSTEM_CODE,
  centralApiToken: process.env.EXPO_PUBLIC_CENTRAL_API_TOKEN,
  httpTimeoutMs: process.env.EXPO_PUBLIC_HTTP_TIMEOUT_MS,
});

if (!parsed.success) {
  throw new Error(
    `Configuração de ambiente inválida. Copie .env.example para .env.local e preencha:\n${z.prettifyError(parsed.error)}`,
  );
}

export const env = parsed.data;
