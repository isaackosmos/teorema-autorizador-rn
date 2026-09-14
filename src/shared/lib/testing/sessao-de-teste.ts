import { limparNavegacoes } from '@/shared/lib/testing/stubs/expo-router';
import { limparArmazenamento } from '@/shared/lib/testing/stubs/react-native-mmkv';
import { useSessionStore } from '@/shared/stores/session.store';
import { DeviceStatus } from '@/shared/types/session.types';

import type { Device, User } from '@/shared/types/session.types';

/**
 * Sessão pronta para exercitar um hook sem passar pelo onboarding inteiro — é
 * o `useSessionStore.getState().setDevice({ … })` que o CLAUDE.md §1
 * ("Pré-requisitos de runtime") já recomenda, embalado para o teste.
 *
 * `serverUrlActive` **precisa** estar preenchido: sem ele o interceptor de
 * request do `tenantApi` recusa a chamada antes de sair, e o teste mediria a
 * guarda em vez do hook.
 */

const APARELHO_ATIVO: Device = {
  status: DeviceStatus.Ativo,
  companyDocument: '11.222.333/0001-81',
  companyCode: '1',
  companyId: 42,
  registerId: 7,
  tokenDatabase: 'tok-base',
  serverUrlPrimary: 'https://tenant.teste',
  serverUrlSecondary: null,
  serverUrlPrint: null,
  serverUrlActive: 'https://tenant.teste',
  registerExpiration: null,
};

const USUARIO_LOGADO: User = {
  jwt: 'jwt-de-teste',
  id: 7,
  username: 'FULANO',
  code: '005',
  name: 'Fulano de Tal',
};

/**
 * Zera o que é de `shared/`: a sessão, o disco falso e as navegações.
 *
 * **Store de feature não é zerado aqui** — `historico-usuarios.store` é de
 * `features/auth`, e `shared/` não importa de `features/` (§2). O disco some
 * junto, mas o estado em memória de um store de feature é responsabilidade do
 * teste daquela feature (ver o `afterEach` de `use-login.test.ts`).
 */
export function limparSessao(): void {
  useSessionStore.setState({
    device: { ...APARELHO_ATIVO, status: DeviceStatus.NaoRegistrado, serverUrlActive: null },
    user: null,
    company: null,
    online: true,
  });
  limparArmazenamento();
  limparNavegacoes();
}

/** Aparelho registrado e endereço resolvido, mas **sem** usuário logado. */
export function comAparelhoAtivo(patch: Partial<Device> = {}): void {
  limparSessao();
  useSessionStore.setState({ device: { ...APARELHO_ATIVO, ...patch } });
}

/** Aparelho ativo + usuário logado: o estado de quem já está dentro do app. */
export function comUsuarioLogado(patch: Partial<User> = {}): User {
  comAparelhoAtivo();
  const user = { ...USUARIO_LOGADO, ...patch };
  useSessionStore.setState({ user });
  return user;
}
