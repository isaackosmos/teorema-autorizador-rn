import { createMMKV } from 'react-native-mmkv';

import type { StateStorage } from 'zustand/middleware';

/**
 * Instância única de MMKV do app — substitui o SQLite local do app Delphi
 * (`liberacao_remota.db`), que na prática só era usado como par chave/valor
 * (docs/analise §4.1, §7.3.25).
 *
 * NÃO grave senha do usuário aqui. O app original guardava `USER_PASSWORD` em
 * texto claro e a recarregava no splash (docs/analise §7.1.9).
 */
export const storage = createMMKV({ id: 'teorema-autorizador' });

/** Adaptador de MMKV para o middleware `persist` do Zustand. */
export const zustandMMKVStorage: StateStorage = {
  getItem: (name) => storage.getString(name) ?? null,
  setItem: (name, value) => storage.set(name, value),
  removeItem: (name) => {
    storage.remove(name);
  },
};
