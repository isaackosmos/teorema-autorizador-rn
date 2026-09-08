import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';

/** Como o sistema respondeu ao pedido de permissão de notificação. */
export const PermissaoNotificacao = {
  Concedida: 'concedida',
  /** Negada agora; o sistema ainda aceitaria perguntar numa próxima vez. */
  Negada: 'negada',
  /** O sistema não pergunta mais: o único caminho são as Configurações. */
  NegadaDefinitivamente: 'negada-definitivamente',
} as const;

export type PermissaoNotificacao = (typeof PermissaoNotificacao)[keyof typeof PermissaoNotificacao];

/**
 * Pede a permissão **uma vez**, com três saídas e nenhuma chamada a si mesma.
 *
 * O `ExigeNotificacaoHabilitada` do original era recursivo: negou, abria modal
 * e re-solicitava, sem limite (docs/analise §7.2.14). Aqui a função é linear —
 * quem recusa segue usando o app.
 *
 * Não há espera artificial: o `Sleep(1000)` do original existia para "dar
 * tempo" de a permissão resolver, e estas APIs são `Promise`
 * (docs/analise §7.2.13, CLAUDE.md §5.10).
 *
 * Autorização **provisória** do iOS conta como não concedida: ela entrega a
 * notificação em silêncio, direto na central, e aviso de decisão financeira
 * que não interrompe não cumpre o papel (docs/decisao-push.md §6.1).
 */
export async function garantirPermissao(): Promise<PermissaoNotificacao> {
  const atual = await Notifications.getPermissionsAsync();
  if (atual.granted) return PermissaoNotificacao.Concedida;

  // Só pede quando o sistema ainda aceita perguntar. No iOS isso é verdade
  // uma única vez na vida do app; no Android 13+, até a negação definitiva.
  if (!atual.canAskAgain) return PermissaoNotificacao.NegadaDefinitivamente;

  const pedido = await Notifications.requestPermissionsAsync();
  if (pedido.granted) return PermissaoNotificacao.Concedida;

  return pedido.canAskAgain
    ? PermissaoNotificacao.Negada
    : PermissaoNotificacao.NegadaDefinitivamente;
}

/**
 * Abre as Configurações do sistema para o app.
 *
 * É o ramo que o original deixou **vazio**, com o código comentado ("por
 * regras de negócio não posso obrigar 100%" — docs/analise §7.2.14). Não
 * obrigar não é deixar sem caminho.
 *
 * Falhar em abrir não quebra nada: o app segue inteiro sem notificação.
 */
export function abrirConfiguracoesDeNotificacao(): void {
  Linking.openSettings().catch((falha: unknown) => {
    console.warn('[push] não foi possível abrir as Configurações do sistema.', falha);
  });
}
