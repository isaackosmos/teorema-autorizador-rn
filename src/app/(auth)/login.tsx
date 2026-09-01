import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { useLogin } from '@/features/auth/hooks/use-login';
import { loginSchema, type LoginInput } from '@/features/auth/schemas/login.schema';
import { Button } from '@/shared/components/ui/button';
import { Screen } from '@/shared/components/ui/screen';
import { TextField } from '@/shared/components/ui/text-field';

/**
 * Tela de referência do padrão React Hook Form + Zod.
 *
 * A tela não valida nada à mão, não chama axios e não guarda estado de
 * servidor: `loginSchema` valida, `useLogin` executa. Ver CLAUDE.md.
 */
export default function LoginScreen() {
  const { control, handleSubmit } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const { mutate: entrar, isPending, error } = useLogin();

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center gap-6 px-6"
      >
        <View className="gap-1">
          <Text className="text-2xl font-bold text-foreground">Entrar</Text>
          <Text className="text-sm text-muted">Use suas credenciais do ERP.</Text>
        </View>

        <View className="gap-4">
          <TextField
            control={control}
            name="username"
            label="Usuário"
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="next"
          />

          <TextField
            control={control}
            name="password"
            label="Senha"
            secureTextEntry
            returnKeyType="go"
            onSubmitEditing={handleSubmit((values) => entrar(loginSchema.parse(values)))}
          />
        </View>

        {error ? <Text className="text-sm text-recusado">{error.message}</Text> : null}

        <Button
          title="Entrar"
          loading={isPending}
          onPress={handleSubmit((values) => entrar(loginSchema.parse(values)))}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
