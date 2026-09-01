import { Redirect } from 'expo-router';

import { useSessionStore } from '@/shared/stores/session.store';
import { DeviceStatus } from '@/shared/types/session.types';

/**
 * Ponto de entrada: decide para onde ir a partir da sessão persistida.
 *
 * O app Delphi gastava ~10 s em `Sleep` artificial antes do primeiro uso
 * (docs/analise §7.2.13). Como o MMKV é síncrono, a decisão é imediata.
 */
export default function Index() {
  const device = useSessionStore((s) => s.device);
  const user = useSessionStore((s) => s.user);
  const company = useSessionStore((s) => s.company);

  if (device.status === DeviceStatus.NaoRegistrado) {
    return <Redirect href="/(auth)/documento" />;
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!company) {
    return <Redirect href="/(auth)/empresa" />;
  }

  return <Redirect href="/(app)/menu" />;
}
