import { Redirect } from 'expo-router';

import { useRegistroExpirado } from '@/features/auth/hooks/use-registro-expirado';
import { useSessionStore } from '@/shared/stores/session.store';
import { DeviceStatus } from '@/shared/types/session.types';

/**
 * Ponto de entrada: decide para onde ir a partir da sessão persistida.
 *
 * O app Delphi gastava ~10 s em `Sleep` artificial antes do primeiro uso
 * (docs/analise §7.2.13). Como o MMKV é síncrono, a decisão é imediata.
 *
 * A ordem segue o onboarding: documento → configuração (conexão + registro) →
 * login → empresa. O login aparece no meio quando o aparelho ainda não está
 * registrado, porque o registro da licença exige um usuário do ERP — a mesma
 * ordem do original (docs/plano-migracao A3/A5).
 */
export default function Index() {
  const device = useSessionStore((s) => s.device);
  const user = useSessionStore((s) => s.user);
  const company = useSessionStore((s) => s.company);
  const registroExpirado = useRegistroExpirado();

  if (!device.companyDocument) {
    return <Redirect href="/(auth)/documento" />;
  }

  if (registroExpirado || device.status !== DeviceStatus.Ativo) {
    return <Redirect href="/(auth)/configuracao" />;
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!company) {
    return <Redirect href="/(auth)/empresa" />;
  }

  return <Redirect href="/(app)/menu" />;
}
