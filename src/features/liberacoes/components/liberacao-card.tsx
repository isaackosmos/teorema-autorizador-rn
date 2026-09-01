import { Pressable, Text, View } from 'react-native';

import { cn } from '@/shared/lib/format/cn';

import type { Liberacao } from '@/features/liberacoes/schemas/liberacao.schema';

interface LiberacaoCardProps {
  liberacao: Liberacao;
  onPress: (liberacao: Liberacao) => void;
}

/**
 * Item da fila. Recebe o modelo já traduzido e só decide apresentação —
 * nenhum estado de negócio mora no componente (o app Delphi guardava o JSON
 * inteiro no `TagString` do widget, docs/analise §7.2.18).
 */
export function LiberacaoCard({ liberacao, onPress }: LiberacaoCardProps) {
  const destaque = liberacao.cliente.nome ?? liberacao.vendedor ?? liberacao.empresa.nome ?? '—';
  const [primeiraLinha] = liberacao.mensagem.split('\n');

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(liberacao)}
      className="gap-1 rounded-2xl border border-border bg-surface p-4 active:opacity-80"
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-base font-semibold text-foreground" numberOfLines={1}>
          {destaque}
        </Text>
        <Text
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            liberacao.isBordero ? 'bg-pendente/15 text-pendente' : 'bg-primary/10 text-primary',
          )}
        >
          {liberacao.isBordero ? 'Borderô' : liberacao.origemLabel || 'Liberação'}
        </Text>
      </View>

      <Text className="text-sm text-muted" numberOfLines={2}>
        {primeiraLinha}
      </Text>

      <Text className="text-xs text-muted">
        {[liberacao.empresa.nome, liberacao.data, liberacao.hora].filter(Boolean).join(' · ')}
      </Text>
    </Pressable>
  );
}
