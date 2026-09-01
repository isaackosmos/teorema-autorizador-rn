import { SafeAreaView } from 'react-native-safe-area-context';

import { cn } from '@/shared/lib/format/cn';

import type { PropsWithChildren } from 'react';
import type { Edge } from 'react-native-safe-area-context';

interface ScreenProps extends PropsWithChildren {
  className?: string;
  edges?: readonly Edge[];
}

/**
 * Container padrão de tela: safe area + fundo do tema.
 * Toda rota renderiza dentro de um `<Screen>`.
 */
export function Screen({ children, className, edges = ['top', 'bottom'] }: ScreenProps) {
  return (
    <SafeAreaView edges={edges} className={cn('flex-1 bg-background', className)}>
      {children}
    </SafeAreaView>
  );
}
