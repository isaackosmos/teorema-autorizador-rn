import { formatCurrency } from '@/shared/lib/format/currency';
import { formatDate } from '@/shared/lib/format/date';

import type { AnaliseCredito } from '@/features/liberacoes/schemas/cliente.schema';

export interface Campo {
  rotulo: string;
  valor: string;
}

/**
 * Linhas da análise de crédito, na ordem em que ajudam a decidir.
 *
 * Campo que o servidor não mandou **não vira linha**: era exatamente aqui que
 * o original exibia `FALTA IMPL...` em Saldo de Crédito e Saldo Encontro de
 * Contas (docs/analise §7.2.12). Sem valor, sem linha — e sem placeholder.
 */
export function camposDaAnalise(analise: AnaliseCredito): Campo[] {
  const candidatos: { rotulo: string; valor: string | null }[] = [
    { rotulo: 'Situação do cadastro', valor: analise.situacaoCadastro },
    { rotulo: 'Limite de crédito', valor: moedaOuNulo(analise.limiteCredito) },
    { rotulo: 'Primeira compra', valor: compraLabel(analise.primeiraCompra) },
    { rotulo: 'Última compra', valor: compraLabel(analise.ultimaCompra) },
    { rotulo: 'Maior compra', valor: moedaOuNulo(analise.maiorCompra) },
    { rotulo: 'Média de atraso', valor: diasLabel(analise.mediaAtraso) },
    { rotulo: 'Maior atraso', valor: diasLabel(analise.maiorAtraso) },
  ];

  return candidatos.filter((campo): campo is Campo => Boolean(campo.valor));
}

function moedaOuNulo(valor: number | null): string | null {
  return valor === null ? null : formatCurrency(valor);
}

/** Data e valor da compra na mesma linha; falta um, mostra o outro. */
function compraLabel(compra: { data: string | null; valor: number | null }): string | null {
  const label = [compra.data ? formatDate(compra.data) : null, moedaOuNulo(compra.valor)]
    .filter(Boolean)
    .join(' · ');

  return label || null;
}

/** `MEDIA_ATRASO` vem fracionado — uma casa basta para decidir. */
function diasLabel(dias: number | null): string | null {
  if (dias === null) return null;

  const arredondado = Math.round(dias * 10) / 10;
  const unidade = arredondado === 1 ? 'dia' : 'dias';

  return `${arredondado.toLocaleString('pt-BR')} ${unidade}`;
}
