import { empresasEmCacheSchema } from '@/features/empresa/schemas/empresa.schema';
import { storage } from '@/shared/lib/storage/mmkv';

import type { Company } from '@/shared/types/session.types';

/**
 * Cache em disco da lista de empresas do usuário.
 *
 * Substitui a tabela `COMPANYS` do SQLite do original, que existia por um
 * motivo só: quando nem o primário nem o secundário respondem, o login
 * offline lista as empresas da última sessão (docs/analise §3.1, §4.1).
 *
 * Isto não é dado de servidor duplicado num store (CLAUDE.md §4.8): é a cópia
 * em disco que alimenta o `initialData` da query. A fonte da verdade em
 * memória continua sendo o cache do TanStack Query.
 */

const chaveDoUsuario = (userCode: string) => `empresas:${userCode}`;

export function lerEmpresasEmCache(userCode: string): Company[] | null {
  const gravado = storage.getString(chaveDoUsuario(userCode));
  if (!gravado) return null;

  const empresas = empresasEmCacheSchema.safeParse(jsonOuNull(gravado));
  if (!empresas.success || empresas.data.length === 0) return null;

  return empresas.data;
}

export function gravarEmpresasEmCache(userCode: string, empresas: Company[]): void {
  storage.set(chaveDoUsuario(userCode), JSON.stringify(empresas));
}

function jsonOuNull(gravado: string): unknown {
  try {
    return JSON.parse(gravado);
  } catch {
    return null;
  }
}
