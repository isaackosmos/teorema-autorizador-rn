import { ActivityIndicator, Text, View } from 'react-native';

import { Button } from '@/shared/components/ui/button';

interface QueryStateProps {
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
  /** Mensagem exibida quando a consulta deu certo mas não trouxe nada. */
  emptyMessage?: string;
  isEmpty?: boolean;
}

/**
 * Estados de carregamento / erro / vazio de uma tela orientada a query.
 * Retorna `null` quando há dado para renderizar.
 */
export function QueryState({
  isLoading,
  error,
  onRetry,
  isEmpty = false,
  emptyMessage = 'Nada por aqui.',
}: QueryStateProps) {
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center gap-4 px-8">
        <Text className="text-center text-base text-foreground">{error.message}</Text>
        {onRetry ? <Button title="Tentar novamente" variant="outline" onPress={onRetry} /> : null}
      </View>
    );
  }

  if (isEmpty) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-center text-base text-muted">{emptyMessage}</Text>
      </View>
    );
  }

  return null;
}
