import { useEffect } from 'react';

import { isRegistroExpirado } from '@/features/auth/lib/licenca';
import { useSessionStore } from '@/shared/stores/session.store';
import { DeviceStatus } from '@/shared/types/session.types';

/**
 * Licença/demo vencida derruba o registro do aparelho.
 *
 * A regra é do original (`PreparaLogin`, docs/analise §3.1): passada a
 * validade, `DEVICE_STATUS` volta a `0` e o registro é refeito. O retorno é
 * síncrono para o roteamento não piscar; a gravação acontece depois, uma vez.
 */
export function useRegistroExpirado(): boolean {
  const status = useSessionStore((s) => s.device.status);
  const registerExpiration = useSessionStore((s) => s.device.registerExpiration);
  const setDevice = useSessionStore((s) => s.setDevice);

  const expirado = isRegistroExpirado(registerExpiration);

  useEffect(() => {
    if (expirado && status !== DeviceStatus.NaoRegistrado) {
      setDevice({ status: DeviceStatus.NaoRegistrado });
    }
  }, [expirado, status, setDevice]);

  return expirado;
}
