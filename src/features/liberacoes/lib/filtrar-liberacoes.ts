import type { Liberacao } from '@/features/liberacoes/schemas/liberacao.schema';

/** Minúsculas e sem acento, para "orcamento" achar "Orçamento". */
function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Campos varridos pela busca: cliente, mensagem e origem (código e rótulo).
 * A mensagem entra como texto simples — nada de fatiar por índice posicional
 * como o app Delphi fazia (docs/analise §7.1.6).
 */
function textoBuscavel(liberacao: Liberacao) {
  return [liberacao.cliente.nome, liberacao.mensagem, liberacao.origem, liberacao.origemLabel]
    .filter(Boolean)
    .join(' ');
}

/**
 * Filtra a fila **já carregada** — sem ida ao servidor e sem segundo campo
 * espelhado. O app original tinha duas estratégias de busca convivendo, e a
 * "oficial" era um `TSearchBox` com `Opacity := 0` que continuava ocupando
 * espaço e capturando toque (docs/analise §7.2.15).
 */
export function filtrarLiberacoes(lista: Liberacao[], termo: string) {
  const alvo = normalizar(termo);
  if (!alvo) return lista;

  return lista.filter((liberacao) => normalizar(textoBuscavel(liberacao)).includes(alvo));
}
