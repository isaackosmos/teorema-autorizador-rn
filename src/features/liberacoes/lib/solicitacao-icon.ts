import type { Liberacao } from '@/features/liberacoes/schemas/liberacao.schema';

/** Ícone e rótulo de um tipo de solicitação. */
export interface SolicitacaoIcone {
  /** Glifo exibido no card. */
  glifo: string;
  /** Nome do grupo — usado como rótulo de acessibilidade. */
  label: string;
}

/**
 * `LIBERACAO_SOLICITACAO` → ícone do card.
 *
 * Os 16 grupos vêm da tabela de tipos × permissão do usuário
 * (docs/analise §4.4). O app Delphi guardava esses ícones como bitmaps base64
 * dentro de uma aba oculta do form (`TabItemIcones`, §7.3.22) e ainda deixava
 * `SUP` e `REC` sem ícone; aqui é um mapa de módulo, com todos os códigos
 * cobertos e um fallback explícito.
 *
 * Glifo Unicode em vez de fonte de ícones: o projeto não tem biblioteca de
 * ícones instalada e este mapa não justifica a primeira.
 */
export const SOLICITACAO_ICON: Record<string, SolicitacaoIcone> = {
  SS: { glifo: '🛡️', label: 'Supervisor' },
  SUP: { glifo: '🛡️', label: 'Supervisor' },
  ACX: { glifo: '🔑', label: 'Acesso ao caixa' },
  RIV: { glifo: '🖨️', label: 'Reimpressão' },
  CV: { glifo: '🚫', label: 'Cancelamento de venda' },
  RC: { glifo: '🚫', label: 'Cancelamento de venda' },
  DG: { glifo: '🏷️', label: 'Desconto' },
  DIS: { glifo: '🏷️', label: 'Desconto' },
  DE: { glifo: '🏷️', label: 'Desconto' },
  DF: { glifo: '🏷️', label: 'Desconto' },
  MG: { glifo: '🏷️', label: 'Desconto' },
  LCU: { glifo: '📈', label: 'Limite de crédito' },
  VCS: { glifo: '📈', label: 'Limite de crédito' },
  CI: { glifo: '📈', label: 'Limite de crédito' },
  PMC: { glifo: '💲', label: 'Preço' },
  PMMI: { glifo: '💲', label: 'Preço' },
  PMMA: { glifo: '💲', label: 'Preço' },
  SQE: { glifo: '📦', label: 'Estoque' },
  DP: { glifo: '💵', label: 'Baixa financeira' },
  VP: { glifo: '💵', label: 'Baixa parcial' },
  CE: { glifo: '🤝', label: 'Condição especial' },
  CEL: { glifo: '🤝', label: 'Condição especial' },
  FPM: { glifo: '🤝', label: 'Condição especial' },
  DPF: { glifo: '📄', label: 'Pedidos' },
  LOP: { glifo: '📄', label: 'Pedidos' },
  LPV: { glifo: '📄', label: 'Pedidos' },
  EST: { glifo: '↩️', label: 'Estorno' },
  TV: { glifo: '🏦', label: 'Financeiro' },
  VIS: { glifo: '🏦', label: 'Financeiro' },
  PRA: { glifo: '🏦', label: 'Financeiro' },
  VCE: { glifo: '🏦', label: 'Custos' },
  LPC: { glifo: '🛒', label: 'Compras' },
  MIP: { glifo: '🛠️', label: 'Manutenção de preço' },
  REC: { glifo: '🔁', label: 'Alteração de operação' },
};

/** Linha de borderô é sintética e não traz `LIBERACAO_SOLICITACAO` (§3.3). */
const BORDERO: SolicitacaoIcone = { glifo: '🧾', label: 'Borderô' };

const PADRAO: SolicitacaoIcone = { glifo: '📋', label: 'Solicitação' };

/**
 * Ícone da liberação. Código desconhecido cai no padrão — nunca fica sem
 * ícone, e a lista não muda de altura por causa disso.
 */
export function iconeSolicitacao(
  liberacao: Pick<Liberacao, 'solicitacao' | 'isBordero'>,
): SolicitacaoIcone {
  if (liberacao.isBordero) return BORDERO;
  if (!liberacao.solicitacao) return PADRAO;

  return SOLICITACAO_ICON[liberacao.solicitacao.trim().toUpperCase()] ?? PADRAO;
}
