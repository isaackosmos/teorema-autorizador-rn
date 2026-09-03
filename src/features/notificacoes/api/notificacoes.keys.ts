/**
 * Query keys da feature.
 *
 * A lista ainda não tem endpoint no Orion (plano E2), mas a key já existe: é
 * ela que o badge do cabeçalho observa. Quando o Bloco E ligar a busca real,
 * basta escrever nesta key — nada no chrome muda.
 */
export const notificacoesKeys = {
  all: ['notificacoes'] as const,
  lista: (userCode: string) => [...notificacoesKeys.all, 'lista', userCode] as const,
};
