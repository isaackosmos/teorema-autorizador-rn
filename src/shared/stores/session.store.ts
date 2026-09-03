import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { zustandMMKVStorage } from '@/shared/lib/storage/mmkv';
import { DeviceStatus, type Company, type Device, type User } from '@/shared/types/session.types';

/**
 * Sessão do app: aparelho registrado + usuário logado + empresa corrente.
 *
 * Substitui o singleton `TParameters.Sessao` do app Delphi, que acumulava ~40
 * propriedades — 15 delas de outros apps da família (docs/analise §4.2).
 * Só entra aqui o que este app realmente lê.
 *
 * A senha do usuário NÃO é guardada. O app original persistia
 * `USER_PASSWORD` em texto claro e a recarregava no splash.
 */

const emptyDevice: Device = {
  status: DeviceStatus.NaoRegistrado,
  companyDocument: null,
  companyCode: null,
  companyId: null,
  registerId: null,
  tokenDatabase: null,
  serverUrlPrimary: null,
  serverUrlSecondary: null,
  serverUrlPrint: null,
  serverUrlActive: null,
  registerExpiration: null,
};

interface SessionState {
  device: Device;
  user: User | null;
  company: Company | null;
  /** `false` quando nem o primário nem o secundário responderam ao ping. */
  online: boolean;

  setDevice: (patch: Partial<Device>) => void;
  setUser: (user: User | null) => void;
  setCompany: (company: Company | null) => void;
  setOnline: (online: boolean) => void;
  /** Sai do usuário mantendo o aparelho registrado. */
  signOut: () => void;
  /** Zera tudo — usado quando a licença expira ou o registro é excluído. */
  resetDevice: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      device: emptyDevice,
      user: null,
      company: null,
      online: true,

      setDevice: (patch) => set((state) => ({ device: { ...state.device, ...patch } })),
      setUser: (user) => set({ user }),
      setCompany: (company) => set({ company }),
      setOnline: (online) => set({ online }),
      signOut: () => set({ user: null, company: null }),
      resetDevice: () => set({ device: emptyDevice, user: null, company: null }),
    }),
    {
      name: 'session',
      storage: createJSONStorage(() => zustandMMKVStorage),
      version: 1,
      // `online` é estado de runtime: não faz sentido restaurar do disco.
      partialize: ({ device, user, company }) => ({ device, user, company }),
      // O merge padrão do `persist` é raso: o `device` gravado substituiria o
      // objeto inteiro e chegaria sem as chaves que a versão anterior do app
      // ainda não gravava. Completar com `emptyDevice` mantém o tipo honesto
      // sem precisar de `migrate` a cada campo novo do aparelho.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<SessionState>;
        return { ...current, ...saved, device: { ...emptyDevice, ...saved.device } };
      },
    },
  ),
);

/** Leitura fora de componente (interceptors, serviços). */
export const getSession = useSessionStore.getState;

export const useIsAuthenticated = () => useSessionStore((s) => s.user !== null);
export const useCurrentUser = () => useSessionStore((s) => s.user);
export const useCurrentCompany = () => useSessionStore((s) => s.company);
