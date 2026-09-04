import { Text, View } from 'react-native';

import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/format/cn';

import type { Decisao } from '@/features/liberacoes/schemas/liberacao.schema';

interface DecisaoFeedbackProps {
  decisao: Decisao;
  onVoltar: () => void;
}

const FEEDBACK: Record<Decisao, { glifo: string; titulo: string; cor: string }> = {
  autorizar: { glifo: '✅', titulo: 'Liberação autorizada', cor: 'text-aprovado' },
  reprovar: { glifo: '⛔', titulo: 'Liberação reprovada', cor: 'text-recusado' },
};

/**
 * Confirmação da decisão.
 *
 * Um componente para as duas decisões — o original tinha duas abas iguais
 * (docs/analise §7.3.21) — e sem `Sleep(2000)` antes de voltar (§7.2.13): a
 * fila já foi invalidada e o usuário sai quando quiser.
 */
export function DecisaoFeedback({ decisao, onVoltar }: DecisaoFeedbackProps) {
  const { glifo, titulo, cor } = FEEDBACK[decisao];

  return (
    <View className="flex-1 items-center justify-center gap-3 px-8">
      <Text className="text-5xl">{glifo}</Text>
      <Text className={cn('text-xl font-semibold', cor)}>{titulo}</Text>
      <Text className="text-center text-sm text-muted">A fila já foi atualizada.</Text>

      <Button
        title="Voltar para a fila"
        variant="outline"
        className="mt-4 self-stretch"
        onPress={onVoltar}
      />
    </View>
  );
}
