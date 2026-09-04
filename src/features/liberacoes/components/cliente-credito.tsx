import { Text, View } from 'react-native';

import type { Campo } from '@/features/liberacoes/lib/campos-cliente';

interface ClienteCreditoProps {
  campos: Campo[];
}

/**
 * Bloco de análise de crédito. Recebe as linhas já prontas — quem decide o
 * que tem valor é `camposDaAnalise`; aqui só se apresenta.
 *
 * Sem nenhuma linha o bloco não existe: nada de cartão vazio nem de rótulo
 * sem valor ao lado.
 */
export function ClienteCredito({ campos }: ClienteCreditoProps) {
  if (campos.length === 0) return null;

  return (
    <View className="gap-2 rounded-2xl border border-border bg-surface p-4">
      <Text className="text-xs font-semibold uppercase text-muted">Análise de crédito</Text>

      {campos.map((campo) => (
        <View key={campo.rotulo} className="flex-row items-start justify-between gap-4">
          <Text className="text-sm text-muted">{campo.rotulo}</Text>
          <Text className="flex-1 text-right text-sm text-foreground">{campo.valor}</Text>
        </View>
      ))}
    </View>
  );
}
