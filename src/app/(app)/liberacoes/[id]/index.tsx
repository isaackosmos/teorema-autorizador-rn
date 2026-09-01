import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { Screen } from '@/shared/components/ui/screen';

/**
 * PENDENTE — tela de análise da liberação.
 *
 * Ao migrar, preservar: reserva ao abrir (`reserve/{id}/{usercode}`), devolução
 * ao sair sem decidir (`release/...`), e decisão via `useDecidirLiberacao`.
 * Não reproduzir: o "cadeado" antes dos botões, a "Sugestão IA" falsa e o
 * `Sleep(2000)` da tela de feedback (docs/analise §7.1.1, §7.2.13, §7.2.16).
 */
export default function LiberacaoDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen edges={['bottom']}>
      <View className="flex-1 items-center justify-center gap-2 px-8">
        <Text className="text-lg font-semibold text-foreground">Liberação {id}</Text>
        <Text className="text-center text-xs text-pendente">Tela ainda não migrada.</Text>
      </View>
    </Screen>
  );
}
