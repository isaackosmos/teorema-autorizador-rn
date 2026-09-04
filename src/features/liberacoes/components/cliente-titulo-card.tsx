import { Text, View } from 'react-native';

import { cn } from '@/shared/lib/format/cn';
import { formatCurrency } from '@/shared/lib/format/currency';
import { formatDate } from '@/shared/lib/format/date';

import type { TituloCliente } from '@/features/liberacoes/schemas/cliente.schema';

interface ClienteTituloCardProps {
  titulo: TituloCliente;
}

/**
 * Título financeiro do cliente. A marcação baixado/pendente é o
 * `FINANCEIRO_BAIXADO = 'S'` do payload, resolvido no schema — o componente
 * não reinterpreta o char.
 */
export function ClienteTituloCard({ titulo }: ClienteTituloCardProps) {
  const detalhe = [titulo.emissao ? `Emissão ${formatDate(titulo.emissao)}` : null, titulo.origem]
    .filter(Boolean)
    .join(' · ');

  return (
    <View className="flex-row items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
      <View className="flex-1 gap-0.5">
        <Text className="text-base font-semibold text-foreground">
          {titulo.valor === null ? '—' : formatCurrency(titulo.valor)}
        </Text>
        {detalhe ? <Text className="text-xs text-muted">{detalhe}</Text> : null}
      </View>

      <Text
        className={cn(
          'rounded-full px-2 py-0.5 text-xs font-medium',
          titulo.isBaixado ? 'bg-aprovado/15 text-aprovado' : 'bg-pendente/15 text-pendente',
        )}
      >
        {titulo.isBaixado ? 'Baixado' : 'Pendente'}
      </Text>
    </View>
  );
}
