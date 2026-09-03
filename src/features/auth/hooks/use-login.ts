import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { login } from '@/features/auth/api/auth.api';
import { useHistoricoUsuariosStore } from '@/features/auth/stores/historico-usuarios.store';
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
  const device = useSessionStore((s) => s.device);
  const setUser = useSessionStore((s) => s.setUser);
  const setDevice = useSessionStore((s) => s.setDevice);
  const registrarAcesso = useHistoricoUsuariosStore((s) => s.registrarAcesso);

  return useMutation({
    // O aparelho pode não estar registrado ainda: é este login que autoriza o
    // registro (o servidor central exige `userlogin`/`userid`), e a API omite
    // o `registerid` quando ele não existe — igual ao original.
    mutationFn: (payload: LoginPayload) => login(payload, device.registerId),
    onSuccess: ({ deviceStatus, ...usuario }, payload) => {
      // O servidor aceitou o login: ele entra no histórico mesmo que o
      // aparelho esteja bloqueado — quem digitou não tem culpa da licença.
      // Vai só o username; a senha não é gravada em lugar nenhum (§7.1.9).
      registrarAcesso(payload.username);

      if (deviceStatus === DeviceStatus.Bloqueado) {
        setDevice({ status: DeviceStatus.Bloqueado });
        return;
      }

      // O login digitado é o `userlogin` do registro do aparelho. A senha
      // nunca entra na sessão (docs/analise §7.1.9).
      setUser({ ...usuario, username: payload.username });

      router.replace(
        device.status === DeviceStatus.Ativo ? '/(auth)/empresa' : '/(auth)/configuracao',
      );
    },
  });
}
