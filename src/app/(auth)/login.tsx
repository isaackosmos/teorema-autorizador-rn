import { zodResolver } from '@hookform/resolvers/zod';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';

import { SeletorUsuarioRecente } from '@/features/auth/components/seletor-usuario-recente';
import { useLogin } from '@/features/auth/hooks/use-login';
import { mensagemDeErroDeLogin } from '@/features/auth/lib/erro-login';
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
  const { control, handleSubmit, setValue } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const { mutate: entrar, isPending, error } = useLogin();
  const senhaRef = useRef<TextInput>(null);

  const enviar = handleSubmit((values) => entrar(loginSchema.parse(values)));

  // Escolher um usuário do histórico só resolve metade do trabalho: o que
  // falta digitar é a senha, então o foco vai direto para ela.
  function usarUsuarioRecente(username: string) {
    setValue('username', username, { shouldDirty: true, shouldValidate: true });
    senhaRef.current?.focus();
  }

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

        <SeletorUsuarioRecente onSelecionar={usarUsuarioRecente} />

        <View className="gap-4">
          <TextField
            control={control}
            name="username"
            label="Usuário"
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="next"
            // `submit` mantém o teclado aberto: o "próximo" passa para a
            // senha em vez de fechar tudo.
            submitBehavior="submit"
            onSubmitEditing={() => senhaRef.current?.focus()}
          />

          <TextField
            ref={senhaRef}
            control={control}
            name="password"
            label="Senha"
            secureTextEntry
            returnKeyType="go"
            onSubmitEditing={enviar}
          />
        </View>

        {/* Mensagem única, decidida por status em `lib/erro-login.ts` — nunca o
            texto cru do servidor (docs/analise §7.1.3). */}
        {error ? (
          <Text accessibilityRole="alert" className="text-sm text-recusado">
            {mensagemDeErroDeLogin(error)}
          </Text>
        ) : null}

        <Button title="Entrar" loading={isPending} onPress={enviar} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
