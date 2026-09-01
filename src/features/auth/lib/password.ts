/**
 * Preparo da senha para o `POST /v1/auth/login`.
 *
 * A senha vai **em texto puro sobre TLS** e todo o hash é responsabilidade do
 * Orion (Argon2id/bcrypt, do lado que guarda o dado). O app não faz nenhuma
 * transformação criptográfica.
 *
 * Decisão registrada em `docs/decisao-hash-senha.md` (bloqueio B1). O motivo de
 * não hashear aqui: no contrato antigo o servidor aceitava o MD5 pronto, então
 * o digest *era* a credencial — hashear no cliente é pass-the-hash, não
 * proteção. Ver §3(2) e a opção C da tabela de alternativas.
 *
 * A função é mantida — em vez de `auth.api.ts` mandar `payload.password` direto —
 * para que a decisão fique explícita no código e para haver um único ponto de
 * mudança se o contrato do servidor mudar de novo.
 */
export function preparePassword(password: string): string {
  return password;
}
