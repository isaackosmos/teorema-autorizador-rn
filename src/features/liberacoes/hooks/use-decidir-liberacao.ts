import { useMutation, useQueryClient } from '@tanstack/react-query';

import { autorizar, reprovar } from '@/features/liberacoes/api/liberacoes.api';
import { liberacoesKeys } from '@/features/liberacoes/api/liberacoes.keys';
import { Decisao } from '@/features/liberacoes/schemas/liberacao.schema';

interface DecidirVariables {
  id: string;
  decisao: Decisao;
  /** Texto livre que acompanha a decisão (`LIBERACAO_RESPOSTA`). */
  resposta: string;
}

/**
 * Autoriza ou reprova uma liberação.
 *
 * As duas rotas têm a mesma forma, então compartilham uma mutation — o app
 * Delphi tinha dois blocos copiados (docs/analise §7.3.21).
 *
 * Sucesso é status 2xx. O app original comparava o corpo com a string `'{}'`
 * e virava erro a qualquer mudança de formatação (docs/analise §7.1.8).
 */
export function useDecidirLiberacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, decisao, resposta }: DecidirVariables) =>
      decisao === Decisao.Autorizar ? autorizar(id, resposta) : reprovar(id, resposta),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: liberacoesKeys.all }),
  });
}
