/**
 * Cliente mínimo da API do Notion. Sem dependência: `fetch` do Node 20+.
 *
 * Três coisas que a API impõe e que estão resolvidas aqui:
 *  - 3 requisições por segundo. Toda chamada passa por uma fila com espaçamento fixo.
 *  - 429 e 5xx acontecem. Tenta de novo, respeitando `Retry-After`.
 *  - Paginação por cursor em query e em children.
 */

const BASE = 'https://api.notion.com/v1';
const VERSAO = process.env.NOTION_VERSION ?? '2022-06-28';
const ESPACO_MS = 350;

let ultima = 0;
async function esperarVez() {
  const agora = Date.now();
  const alvo = Math.max(agora, ultima + ESPACO_MS);
  ultima = alvo;
  if (alvo > agora) await new Promise((r) => setTimeout(r, alvo - agora));
}

export class ErroNotion extends Error {
  constructor(status, corpo, rota) {
    super(`Notion ${status} em ${rota}: ${corpo?.message ?? JSON.stringify(corpo).slice(0, 200)}`);
    this.status = status;
    this.corpo = corpo;
    this.rota = rota;
  }
}

async function chamar(metodo, rota, corpo, tentativa = 0) {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error('NOTION_TOKEN ausente no ambiente.');

  await esperarVez();
  const resposta = await fetch(`${BASE}${rota}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': VERSAO,
      'Content-Type': 'application/json',
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });

  if (resposta.status === 429 || resposta.status >= 500) {
    if (tentativa >= 4) {
      throw new ErroNotion(resposta.status, await resposta.json().catch(() => ({})), rota);
    }
    const espera = Number(resposta.headers.get('retry-after') ?? 0) * 1000 || 2 ** tentativa * 500;
    await new Promise((r) => setTimeout(r, espera));
    return chamar(metodo, rota, corpo, tentativa + 1);
  }

  const json = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new ErroNotion(resposta.status, json, rota);
  return json;
}

/** Percorre toda a paginação de uma database. */
export async function consultarDatabase(databaseId, filtro) {
  const linhas = [];
  let cursor;
  do {
    const pagina = await chamar('POST', `/databases/${databaseId}/query`, {
      page_size: 100,
      ...(filtro ? { filter: filtro } : {}),
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    linhas.push(...pagina.results);
    cursor = pagina.has_more ? pagina.next_cursor : undefined;
  } while (cursor);
  return linhas;
}

export const atualizarPagina = (pageId, properties) =>
  chamar('PATCH', `/pages/${pageId}`, { properties });

export const criarPagina = (corpo) => chamar('POST', '/pages', corpo);

export const substituirBloco = (blockId, corpo) => chamar('PATCH', `/blocks/${blockId}`, corpo);

export const anexarBlocos = (blockId, children) =>
  chamar('PATCH', `/blocks/${blockId}/children`, { children });

async function filhos(blockId) {
  const todos = [];
  let cursor;
  do {
    const pagina = await chamar(
      'GET',
      `/blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`,
    );
    todos.push(...pagina.results);
    cursor = pagina.has_more ? pagina.next_cursor : undefined;
  } while (cursor);
  return todos;
}

/**
 * Anda a árvore de blocos de uma página, em profundidade, e devolve os blocos achatados.
 * Precisa disso porque os contadores do topo vivem dentro de `column_list` › `column`.
 */
export async function percorrerBlocos(raizId, profundidadeMaxima = 4) {
  const saida = [];
  async function descer(id, nivel) {
    if (nivel > profundidadeMaxima) return;
    for (const bloco of await filhos(id)) {
      saida.push(bloco);
      if (bloco.has_children) await descer(bloco.id, nivel + 1);
    }
  }
  await descer(raizId, 0);
  return saida;
}

/** Texto puro de um array de rich_text. */
export const textoDe = (richText = []) => richText.map((t) => t.plain_text ?? '').join('');

/* -------- atalhos de leitura de propriedade -------- */

export const lerTexto = (prop) => textoDe(prop?.rich_text ?? prop?.title ?? []);
export const lerSelect = (prop) => prop?.select?.name ?? null;
export const lerNumero = (prop) => (typeof prop?.number === 'number' ? prop.number : null);
export const lerCheckbox = (prop) => prop?.checkbox === true;

/* -------- atalhos de escrita de propriedade -------- */

export const texto = (valor) =>
  valor ? { rich_text: [{ type: 'text', text: { content: String(valor).slice(0, 2000) } }] } : { rich_text: [] };
export const titulo = (valor) => ({ title: [{ type: 'text', text: { content: String(valor).slice(0, 2000) } }] });
export const select = (nome) => (nome ? { select: { name: nome } } : { select: null });
export const numero = (n) => ({ number: typeof n === 'number' ? n : null });
export const checkbox = (b) => ({ checkbox: Boolean(b) });
export const data = (iso) => (iso ? { date: { start: iso } } : { date: null });
