import { z } from 'zod';

import { orionDateToIso } from '@/shared/lib/format/date';
import { optionalText } from '@/shared/lib/schema/orion';

/**
 * Análise de crédito e histórico financeiro do cliente da liberação
 * (`customerdataanalytics` e `customerpurchasehistory`).
 *
 * Só existe aqui o que o servidor devolve: **Saldo de Crédito** e **Saldo
 * Encontro de Contas** ficaram fora de propósito — no original eram lidos de
 * uma chave inexistente e apareciam como `FALTA IMPL...` em produção
 * (docs/analise §7.2.12). Enquanto o Orion não tiver esses campos, não há
 * schema, não há linha e não há placeholder.
 */

/**
 * Numérico do Firebird. `null`, string vazia e texto não numérico são
 * ausência, não zero: `z.coerce.number()` transformaria `''` em `0` e a tela
 * exibiria "R$ 0,00" como se fosse um limite de crédito real.
 */
const optionalNumber = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && value.trim() === '') return null;

    const numero = Number(value);
    return Number.isFinite(numero) ? numero : null;
  });

/** Data do Orion (`dd/mm/yyyy`) normalizada para ISO na borda. */
const optionalDate = optionalText.transform(orionDateToIso);

const analiseCreditoRowSchema = z
  .object({
    CC_SITUACAO: optionalText,
    CLIFOR_CREDITO_LIMITE: optionalNumber,
    PRIMEIRA_DATA: optionalDate,
    VALOR_PRIMEIRA_DATA: optionalNumber,
    ULTIMA_DATA: optionalDate,
    VALOR_ULTIMA_DATA: optionalNumber,
    MAIOR_VALOR: optionalNumber,
    MEDIA_ATRASO: optionalNumber,
    MAIOR_ATRASO: optionalNumber,
  })
  .transform((raw) => ({
    /**
     * Valor de `CLIENTES_FORNECEDORES.CC_SITUACAO` como veio. A análise do
     * legado não registra a tabela de códigos → rótulos, e inventar um mapa
     * numa tela de crédito seria pior do que mostrar o dado cru.
     */
    situacaoCadastro: raw.CC_SITUACAO,
    limiteCredito: raw.CLIFOR_CREDITO_LIMITE,
    primeiraCompra: { data: raw.PRIMEIRA_DATA, valor: raw.VALOR_PRIMEIRA_DATA },
    ultimaCompra: { data: raw.ULTIMA_DATA, valor: raw.VALOR_ULTIMA_DATA },
    maiorCompra: raw.MAIOR_VALOR,
    /** Em dias. */
    mediaAtraso: raw.MEDIA_ATRASO,
    maiorAtraso: raw.MAIOR_ATRASO,
  }));

/**
 * O endpoint é uma consulta agregada: o Orion devolve a linha do Firebird
 * dentro de um array (como em `searchpending`), mas há rotas da mesma API que
 * respondem com o objeto solto. As duas formas viram o mesmo modelo aqui, na
 * borda — cliente sem histórico devolve lista vazia e o resultado é `null`.
 */
export const analiseCreditoSchema = z
  .union([z.array(analiseCreditoRowSchema), analiseCreditoRowSchema, z.null(), z.undefined()])
  .transform((payload) => {
    if (payload === null || payload === undefined) return null;
    return Array.isArray(payload) ? (payload[0] ?? null) : payload;
  });

export type AnaliseCredito = NonNullable<z.output<typeof analiseCreditoSchema>>;

/** Título financeiro do cliente. `FINANCEIRO_BAIXADO = 'S'` é título quitado. */
const tituloSchema = z
  .object({
    FINANCEIRO_DATA_EMISSAO: optionalDate,
    FINANCEIRO_VALOR: optionalNumber,
    FINANCEIRO_BAIXADO: optionalText,
    FINANCEIRO_ORIGEM: optionalText,
  })
  .transform((raw) => ({
    emissao: raw.FINANCEIRO_DATA_EMISSAO,
    valor: raw.FINANCEIRO_VALOR,
    isBaixado: raw.FINANCEIRO_BAIXADO?.toUpperCase() === 'S',
    origem: raw.FINANCEIRO_ORIGEM,
  }));

export type TituloCliente = z.output<typeof tituloSchema>;

export const historicoComprasSchema = z
  .array(tituloSchema)
  .nullish()
  .transform((titulos) => titulos ?? []);
