const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Formata um valor em reais. */
export function formatCurrency(value: number): string {
  return brl.format(value);
}

/**
 * Alguns campos do ERP chegam em centavos (ex.: `COMPRA_VALOR_TOTAL`).
 * Converta na borda da API, nunca na tela.
 */
export function centsToNumber(cents: number): number {
  return cents / 100;
}
