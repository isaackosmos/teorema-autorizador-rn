import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Text, View } from 'react-native';

import { nomeDoAparelho } from '@/features/auth/lib/aparelho';
import {
  registroAparelhoSchema,
  type RegistroAparelhoInput,
  type RegistroAparelhoPayload,
} from '@/features/auth/schemas/registro-aparelho.schema';
import { Button } from '@/shared/components/ui/button';
import { TextField } from '@/shared/components/ui/text-field';
import { useCurrentUser } from '@/shared/stores/session.store';

interface PassoRegistroProps {
  onSubmit: (payload: RegistroAparelhoPayload) => void;
  isPending: boolean;
  error: Error | null;
}

/**
 * Passo 2: identificação do aparelho e do responsável.
 *
 * O original espalhava estes três campos por duas abas (Identificação e
 * Configuração pessoal) e mostrava o identificador do aparelho como se fosse
 * editável. Nenhum campo de senha aparece aqui: a senha não é persistida
 * (docs/analise §7.1.9).
 */
export function PassoRegistro({ onSubmit, isPending, error }: PassoRegistroProps) {
  const user = useCurrentUser();

  const { control, handleSubmit } = useForm<RegistroAparelhoInput>({
    resolver: zodResolver(registroAparelhoSchema),
    defaultValues: { apelido: '', nomeUsuario: user?.name ?? '', contato: '' },
  });

  return (
    <View className="gap-4">
      <View className="gap-1 rounded-xl border border-border bg-surface px-4 py-3">
        <Text className="text-xs text-muted">Aparelho</Text>
        <Text className="text-base text-foreground">{nomeDoAparelho()}</Text>
      </View>

      <TextField
        control={control}
        name="apelido"
        label="Apelido deste aparelho"
        placeholder="Celular da diretoria"
        autoCorrect={false}
      />

      <TextField control={control} name="nomeUsuario" label="Nome do responsável" />

      <TextField
        control={control}
        name="contato"
        label="Telefone de contato"
        placeholder="(00) 00000-0000"
        keyboardType="phone-pad"
      />

      {error ? <Text className="text-sm text-recusado">{error.message}</Text> : null}

      <Button
        title="Registrar aparelho"
        loading={isPending}
        onPress={handleSubmit((values) => onSubmit(registroAparelhoSchema.parse(values)))}
      />
    </View>
  );
}
