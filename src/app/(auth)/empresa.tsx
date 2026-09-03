import { useEffect } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';

import { EmpresaOpcao } from '@/features/empresa/components/empresa-opcao';
import { useEmpresasDoUsuario } from '@/features/empresa/hooks/use-empresas-do-usuario';
import { useEscolherEmpresa } from '@/features/empresa/hooks/use-escolher-empresa';
import { OfflineBanner } from '@/shared/components/ui/offline-banner';
import { QueryState } from '@/shared/components/ui/query-state';
import { Screen } from '@/shared/components/ui/screen';

/**
 * Escolha da empresa corrente — último passo do onboarding, pré-requisito do
 * menu (docs/analise §3.1, item 5).
 *
 * A tela não guarda a lista: pede o hook, trata os estados e devolve a empresa
 * escolhida para a sessão.
 */
export default function EmpresaScreen() {
  const { data: empresas, isLoading, error, refetch, isRefetching } = useEmpresasDoUsuario();
  const escolher = useEscolherEmpresa();

  const empresaUnica = empresas?.length === 1 ? empresas[0] : undefined;

  // Uma empresa só não é escolha: segue direto para o menu, sem tela
  // intermediária (docs/plano-migracao A6).
  useEffect(() => {
    if (empresaUnica) escolher(empresaUnica);
  }, [empresaUnica, escolher]);

  const estado = (
    <QueryState
      isLoading={isLoading || empresaUnica !== undefined}
      // Com a lista em cache o erro não toma a tela: dá para escolher a
      // empresa sem servidor, e o aviso fica no banner de offline (plano F2).
      error={empresas ? null : error}
      onRetry={refetch}
      isEmpty={!empresas || empresas.length === 0}
      emptyMessage="Nenhuma empresa liberada para este usuário. Procure o administrador do ERP."
    />
  );
  if (estado) return <Screen>{estado}</Screen>;

  return (
    <Screen>
      <View className="gap-1 px-6 pb-2 pt-4">
        <Text className="text-2xl font-bold text-foreground">Escolha a empresa</Text>
        <Text className="text-sm text-muted">
          Ela define o que você autoriza no app e pode ser trocada depois.
        </Text>
      </View>

      <View className="px-6 pt-2">
        <OfflineBanner />
      </View>

      <FlatList
        data={empresas}
        keyExtractor={(empresa) => String(empresa.id)}
        contentContainerClassName="grow gap-3 p-6"
        renderItem={({ item }) => <EmpresaOpcao empresa={item} onPress={escolher} />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      />
    </Screen>
  );
}
