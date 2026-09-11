/**
 * Lê o placar do `CLAUDE.md` §6 — a fonte de verdade do status.
 *
 * Não é um parser de Markdown: é um parser das *três tabelas* da §6, que têm forma
 * conhecida e são mantidas à mão. Se a forma mudar, este arquivo estoura alto (lança)
 * em vez de sincronizar dado errado — é de propósito: um Notion errado é pior que um
 * Notion velho.
 */

const STATUS = {
  '✅': '✅ concluído',
  '🟨': '🟨 em andamento',
  '⬜': '⬜ pendente',
};

/** Remove acento, baixa a caixa e colapsa espaço. Usado só para casar chaves. */
export const normalizar = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Tira a tipografia do Markdown, os marcadores de nota de rodapé e os links. */
const limparCelula = (s) =>
  s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/[¹²³]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Divide uma linha de tabela Markdown em células, respeitando `\|` escapado. */
const celulas = (linha) =>
  linha
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.replace(/\\\|/g, '|'));

/** Extrai todas as tabelas de um trecho, na ordem, como matrizes de células cruas. */
function tabelas(trecho) {
  const linhas = trecho.split('\n');
  const achadas = [];
  let atual = null;

  for (const linha of linhas) {
    const eLinhaDeTabela = /^\s*\|/.test(linha);
    if (!eLinhaDeTabela) {
      if (atual) achadas.push(atual), (atual = null);
      continue;
    }
    const cols = celulas(linha);
    // linha separadora (| --- | --- |)
    if (cols.every((c) => /^\s*:?-{2,}:?\s*$/.test(c))) continue;
    if (!atual) atual = { cabecalho: cols.map(limparCelula), linhas: [] };
    else atual.linhas.push(cols);
  }
  if (atual) achadas.push(atual);
  return achadas;
}

/** Separa o emoji de status do resto do texto da célula Status. */
function partirStatus(texto, marcadorOrion) {
  const limpo = limparCelula(texto);
  const emoji = Object.keys(STATUS).find((e) => limpo.startsWith(e));
  if (!emoji) {
    throw new Error(
      `Célula de status sem emoji reconhecido (✅ 🟨 ⬜): ${JSON.stringify(limpo.slice(0, 80))}`,
    );
  }
  let resto = limpo.slice(emoji.length).trim();
  const confirmadaOrion = resto.includes(marcadorOrion);
  if (confirmadaOrion) resto = resto.replace(marcadorOrion, '').replace(/\s+/g, ' ').trim();
  // A observação da §6 costuma vir entre parênteses na tabela de infraestrutura.
  if (resto.startsWith('(') && resto.endsWith(')')) resto = resto.slice(1, -1).trim();
  return { status: STATUS[emoji], observacao: resto, confirmadaOrion };
}

const BLOCO_POR_TELA = {
  1: 'A', 2: 'A', 3: 'A', 4: 'A', 5: 'A', 6: 'A', 7: 'A',
  8: 'B',
  9: 'C', 10: 'C', 11: 'C', 12: 'C',
  13: 'E',
  14: 'D', 15: 'D', 16: 'D', 17: 'D',
};

/**
 * @param {string} claudeMd conteúdo do CLAUDE.md
 * @param {object} config  tools/notion-sync.config.json
 * @returns {{telas: object[], infra: object[], secao6: string}}
 */
export function lerPlacar(claudeMd, config) {
  const inicio = claudeMd.indexOf('## 6.');
  const fim = claudeMd.indexOf('## 7.', inicio);
  if (inicio < 0 || fim < 0) throw new Error('Não achei a §6 no CLAUDE.md — o placar mudou de lugar?');
  const secao6 = claudeMd.slice(inicio, fim);

  const todas = tabelas(secao6);
  const deTelas = todas.filter((t) => normalizar(t.cabecalho[0] ?? '') === '#');
  const deInfra = todas.filter((t) => normalizar(t.cabecalho[0] ?? '') === 'item');

  if (deTelas.length === 0) throw new Error('Nenhuma tabela de telas na §6 (esperava cabeçalho começando em "#").');
  if (deInfra.length === 0) throw new Error('Nenhuma tabela de infraestrutura na §6 (esperava cabeçalho "Item").');

  const telas = [];
  for (const tabela of deTelas) {
    const iStatus = tabela.cabecalho.findIndex((c) => normalizar(c) === 'status');
    for (const linha of tabela.linhas) {
      const num = Number(limparCelula(linha[0] ?? ''));
      if (!Number.isInteger(num) || num < 1) continue;
      const { status, observacao, confirmadaOrion } = partirStatus(
        linha[iStatus] ?? '',
        config.marcadorOrion,
      );
      telas.push({
        chave: `tela-${num}`,
        num,
        nome: limparCelula(linha[1] ?? ''),
        rota: limparCelula(linha[2] ?? ''),
        origem: limparCelula(linha[3] ?? ''),
        bloco: BLOCO_POR_TELA[num] ?? null,
        status,
        observacao,
        confirmadaOrion,
      });
    }
  }

  const infra = [];
  const mapa = Object.entries(config.mapaInfra).map(([prefixo, chave]) => ({
    prefixo: normalizar(prefixo),
    chave,
  }));
  const naoMapeados = [];
  for (const tabela of deInfra) {
    const iStatus = tabela.cabecalho.findIndex((c) => normalizar(c) === 'status');
    for (const linha of tabela.linhas) {
      const item = limparCelula(linha[0] ?? '');
      if (!item) continue;
      const alvo = mapa.find((m) => normalizar(item).startsWith(m.prefixo));
      if (!alvo) {
        naoMapeados.push(item);
        continue;
      }
      const { status, observacao, confirmadaOrion } = partirStatus(
        linha[iStatus] ?? '',
        config.marcadorOrion,
      );
      infra.push({ chave: alvo.chave, nome: item, status, observacao, confirmadaOrion });
    }
  }

  const esperadas = 17;
  if (telas.length !== esperadas) {
    throw new Error(
      `A §6 tem ${telas.length} telas, e o sync espera ${esperadas}. ` +
        `Se o índice cresceu de verdade, ajuste BLOCO_POR_TELA em tools/lib/placar.mjs e crie a linha na database Telas.`,
    );
  }
  const semBloco = telas.filter((t) => !t.bloco).map((t) => t.num);
  if (semBloco.length) {
    throw new Error(`Telas sem bloco em BLOCO_POR_TELA: ${semBloco.join(', ')}`);
  }

  return { telas, infra, naoMapeados, secao6 };
}

export { STATUS };
