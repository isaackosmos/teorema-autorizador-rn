import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { Text, TextInput, View } from 'react-native';

import { cn } from '@/shared/lib/format/cn';

import type { Ref } from 'react';
import type { TextInputProps } from 'react-native';

interface TextFieldProps<T extends FieldValues> extends Omit<TextInputProps, 'onChangeText'> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  /** Para encadear campos: quem chama guarda o ref e chama `.focus()`. */
  ref?: Ref<TextInput>;
}

/**
 * Input ligado ao React Hook Form. A mensagem de erro vem do resolver Zod —
 * nenhuma tela valida nada à mão.
 */
export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  className,
  ref,
  multiline = false,
  ...rest
}: TextFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <View className="gap-1.5">
          <Text className="text-sm font-medium text-foreground">{label}</Text>

          <TextInput
            ref={ref}
            value={field.value ?? ''}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            accessibilityLabel={label}
            placeholderTextColor="rgb(148 163 184)"
            multiline={multiline}
            // Texto longo começa em cima e o campo cresce com o conteúdo, em
            // vez de rolar dentro de altura fixa (docs/analise §7.2.17).
            textAlignVertical={multiline ? 'top' : undefined}
            className={cn(
              'rounded-xl border bg-surface px-4 text-base text-foreground',
              multiline ? 'min-h-24 py-3' : 'h-12',
              fieldState.error ? 'border-recusado' : 'border-border',
              className,
            )}
            {...rest}
          />

          {fieldState.error?.message ? (
            <Text className="text-xs text-recusado">{fieldState.error.message}</Text>
          ) : null}
        </View>
      )}
    />
  );
}
