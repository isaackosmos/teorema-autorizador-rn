/**
 * Preparo da senha para o `POST /v1/auth/login`.
 *
 * PENDENTE — decisão de servidor. O Orion hoje espera a senha em MD5 puro,
 * sem salt (docs/analise §7.1.9). Migrar o app sem migrar o servidor só
 * reproduziria a falha, então esta função ainda não tem implementação.
 *
 * Quando a decisão sair, só este arquivo muda:
 *  - se o servidor passar a aceitar a senha em claro sobre TLS + hash forte no
 *    backend (recomendado), devolva `password` direto;
 *  - se o MD5 for mantido no curto prazo, implemente o digest aqui.
 */
export function preparePassword(_password: string): string {
  throw new Error(
    'Hash de senha ainda não definido — ver src/features/auth/lib/password.ts e CLAUDE.md (Decisões em aberto).',
  );
}
