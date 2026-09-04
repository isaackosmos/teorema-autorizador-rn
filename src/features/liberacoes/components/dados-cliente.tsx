import { FlatList, RefreshControl, Text, View } from 'react-native';

import { ClienteCredito } from '@/features/liberacoes/components/cliente-credito';
import { ClienteTituloCard } from '@/features/liberacoes/components/cliente-titulo-card';
import { useAnaliseCredito } from '@/features/liberacoes/hooks/use-analise-credito';
import { useHistoricoCompras } from '@/features/liberacoes/hooks/use-historico-compras';
import { camposDaAnalise } from '@/features/liberacoes/lib/campos-cliente';
import { queryState } from '@/shared/components/ui/query-state';

interface DadosClienteProps {
  /** `EMPRESA_MOVTO` da liberação — a empresa do movimento, não a licenciada. */
  empresa: string;
  /** `CLIFOR_CODIGO`. */
  cliente: string;
  nome: string | null;
}

/**
 * Corpo da tela de dados do cliente (plano C3): análise de crédito e títulos.
 *
 * As duas consultas saem juntas e sem espera artificial — o original dormia
 * `Sleep(500)` "para o skeleton aparecer" (docs/analise §7.2.13).
 */
export function DadosCliente({ empresa, cliente, nome }: DadosClienteProps) {
  const credito = useAnaliseCredito(empresa, cliente);
  const historico = useHistoricoCompras(empresa, cliente);

  const campos = credito.data ? camposDaAnalise(credito.data) : [];
  const titulos = historico.data ?? [];

  function recarregar() {
    void credito.refetch();
    void historico.refetch();
  }

  const estado = queryState({
    isLoading: credito.isLoading || historico.isLoading,
    // Uma mensagem só, a do servidor, como ela veio (docs/analise §7.1.3).
    error: credito.error ?? historico.error,
    onRetry: recarregar,
    isEmpty: campos.length === 0 && titulos.length === 0,
    emptyMessage: 'O servidor não retornou análise de crédito nem títulos para este cliente.',
  });
  if (estado) return estado;

  return (
    <FlatList
      data={titulos}
      // O payload de `customerpurchasehistory` não traz identificador de
      // título; a posição na resposta é a única chave estável que existe.
      keyExtractor={(_, index) => String(index)}
      contentContainerClassName="grow gap-3 p-4"
      ListHeaderComponent={
        <View className="gap-3">
          <Cabecalho nome={nome} cliente={cliente} />
          <ClienteCredito campos={campos} />
          {titulos.length > 0 ? (
            <Text className="text-xs font-semibold uppercase text-muted">Títulos financeiros</Text>
          ) : null}
        </View>
      }
      renderItem={({ item }) => <ClienteTituloCard titulo={item} />}
      refreshControl={
        <RefreshControl
          refreshing={credito.isRefetching || historico.isRefetching}
          onRefresh={recarregar}
        />
      }
    />
  );
}

function Cabecalho({ nome, cliente }: { nome: string | null; cliente: string }) {
  return (
    <View className="gap-0.5">
      <Text className="text-lg font-semibold text-foreground">{nome ?? `Cliente ${cliente}`}</Text>
      {nome ? <Text className="text-xs text-muted">Cliente {cliente}</Text> : null}
    </View>
  );
}
