import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { useResolverDocumento } from '@/features/auth/hooks/use-resolver-documento';
import { documentoSchema, type DocumentoInput } from '@/features/auth/schemas/documento.schema';
import { Button } from '@/shared/components/ui/button';
import { Screen } from '@/shared/components/ui/screen';
import { TextField } from '@/shared/components/ui/text-field';
import { useSessionStore } from '@/shared/stores/session.store';

/**
 * Primeiro passo do onboarding: identificar a empresa licenciada.
 *
 * Uma tela, uma decisão. O original resolvia documento, endereços de servidor,
 * bancos e erro de licença em abas do mesmo form (docs/plano-migracao A2) — a
 * escolha de servidor e o registro do aparelho ficam em `(auth)/configuracao`.
 */
export default function DocumentoScreen() {
  const documentoSalvo = useSessionStore((s) => s.device.companyDocument);

  const { control, handleSubmit } = useForm<DocumentoInput>({
    resolver: zodResolver(documentoSchema),
    defaultValues: { documento: documentoSalvo ?? '' },
  });

  const { mutate: resolverDocumento, isPending, error } = useResolverDocumento();
  const enviar = handleSubmit((values) => resolverDocumento(documentoSchema.parse(values)));

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center gap-6 px-6"
      >
        <View className="gap-1">
          <Text className="text-2xl font-bold text-foreground">Documento da empresa</Text>
          <Text className="text-sm text-muted">
            Informe o CNPJ ou CPF da empresa licenciada para localizar o servidor.
          </Text>
        </View>

        <TextField
          control={control}
          name="documento"
          label="CNPJ ou CPF"
          placeholder="00.000.000/0000-00"
          keyboardType="numeric"
          autoCorrect={false}
          maxLength={18}
          returnKeyType="go"
          onSubmitEditing={enviar}
        />

        {error ? <Text className="text-sm text-recusado">{error.message}</Text> : null}

        <Button title="Continuar" loading={isPending} onPress={enviar} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
