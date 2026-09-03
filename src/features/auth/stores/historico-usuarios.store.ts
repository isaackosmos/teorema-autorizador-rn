import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  historicoUsuariosSchema,
  usuarioRecenteSchema,
} from '@/features/auth/schemas/historico-usuarios.schema';
import { zustandMMKVStorage } from '@/shared/lib/storage/mmkv';

import type { UsuarioRecente } from '@/features/auth/schemas/historico-usuarios.schema';

/**
 * Quem já entrou neste aparelho, do acesso mais recente para o mais antigo.
 *
 * É estado de cliente, não dado de servidor: nasce do que foi digitado aqui e
 * nunca é consultado ao Orion — por isso mora num store da feature e não no
 * TanStack Query (CLAUDE.md §4.8).
 */

/**
 * O original listava o histórico inteiro numa tela própria. Como seletor, a
 * lista precisa caber ao lado do formulário: cinco logins cobrem o aparelho
 * compartilhado entre alguns autorizadores, que é o caso real.
 */
const MAX_USUARIOS = 5;

interface HistoricoUsuariosState {
  usuarios: UsuarioRecente[];
  /** Chamado depois de um login aceito pelo servidor. */
  registrarAcesso: (username: string) => void;
  remover: (username: string) => void;
}

export const useHistoricoUsuariosStore = create<HistoricoUsuariosState>()(
  persist(
    (set) => ({
      usuarios: [],

      registrarAcesso: (username) =>
        set((state) => ({ usuarios: comAcessoMaisRecente(state.usuarios, username) })),

      remover: (username) =>
        set((state) => ({
          usuarios: state.usuarios.filter((usuario) => usuario.username !== username),
        })),
    }),
    {
      name: 'historico-usuarios',
      storage: createJSONStorage(() => zustandMMKVStorage),
      version: 1,
      partialize: ({ usuarios }) => ({ usuarios }),
      // O merge padrão é raso e aceitaria o disco como veio; aqui ele passa
      // pelo schema antes de virar estado (ver historico-usuarios.schema.ts).
      merge: (persisted, current) => ({ ...current, usuarios: usuariosDoDisco(persisted) }),
    },
  ),
);

/** O acesso mais recente vai para o topo e o login não se repete na lista. */
function comAcessoMaisRecente(usuarios: UsuarioRecente[], username: string): UsuarioRecente[] {
  const acesso = usuarioRecenteSchema.safeParse({
    username,
    ultimoAcesso: new Date().toISOString(),
  });
  if (!acesso.success) return usuarios;

  const anteriores = usuarios.filter((usuario) => usuario.username !== acesso.data.username);
  return [acesso.data, ...anteriores].slice(0, MAX_USUARIOS);
}

function usuariosDoDisco(persisted: unknown): UsuarioRecente[] {
  const salvo = (persisted ?? {}) as { usuarios?: unknown };
  const historico = historicoUsuariosSchema.safeParse(salvo.usuarios);

  return historico.success ? historico.data.slice(0, MAX_USUARIOS) : [];
}

export const useUsuariosRecentes = () => useHistoricoUsuariosStore((s) => s.usuarios);
