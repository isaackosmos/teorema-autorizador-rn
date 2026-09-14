/**
 * `expo-router` sob teste: `useRouter()` que grava para onde mandaram ir.
 *
 * Navegação é efeito observável do hook de escrita — `useLogin` e
 * `useRegistrarAparelho` decidem o próximo passo do onboarding —, então o
 * stub registra em vez de engolir. Ver `tools/test-setup.mjs`.
 */

export interface Navegacao {
  metodo: 'push' | 'replace' | 'back';
  destino?: string;
}

const navegacoes: Navegacao[] = [];

/** O que foi navegado desde o último `limparNavegacoes()`, em ordem. */
export function navegacoesRegistradas(): readonly Navegacao[] {
  return navegacoes;
}

export function limparNavegacoes(): void {
  navegacoes.length = 0;
}

export function useRouter() {
  return {
    push: (destino: string) => navegacoes.push({ metodo: 'push', destino }),
    replace: (destino: string) => navegacoes.push({ metodo: 'replace', destino }),
    back: () => navegacoes.push({ metodo: 'back' }),
  };
}
