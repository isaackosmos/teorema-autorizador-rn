import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useBasesDisponiveis } from '@/features/auth/hooks/use-bases-disponiveis';
import { QueryState } from '@/shared/components/ui/query-state';
import { cn } from '@/shared/lib/format/cn';

interface SeletorBaseProps {
  tokenSelecionado: string | null;
  onSelecionar: (token: string) => void;
}

/**
 * Escolha da base quando o tenant expõe mais de uma (`/v1/auth/setup`).
 *
 * O original escondia isso atrás de um item de configuração que só reclamava
 * "é necessário definir a conexão primeiro" (docs/plano-migracao A3): aqui a
 * lista aparece sozinha depois do ping, e uma base só é selecionada sem pedir
 * confirmação — não há escolha a fazer.
 */
export function SeletorBase({ tokenSelecionado, onSelecionar }: SeletorBaseProps) {
  const { data: bases, isLoading, error, refetch } = useBasesDisponiveis();

  const baseUnica = bases?.length === 1 ? bases[0] : undefined;

  useEffect(() => {
    if (baseUnica && tokenSelecionado !== baseUnica.token) onSelecionar(baseUnica.token);
  }, [baseUnica, tokenSelecionado, onSelecionar]);

  const estado = (
    <QueryState
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      isEmpty={bases?.length === 0}
      emptyMessage="Nenhuma base cadastrada para este documento no servidor."
    />
  );
  if (estado) return <View className="min-h-24">{estado}</View>;
  if (baseUnica) return null;

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-foreground">Base de dados</Text>

      {bases?.map((base) => (
        <Pressable
          key={base.token}
          accessibilityRole="button"
          accessibilityState={{ selected: base.token === tokenSelecionado }}
          onPress={() => onSelecionar(base.token)}
          className={cn(
            'rounded-xl border bg-surface px-4 py-3 active:opacity-80',
            base.token === tokenSelecionado ? 'border-primary' : 'border-border',
          )}
        >
          <Text className="text-base text-foreground">{base.nome ?? base.token}</Text>
          <Text className="text-xs text-muted">{base.token}</Text>
        </Pressable>
      ))}
    </View>
  );
}
