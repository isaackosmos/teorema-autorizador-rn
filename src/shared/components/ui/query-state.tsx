import { ActivityIndicator, Text, View } from 'react-native';

import { Button } from '@/shared/components/ui/button';

import type { ReactElement } from 'react';

interface QueryStateProps {
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
  /** Mensagem exibida quando a consulta deu certo mas não trouxe nada. */
  emptyMessage?: string;
  isEmpty?: boolean;
}

/**
 * Estado de carregamento / erro / vazio de uma tela orientada a query, como
 * valor: devolve `null` quando há dado para renderizar.
 *
 * É **função**, não componente, porque a tela precisa do resultado para decidir
 * se sai antes: `const estado = <QueryState … />` produziria um elemento React
 * — um objeto, sempre truthy — e o `if (estado)` de toda tela passaria a valer
 * sempre, escondendo o conteúdo atrás de um `<Screen>` vazio.
 */
export function queryState({
  isLoading,
  error,
  onRetry,
  isEmpty = false,
  emptyMessage = 'Nada por aqui.',
}: QueryStateProps): ReactElement | null {
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

/**
 * O mesmo estado como componente, para os pontos em que ele é filho de outro
 * elemento e não porta de saída da tela — `ListEmptyComponent`, por exemplo.
 */
export function QueryState(props: QueryStateProps): ReactElement | null {
  return queryState(props);
}
