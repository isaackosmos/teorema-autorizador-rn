import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { registrarTokenPush } from '@/features/push/api/push.api';
import { garantirCanalAndroid } from '@/features/push/lib/canal-notificacao';
import { garantirPermissao, PermissaoNotificacao } from '@/features/push/lib/permissao-notificacao';
import { ApiError } from '@/shared/lib/http/errors';

/**
 * Em que pé ficou a última tentativa de registrar este aparelho para push.
 *
 * São estados distintos de propósito: permissão concedida, token obtido e push
 * entregue são três falhas diferentes, e uma flag só ("push ok") esconderia
 * qual delas aconteceu (docs/decisao-push.md §7, armadilha 6).
 */
export const EstadoPush = {
  Registrado: 'registrado',
  /** Emulador ou simulador: não existe token a pedir. */
  SemAparelhoFisico: 'sem-aparelho-fisico',
  PermissaoNegada: 'permissao-negada',
  PermissaoNegadaDefinitivamente: 'permissao-negada-definitivamente',
} as const;

export type EstadoPush = (typeof EstadoPush)[keyof typeof EstadoPush];

/**
 * Permissão → token nativo → `tokenpush`, nesta ordem.
 *
 * O `registerId` é pré-requisito, não detalhe: o endpoint guarda o par
 * `{register_id, push_token}` (docs/analise §5.2), então o registro do
 * aparelho (plano A5) vem antes.
 *
 * Reenviar o token a cada abertura autenticada é de propósito: ele muda em
 * reinstalação, restauração de backup, limpeza de dados e rotação do FCM, e
 * descobrir isso pelo aparelho mudo é caro (docs/decisao-push.md §7,
 * armadilha 4).
 */
export async function registrarAparelhoParaPush(registerId: number): Promise<EstadoPush> {
  // Emulador e simulador não têm token: `getDevicePushTokenAsync()` falha e
  // não é falha de código (docs/decisao-push.md §8, achado 3). Sair aqui evita
  // que todo desenvolvimento veja um erro que não existe em aparelho.
  if (!Device.isDevice) return EstadoPush.SemAparelhoFisico;

  // Canal antes do token — a ordem é exigência do Android (armadilha 1).
  await garantirCanalAndroid();

  const permissao = await garantirPermissao();
  if (permissao === PermissaoNotificacao.Negada) return EstadoPush.PermissaoNegada;
  if (permissao === PermissaoNotificacao.NegadaDefinitivamente) {
    return EstadoPush.PermissaoNegadaDefinitivamente;
  }

  const token = await Notifications.getDevicePushTokenAsync();

  // `DevicePushToken.data` é `string` no Android e no iOS, mas o tipo é união
  // com o token web (um objeto). Estreitar aqui mantém o `any` da união fora
  // do código (CLAUDE.md §5.12) sem inventar um cast.
  if (typeof token.data !== 'string' || token.data === '') {
    throw new ApiError(0, 'O sistema devolveu um token de push em formato inesperado.');
  }

  await registrarTokenPush({ registerId, token: token.data });

  return EstadoPush.Registrado;
}
