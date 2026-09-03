import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Text, View } from 'react-native';

import { SeletorBase } from '@/features/auth/components/seletor-base';
import { useTestarConexao } from '@/features/auth/hooks/use-testar-conexao';
import { conexaoSchema, type ConexaoInput } from '@/features/auth/schemas/conexao.schema';
import { Button } from '@/shared/components/ui/button';
import { TextField } from '@/shared/components/ui/text-field';
import { useSessionStore } from '@/shared/stores/session.store';

interface PassoConexaoProps {
  onConcluir: () => void;
}

const ORIGEM_TEXTO = { primario: 'primário', secundario: 'secundário' } as const;

/**
 * Passo 1: endereço do tenant e base de dados.
 *
 * Os endereços são campos desta tela — o original abria um modal genérico de
 * entrada de texto (`TFrmImput`) para cada um, sem validar nada
 * (docs/plano-migracao A3).
 */
export function PassoConexao({ onConcluir }: PassoConexaoProps) {
  const device = useSessionStore((s) => s.device);
  const setDevice = useSessionStore((s) => s.setDevice);

  const { control, handleSubmit } = useForm<ConexaoInput>({
    resolver: zodResolver(conexaoSchema),
    defaultValues: {
      serverUrlPrimary: device.serverUrlPrimary ?? '',
      serverUrlSecondary: device.serverUrlSecondary ?? '',
    },
  });

  const { mutate: testar, isPending, data: conexao, error } = useTestarConexao();
  const testarConexao = handleSubmit((values) => testar(conexaoSchema.parse(values)));

  // Estável de propósito: é dependência do efeito que seleciona a base única.
  const selecionarBase = useCallback(
    (tokenDatabase: string) => setDevice({ tokenDatabase }),
    [setDevice],
  );

  return (
    <View className="gap-4">
      <TextField
        control={control}
        name="serverUrlPrimary"
        label="Servidor primário"
        placeholder="https://servidor.cliente.com.br"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />

      <TextField
        control={control}
        name="serverUrlSecondary"
        label="Servidor secundário (opcional)"
        placeholder="https://backup.cliente.com.br"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />

      <Button
        title="Testar conexão"
        variant="outline"
        loading={isPending}
        onPress={testarConexao}
      />

      {error ? <Text className="text-sm text-recusado">{error.message}</Text> : null}

      {conexao ? (
        <Text className="text-sm text-aprovado">
          Conectado no servidor {ORIGEM_TEXTO[conexao.origem]}.
        </Text>
      ) : null}

      {device.serverUrlActive ? (
        <SeletorBase tokenSelecionado={device.tokenDatabase} onSelecionar={selecionarBase} />
      ) : null}

      <Button
        title="Continuar"
        disabled={!device.serverUrlActive || !device.tokenDatabase}
        onPress={onConcluir}
      />
    </View>
  );
}
