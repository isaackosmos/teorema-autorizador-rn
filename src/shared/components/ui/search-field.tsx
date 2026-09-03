import { Pressable, Text, TextInput, View } from 'react-native';

import { cn } from '@/shared/lib/format/cn';

import type { TextInputProps } from 'react-native';

interface SearchFieldProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: string;
  onChangeText: (value: string) => void;
  /** Rótulo de acessibilidade: o campo não tem label visível. */
  accessibilityLabel: string;
}

/**
 * Campo de filtro sobre uma lista já carregada.
 *
 * Não é um campo de formulário: não passa por React Hook Form nem por Zod,
 * porque não há regra de validação — o valor é estado de UI da tela.
 */
export function SearchField({
  value,
  onChangeText,
  accessibilityLabel,
  className,
  ...rest
}: SearchFieldProps) {
  return (
    <View className="flex-row items-center gap-2 rounded-xl border border-border bg-surface px-4">
      <Text className="text-base text-muted">🔍</Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={accessibilityLabel}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="never"
        placeholderTextColor="rgb(148 163 184)"
        className={cn('h-12 flex-1 text-base text-foreground', className)}
        {...rest}
      />

      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Limpar busca"
          hitSlop={8}
          onPress={() => onChangeText('')}
          className="active:opacity-60"
        >
          <Text className="text-lg text-muted">✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
