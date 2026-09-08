import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Canal Android das notificações deste app.
 *
 * O mesmo id vai no `defaultChannel` do plugin `expo-notifications` no
 * `app.json`: é ele que o FCM usa quando a mensagem não nomeia canal.
 */
export const CANAL_PADRAO = 'liberacoes';

/**
 * Cria o canal antes de qualquer token ser pedido.
 *
 * Canal é obrigatório desde o Android 8, e a ordem importa: a documentação do
 * Expo é explícita de que `setNotificationChannelAsync()` vem **antes** de
 * `getDevicePushTokenAsync()` (docs/decisao-push.md §7, armadilha 1).
 *
 * No iOS não existe canal — sair cedo é mais honesto do que confiar no `null`
 * que a função devolveria.
 */
export async function garantirCanalAndroid(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(CANAL_PADRAO, {
    name: 'Liberações',
    description: 'Avisos de liberação pendente e de autorização de cotação.',
    // Decisão que espera resposta interrompe: é o ponto do aviso.
    importance: Notifications.AndroidImportance.HIGH,
  });
}
