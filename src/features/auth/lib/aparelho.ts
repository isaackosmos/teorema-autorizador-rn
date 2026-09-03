import { Platform } from 'react-native';

/**
 * Nome do aparelho enviado no registro (era `ObtemIdentificador`, que
 * devolvia `'Android ' + Build.MODEL`).
 *
 * É rótulo, não identidade: o servidor grava em `REGISTER.DEVICE_NAME` e nada
 * decide por ele. Por isso sai do que o React Native já expõe em
 * `Platform.constants`, sem instalar `expo-device` — trocar a fonte mexe só
 * aqui.
 */
export function nomeDoAparelho(): string {
  if (Platform.OS === 'android') {
    const { Model, Release } = Platform.constants;
    return `Android ${Release} ${Model}`.trim();
  }

  if (Platform.OS === 'ios') {
    const { systemName, osVersion } = Platform.constants;
    return `${systemName} ${osVersion}`.trim();
  }

  return Platform.OS;
}
