import type { RegistroResultado } from '@/features/auth/schemas/auth.schema';

/** Passos da rota de configuração, na ordem em que aparecem. */
export type EtapaConfiguracao = 'conexao' | 'login' | 'registro' | 'licenca';

interface ContextoEtapa {
  /** O usuário pediu para rever a conexão (ou ela ainda não foi resolvida). */
  emConexao: boolean;
  temUsuario: boolean;
  resultado: RegistroResultado | undefined;
  /** `DEVICE_STATUS = 2` persistido pelo login (docs/analise §3.1). */
  bloqueado: boolean;
}

/**
 * Decide o passo visível. Fica fora da tela para a decisão ser uma só e não
 * virar ternário empilhado no JSX — no original ela estava espalhada por seis
 * `TabControlPrincipal.ActiveTab :=` em pontos diferentes do form.
 */
export function resolverEtapa({
  emConexao,
  temUsuario,
  resultado,
  bloqueado,
}: ContextoEtapa): EtapaConfiguracao {
  // Rever a conexão vem antes de tudo: é o único passo que continua útil
  // quando a licença foi recusada.
  if (emConexao) return 'conexao';
  // Aparelho bloqueado não tenta registrar de novo — consumiria outra licença.
  if (bloqueado || (resultado && !resultado.ok)) return 'licenca';
  return temUsuario ? 'registro' : 'login';
}
