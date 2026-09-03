import { Pressable, ScrollView, Text, View } from 'react-native';

import {
  useHistoricoUsuariosStore,
  useUsuariosRecentes,
} from '@/features/auth/stores/historico-usuarios.store';
import { formatDate } from '@/shared/lib/format/date';

import type { UsuarioRecente } from '@/features/auth/schemas/historico-usuarios.schema';

interface SeletorUsuarioRecenteProps {
  onSelecionar: (username: string) => void;
}

/**
 * Troca de usuário sem redigitar o login.
 *
 * O original abria o `TFrmHistoricoUsuarios` em tela cheia só para escolher um
 * nome e voltar para o login (docs/analise §6.2, plano B2). Aqui a escolha
 * está no próprio formulário: tocar num usuário preenche o campo, e a senha
 * continua sendo digitada — ela nunca é gravada.
 *
 * Sem histórico, o componente não ocupa espaço nenhum na tela.
 */
export function SeletorUsuarioRecente({ onSelecionar }: SeletorUsuarioRecenteProps) {
  const usuarios = useUsuariosRecentes();
  const remover = useHistoricoUsuariosStore((s) => s.remover);

  if (usuarios.length === 0) return null;

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-foreground">Entrar como</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-2 pr-4"
      >
        {usuarios.map((usuario) => (
          <UsuarioRecenteChip
            key={usuario.username}
            usuario={usuario}
            onSelecionar={onSelecionar}
            onRemover={remover}
          />
        ))}
      </ScrollView>
    </View>
  );
}

interface UsuarioRecenteChipProps {
  usuario: UsuarioRecente;
  onSelecionar: (username: string) => void;
  onRemover: (username: string) => void;
}

function UsuarioRecenteChip({ usuario, onSelecionar, onRemover }: UsuarioRecenteChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Entrar como ${usuario.username}`}
      accessibilityHint={`Último acesso em ${formatDate(usuario.ultimoAcesso)}`}
      onPress={() => onSelecionar(usuario.username)}
      className="flex-row items-center gap-3 rounded-xl border border-border bg-surface py-2 pl-3 pr-2 active:opacity-80"
    >
      <View>
        <Text className="text-sm font-semibold text-foreground">{usuario.username}</Text>
        <Text className="text-xs text-muted">{formatDate(usuario.ultimoAcesso)}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remover ${usuario.username} do histórico`}
        hitSlop={8}
        onPress={() => onRemover(usuario.username)}
        className="h-6 w-6 items-center justify-center rounded-full bg-background active:opacity-60"
      >
        <Text className="text-sm leading-none text-muted">✕</Text>
      </Pressable>
    </Pressable>
  );
}
