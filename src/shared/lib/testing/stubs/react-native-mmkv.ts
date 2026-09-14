import { createMockMMKV } from 'react-native-mmkv/lib/createMMKV/createMockMMKV.js';

import type { MMKV } from 'react-native-mmkv';

/**
 * MMKV em memória para os testes.
 *
 * O pacote real é Nitro (nativo) e não carrega no Node. `tools/test-setup.mjs`
 * redireciona o specifier `react-native-mmkv` para cá — é o `moduleNameMapper`
 * do Jest, feito à mão —, e por isso `session.store` e
 * `historico-usuarios.store` funcionam sem saber que estão sob teste.
 *
 * O armazenamento em si é o **mock oficial do pacote** (`createMockMMKV`), e
 * não uma reimplementação: um segundo jeito de fingir MMKV seria o §5.8, e
 * divergiria da superfície real no primeiro método novo. O que este arquivo
 * acrescenta é só o que o oficial não dá — a instância por `id`, como o pacote
 * real faz, e um `limparArmazenamento()` que alcança todas de uma vez.
 *
 * Mora em `src/` (e não em `tools/`) para o teste poder importá-lo pelo alias
 * `@/` com tipo. Como o hook aponta para este mesmo arquivo, é a mesma
 * instância de módulo nos dois caminhos.
 */

const instancias = new Map<string, MMKV>();

export function createMMKV(config: { id: string }): MMKV {
  const existente = instancias.get(config.id);
  if (existente) return existente;

  const nova = createMockMMKV(config);
  instancias.set(config.id, nova);
  return nova;
}

/**
 * Zera o disco falso. Um aparelho compartilhado não carrega sessão de outro
 * usuário, e um teste não carrega estado do anterior — a razão é a mesma.
 */
export function limparArmazenamento(): void {
  for (const instancia of instancias.values()) instancia.clearAll();
}
