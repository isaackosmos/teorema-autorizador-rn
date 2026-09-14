/**
 * `react-native` sob teste, reduzido ao que a árvore dos hooks realmente
 * alcança: `Platform`, lido por `features/auth/lib/aparelho.ts` para montar o
 * `DEVICE_NAME` do registro.
 *
 * Deliberadamente mínimo. Um stub que finge o React Native inteiro convida a
 * testar tela aqui — e tela precisa do renderer de verdade, não deste atalho
 * (CLAUDE.md §1, "Testes").
 */

type SistemaOperacional = 'android' | 'ios';

/** O recorte de `Platform.constants` que `nomeDoAparelho()` lê em cada SO. */
const CONSTANTES = {
  android: { Model: 'Pixel de Teste', Release: '14' },
  ios: { systemName: 'iOS', osVersion: '17.5' },
} as const;

export const Platform = {
  OS: 'android' as SistemaOperacional,

  get constants() {
    return CONSTANTES[Platform.OS];
  },
};

/** Troca o SO para exercitar o outro ramo. Devolve como desfazer. */
export function comPlataforma(os: SistemaOperacional): () => void {
  const anterior = Platform.OS;
  Platform.OS = os;
  return () => {
    Platform.OS = anterior;
  };
}
