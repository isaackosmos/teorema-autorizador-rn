import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { login } from '@/features/auth/api/auth.api';
import { useSessionStore } from '@/shared/stores/session.store';
import { DeviceStatus } from '@/shared/types/session.types';

import type { LoginPayload } from '@/features/auth/schemas/login.schema';

/**
 * Login no servidor do tenant.
 *
 * O hook orquestra (mutation + sessão + navegação); a chamada HTTP e a
 * tradução do payload ficam na camada de API/schema.
 */
export function useLogin() {
  const router = useRouter();
  const registerId = useSessionStore((s) => s.device.registerId);
  const setUser = useSessionStore((s) => s.setUser);
  const setDevice = useSessionStore((s) => s.setDevice);

  return useMutation({
    mutationFn: (payload: LoginPayload) => {
      if (registerId === null) {
        throw new Error('Aparelho ainda não registrado.');
      }
      return login(payload, registerId);
    },
    onSuccess: ({ deviceStatus, ...user }) => {
      if (deviceStatus === DeviceStatus.Bloqueado) {
        setDevice({ status: DeviceStatus.Bloqueado });
        return;
      }

      setUser(user);
      router.replace('/(auth)/empresa');
    },
  });
}
