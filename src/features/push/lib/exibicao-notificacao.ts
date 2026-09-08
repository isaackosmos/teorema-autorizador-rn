import * as Notifications from 'expo-notifications';

/**
 * Como a notificação aparece com o app já aberto.
 *
 * Precisa ser chamado no boot, antes de qualquer notificação chegar: sem
 * handler, o padrão do `expo-notifications` é **não** mostrar nada.
 *
 * `shouldShowAlert` está deprecado na 57.0.17 e os quatro campos abaixo são
 * obrigatórios — não é só trocar o nome do campo (docs/decisao-push.md §4.1).
 *
 * `shouldSetBadge: false` porque o badge do app é o mesmo cache da tela de
 * notificações (CLAUDE.md §4.4), e ele ainda não tem fonte de dados no
 * servidor (plano E2). Contador que o push escreve por fora seria o zero
 * decorativo do original de volta (docs/analise §7.2.11).
 */
export function configurarExibicaoEmForeground(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}
