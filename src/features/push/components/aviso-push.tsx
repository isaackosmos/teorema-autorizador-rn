import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { abrirConfiguracoesDeNotificacao } from '@/features/push/lib/permissao-notificacao';
import { EstadoPush } from '@/features/push/lib/registro-push';
import { useEstadoPushStore } from '@/features/push/stores/estado-push.store';

/**
 * Aviso de que as notificações estão desligadas.
 *
 * Dispensável e sem bloqueio de tela: sem push o app continua inteiro, porque
 * a fonte da verdade é a fila de liberações — notificação é conveniência
 * (docs/decisao-push.md §6.2). O original, em vez disso, reabria o modal em
 * laço (docs/analise §7.2.14).
 *
 * O botão de Configurações só aparece quando o sistema **não pergunta mais**:
 * enquanto ele ainda pergunta, o caminho é a próxima abertura do app, não
 * mandar o usuário mexer em ajuste do aparelho.
 */
export function AvisoPush() {
  const estado = useEstadoPushStore((s) => s.estado);
  const [dispensado, setDispensado] = useState(false);

  const definitiva = estado === EstadoPush.PermissaoNegadaDefinitivamente;
  const negada = estado === EstadoPush.PermissaoNegada;

  if (dispensado || (!negada && !definitiva)) return null;

  return (
    <View
      accessibilityRole="alert"
      className="gap-2 rounded-lg border border-pendente/40 bg-pendente/15 px-3 py-2"
    >
      <Text className="text-xs font-semibold text-pendente">Notificações desligadas</Text>
      <Text className="text-xs text-pendente">
        {definitiva
          ? 'O aparelho não pergunta mais por aqui: libere nas Configurações do sistema.'
          : 'Você continua vendo tudo na fila; o que não chega é o aviso.'}
      </Text>

      <View className="flex-row gap-2">
        {definitiva ? (
          <AcaoAviso titulo="Abrir Configurações" onPress={abrirConfiguracoesDeNotificacao} />
        ) : null}
        <AcaoAviso titulo="Dispensar" onPress={() => setDispensado(true)} />
      </View>
    </View>
  );
}

function AcaoAviso({ titulo, onPress }: { titulo: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="rounded-lg border border-pendente/40 px-3 py-1 active:opacity-80"
    >
      <Text className="text-xs font-semibold text-pendente">{titulo}</Text>
    </Pressable>
  );
}
