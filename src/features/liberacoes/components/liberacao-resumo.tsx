import { Text, View } from 'react-native';

import { iconeSolicitacao } from '@/features/liberacoes/lib/solicitacao-icon';
import { Button } from '@/shared/components/ui/button';

import type { Liberacao } from '@/features/liberacoes/schemas/liberacao.schema';

interface LiberacaoResumoProps {
  liberacao: Liberacao;
  /** Ausente quando a liberação não tem código de cliente para abrir. */
  onVerCliente?: () => void;
}

/**
 * O que está sendo decidido.
 *
 * Tudo vem de campo próprio do payload: nada de injetar "Cliente - X" no meio
 * da mensagem nem de fatiar texto por índice (docs/analise §7.1.6). A mensagem
 * rola com a tela e não trunca em nove linhas — sem altura calculada como
 * `200 + ((nLinhas - 6) * 21)` (§7.2.17).
 */
export function LiberacaoResumo({ liberacao, onVerCliente }: LiberacaoResumoProps) {
  const icone = iconeSolicitacao(liberacao);
  const destaque = liberacao.cliente.nome ?? liberacao.vendedor ?? liberacao.empresa.nome ?? '—';
  const momento = [liberacao.data, liberacao.hora].filter(Boolean).join(' · ');

  return (
    <View className="gap-4">
      <View className="gap-3 rounded-2xl border border-border bg-surface p-4">
        <View className="flex-row items-start gap-3">
          <View
            accessibilityLabel={icone.label}
            className="h-11 w-11 items-center justify-center rounded-full bg-background"
          >
            <Text className="text-xl">{icone.glifo}</Text>
          </View>

          <View className="flex-1 gap-0.5">
            <Text className="text-lg font-semibold text-foreground">{destaque}</Text>
            {liberacao.cliente.codigo ? (
              <Text className="text-xs text-muted">Cliente {liberacao.cliente.codigo}</Text>
            ) : null}
            <Text className="text-xs text-muted">
              {[liberacao.empresa.nome, momento].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>

        <Text className="text-sm leading-5 text-foreground">{liberacao.mensagem}</Text>
      </View>

      <View className="gap-2 rounded-2xl border border-border bg-surface p-4">
        {camposDaLiberacao(liberacao).map((campo) => (
          <View key={campo.rotulo} className="flex-row items-start justify-between gap-4">
            <Text className="text-sm text-muted">{campo.rotulo}</Text>
            <Text className="flex-1 text-right text-sm text-foreground">{campo.valor}</Text>
          </View>
        ))}
      </View>

      {onVerCliente ? (
        <Button title="Mais informações do cliente" variant="outline" onPress={onVerCliente} />
      ) : null}
    </View>
  );
}

interface Campo {
  rotulo: string;
  valor: string;
}

/** `LIBERACAO_TIPO` do desconto. */
const TIPO_DESCONTO_LABEL: Record<string, string> = { I: 'unitário', G: 'geral' };

/**
 * Campos com conteúdo, na ordem em que ajudam a decidir. Campo vazio não vira
 * linha em branco nem `FALTA IMPL...` (docs/analise §7.2.12).
 */
function camposDaLiberacao(liberacao: Liberacao): Campo[] {
  const candidatos: { rotulo: string; valor: string | null }[] = [
    { rotulo: 'Solicitação', valor: iconeSolicitacao(liberacao).label },
    { rotulo: 'Origem', valor: liberacao.origemLabel || null },
    { rotulo: 'Desconto', valor: descontoLabel(liberacao) },
    { rotulo: 'Item', valor: itemLabel(liberacao) },
    { rotulo: 'Vendedor', valor: liberacao.vendedor },
    { rotulo: 'Solicitante', valor: liberacao.solicitante },
    { rotulo: 'Terminal', valor: liberacao.maquina },
    { rotulo: 'Borderô', valor: liberacao.borderoNumero },
  ];

  return candidatos.filter((campo): campo is Campo => Boolean(campo.valor));
}

function descontoLabel(liberacao: Liberacao): string | null {
  if (liberacao.desconto <= 0) return null;

  const tipo = liberacao.tipoDesconto ? TIPO_DESCONTO_LABEL[liberacao.tipoDesconto] : undefined;
  const percentual = `${liberacao.desconto.toLocaleString('pt-BR')}%`;

  return tipo ? `${percentual} (${tipo})` : percentual;
}

/** Sem `ITEM_REDUZIDO` o bloco de item simplesmente não existe. */
function itemLabel(liberacao: Liberacao): string | null {
  if (!liberacao.item.reduzido) return null;

  return [liberacao.item.reduzido, liberacao.item.descricao].filter(Boolean).join(' · ');
}
