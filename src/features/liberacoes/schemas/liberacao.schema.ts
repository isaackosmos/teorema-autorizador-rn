import { z } from 'zod';

import { optionalText } from '@/shared/lib/schema/orion';

/** Ciclo de vida da liberação (`VENDAS_LIBERACAO.LIBERACAO_LIBERADA`). */
export const SituacaoLiberacao = {
  Livre: '0',
  EmAnalise: '1',
  Aprovada: '2',
  Reprovada: '3',
  Desistencia: '9',
} as const;

export type SituacaoLiberacao = (typeof SituacaoLiberacao)[keyof typeof SituacaoLiberacao];

/**
 * Relata situação que não pertence ao ciclo conhecido.
 *
 * O fallback do schema é rede de segurança, não comportamento esperado: tratar
 * um payload incompleto como "liberação livre" em silêncio esconderia bug do
 * servidor justamente na tela onde o dinheiro é decidido. Separa os dois casos
 * porque eles têm donos diferentes — campo ausente é resposta malformada de
 * `searchpending`; código desconhecido é estado novo do ERP.
 *
 * Enquanto o projeto não tem Sentry (nem qualquer coletor — §1), o canal é o
 * `console.warn` liberado pelo §5.4. Ao instalar um, **este é o único ponto a
 * trocar**.
 */
function reportarSituacaoInesperada(recebido: unknown): void {
  if (recebido === null || recebido === undefined) {
    console.warn(
      '[liberacao] payload sem LIBERACAO_LIBERADA; tratado como situação livre. ' +
        'Resposta de searchpending provavelmente incompleta — conferir no servidor.',
    );
    return;
  }

  console.warn(
    `[liberacao] LIBERACAO_LIBERADA fora do ciclo conhecido: ${JSON.stringify(recebido)}; ` +
      'tratado como situação livre. Se for estado novo do ERP, incluir em SituacaoLiberacao.',
  );
}

/**
 * `LIBERACAO_LIBERADA` validada, não afirmada por cast.
 *
 * O `.catch()` existe porque `liberacaoListSchema` é tudo-ou-nada: uma linha
 * com situação inesperada derrubaria a fila inteira em vez de si mesma. `Livre`
 * é o destino seguro — a situação real de quem decide é do servidor, e o app
 * não usa este campo para liberar nada — mas nunca em silêncio.
 */
const situacaoLiberacaoSchema = z.enum(Object.values(SituacaoLiberacao)).catch((ctx) => {
  reportarSituacaoInesperada(ctx.value);
  return SituacaoLiberacao.Livre;
});

/** `LIBERACAO_ORIGEM` → rótulo exibido. */
export const ORIGEM_LABEL: Record<string, string> = {
  P: 'Pedido de Vendas',
  O: 'Orçamento',
  OS: 'Ordem de Serviço',
  N: 'Nota Fiscal',
  F: 'Financeiro',
  M: 'Entrada/Saída de Itens',
  C: 'Pedido de Compra',
  E: 'Estoque',
  R: 'Romaneio',
  T: 'Transformação',
  CO: 'Cotação',
  V: 'Vendas Balcão',
};

/**
 * Item da fila de liberações.
 *
 * O app Delphi extraía cliente/motivo fatiando `LIBERACAO_MENSAGEM` por índice
 * posicional, com ramos diferentes por plataforma — e sem ramo para iOS/macOS
 * (docs/analise §7.1.6). Aqui a mensagem é só texto: os dados estruturados vêm
 * dos campos próprios (`CLIFOR_NOME`, `VENDEDOR_NOME`, …).
 */
export const liberacaoSchema = z
  .object({
    LIBERACAO_SEQUENCIA: z.coerce.string(),
    LIBERACAO_MENSAGEM: optionalText,
    LIBERACAO_ORIGEM: optionalText,
    LIBERACAO_SOLICITACAO: optionalText,
    LIBERACAO_TIPO: optionalText,
    LIBERACAO_DESCONTO: z.coerce.number().nullish(),
    LIBERACAO_LIBERADA: situacaoLiberacaoSchema,
    LIBERACAO_DATA: optionalText,
    LIBERACAO_HORA: optionalText,
    LIBERACAO_MAQUINA: optionalText,
    LIBERACAO_RESPOSTA: optionalText,
    EMPRESA_MOVTO: optionalText,
    EMPRESA_NOME: optionalText,
    CLIFOR_CODIGO: optionalText,
    CLIFOR_NOME: optionalText,
    ITEM_REDUZIDO: optionalText,
    ITEM_DESCRICAO: optionalText,
    VENDEDOR_NOME: optionalText,
    USUARIO_NOME: optionalText,
    TIPO_REGISTRO: optionalText,
    BORDERO_SEQUENCIA: optionalText,
    BORDERO_NUMERO: optionalText,
  })
  .transform((raw) => ({
    id: raw.LIBERACAO_SEQUENCIA,
    mensagem: raw.LIBERACAO_MENSAGEM ?? '',
    origem: raw.LIBERACAO_ORIGEM,
    origemLabel: raw.LIBERACAO_ORIGEM ? (ORIGEM_LABEL[raw.LIBERACAO_ORIGEM] ?? '') : '',
    solicitacao: raw.LIBERACAO_SOLICITACAO,
    /** `I` desconto unitário · `G` desconto geral. */
    tipoDesconto: raw.LIBERACAO_TIPO,
    desconto: raw.LIBERACAO_DESCONTO ?? 0,
    situacao: raw.LIBERACAO_LIBERADA,
    data: raw.LIBERACAO_DATA,
    hora: raw.LIBERACAO_HORA,
    maquina: raw.LIBERACAO_MAQUINA,
    resposta: raw.LIBERACAO_RESPOSTA,
    empresa: { codigo: raw.EMPRESA_MOVTO, nome: raw.EMPRESA_NOME },
    cliente: { codigo: raw.CLIFOR_CODIGO, nome: raw.CLIFOR_NOME },
    item: { reduzido: raw.ITEM_REDUZIDO, descricao: raw.ITEM_DESCRICAO },
    vendedor: raw.VENDEDOR_NOME,
    solicitante: raw.USUARIO_NOME,
    /**
     * Linhas de borderô são anexadas sinteticamente à mesma fila e não passam
     * por reserva — abrem direto o web system.
     */
    isBordero: raw.TIPO_REGISTRO === 'BORDERO',
    borderoSequencia: raw.BORDERO_SEQUENCIA,
    borderoNumero: raw.BORDERO_NUMERO,
  }));

export type Liberacao = z.output<typeof liberacaoSchema>;

export const liberacaoListSchema = z.array(liberacaoSchema);

/** Texto livre que acompanha a decisão. */
export const decisaoSchema = z.object({
  resposta: z.string().trim().max(500, 'Máximo de 500 caracteres'),
});

export type DecisaoInput = z.infer<typeof decisaoSchema>;

/**
 * Decisão que o usuário toma sobre a liberação (`2` aprovada / `3` reprovada).
 * As duas rotas têm a mesma forma e compartilham uma mutation — no original
 * `AutorizaRequisicao` e `ReprovaRequisicao` eram o mesmo código copiado
 * (docs/analise §7.3.21).
 */
export const Decisao = {
  Autorizar: 'autorizar',
  Reprovar: 'reprovar',
} as const;

export type Decisao = (typeof Decisao)[keyof typeof Decisao];
