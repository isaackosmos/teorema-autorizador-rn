/**
 * Catálogo dos web systems: os quatro itens de menu que abrem a **mesma** rota
 * `(app)/web/[sistema]`.
 *
 * O app Delphi tinha três forms praticamente idênticos para isso, além do
 * `TFrmWebSystems` genérico que já fazia o mesmo (docs/analise §7.3.21). Aqui o
 * que varia entre eles é **dado**, não código: o título e o recorte de sessão
 * que cada HTML espera (docs/decisao-webview-sessao §13.3).
 *
 * O título mora aqui, e não no menu, porque quem abre a tela não é só o menu:
 * o roteamento de push também cai nesta rota, e o cabeçalho precisa dizer onde
 * o usuário está.
 */
export const SISTEMAS_WEB = {
  autcompras: { titulo: 'Pedidos de Compra' },
  autcotacao: { titulo: 'Autorização de Cotação' },
  reqcompras: { titulo: 'Requisição de Compra' },
  autorizador: { titulo: 'Autorizador Financeiro' },
} as const;

export type SistemaWeb = keyof typeof SISTEMAS_WEB;

/** Ordem em que os itens aparecem no menu — a mesma do app original. */
export const SISTEMAS_WEB_LISTA = Object.keys(SISTEMAS_WEB) as SistemaWeb[];

/** O `sistema` chega como parâmetro de rota, ou seja: texto de fora. */
export function isSistemaWeb(valor: string | undefined): valor is SistemaWeb {
  return valor !== undefined && SISTEMAS_WEB_LISTA.includes(valor as SistemaWeb);
}

/** Endereço do tenant sem barra no fim — ele é digitado à mão no onboarding. */
export function normalizarBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

/** `GET /v2/htmlresponse/<sistema>/index.html` — sem fragmento e sem query. */
export function urlDoSistema(baseUrl: string, sistema: SistemaWeb): string {
  return `${normalizarBaseUrl(baseUrl)}/v2/htmlresponse/${sistema}/index.html`;
}

/**
 * `https://host:porta` de uma URL, em minúsculas, ou `null` quando não é
 * http(s) — `about:`, `data:`, `intent:` e afins caem aqui de propósito.
 *
 * Feito com regex, e não com `new URL()`, porque o polyfill de URL do React
 * Native não implementa `origin`.
 */
export function origemDe(url: string): string | null {
  const encontrada = /^(https?:\/\/[^/?#]+)/i.exec(url.trim())?.[1];
  return encontrada ? encontrada.toLowerCase() : null;
}

/**
 * A origem da URL é a mesma do tenant?
 *
 * `origem` precisa ser um resultado de `origemDe` (já normalizado). É o que
 * impede a sessão de ser injetada em página estranha se o HTML navegar para
 * fora (docs/decisao-webview-sessao §9, §13.4).
 */
export function mesmaOrigem(url: string, origem: string): boolean {
  const outra = origemDe(url);
  return outra !== null && outra === origem;
}
