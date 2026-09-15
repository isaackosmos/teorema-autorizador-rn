import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { registrarAparelho } from '@/features/auth/api/auth.api';
import { nomeDoAparelho } from '@/features/auth/lib/aparelho';
import { SessionError } from '@/shared/lib/http/errors';
import { useSessionStore } from '@/shared/stores/session.store';
import { DeviceStatus } from '@/shared/types/session.types';

import type { RegistroAparelhoPayload } from '@/features/auth/schemas/registro-aparelho.schema';

/**
 * Passo 2 do onboarding: registra o aparelho no servidor central e consome
 * uma licença.
 *
 * Sucesso grava `registerId`, a validade e `status = Ativo`, e segue direto
 * para a escolha de empresa — sem a tela "Concluído" com `Sleep(5000)` do
 * original (docs/analise §7.2.13). Recusa de licença **não** é erro: volta em
 * `data.ok === false` com o motivo, e é a tela que decide o que mostrar.
 */
export function useRegistrarAparelho() {
  const router = useRouter();
  const device = useSessionStore((s) => s.device);
  const user = useSessionStore((s) => s.user);
  const setDevice = useSessionStore((s) => s.setDevice);

  return useMutation({
    mutationFn: (input: RegistroAparelhoPayload) => {
      if (!device.companyDocument || !device.companyCode || device.companyId === null) {
        throw new SessionError('Documento da empresa ainda não foi resolvido.');
      }
      if (!device.serverUrlPrimary) {
        throw new SessionError('Endereço do servidor ainda não foi definido.');
      }
      // O servidor exige `userlogin` e `userid`: o registro só existe com um
      // usuário do ERP autenticado (docs/plano-migracao A3/A5).
      if (!user) {
        throw new SessionError('Entre com seu usuário do ERP para registrar o aparelho.');
      }

      return registrarAparelho({
        documento: device.companyDocument,
        companyCode: device.companyCode,
        companyId: device.companyId,
        nomeAparelho: nomeDoAparelho(),
        apelido: input.apelido,
        nomeUsuario: input.nomeUsuario,
        contato: input.contato,
        serverUrlPrimary: device.serverUrlPrimary,
        serverUrlSecondary: device.serverUrlSecondary,
        serverUrlPrint: device.serverUrlPrint,
        userLogin: user.username,
        userId: user.id,
      });
    },
    onSuccess: (resultado) => {
      if (!resultado.ok) return;

      setDevice({
        status: DeviceStatus.Ativo,
        registerId: resultado.registerId,
        registerExpiration: resultado.registerExpiration,
      });

      router.replace('/(auth)/empresa');
    },
  });
}
