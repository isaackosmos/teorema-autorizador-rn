import { ActivityIndicator, Pressable, Text } from 'react-native';

import { cn } from '@/shared/lib/format/cn';

import type { PressableProps } from 'react-native';

type ButtonVariant = 'primary' | 'outline' | 'aprovar' | 'recusar';

const container: Record<ButtonVariant, string> = {
  primary: 'bg-primary active:opacity-80',
  outline: 'border border-border bg-surface active:opacity-80',
  aprovar: 'bg-aprovado active:opacity-80',
  recusar: 'bg-recusado active:opacity-80',
};

const label: Record<ButtonVariant, string> = {
  primary: 'text-primary-foreground',
  outline: 'text-foreground',
  aprovar: 'text-white',
  recusar: 'text-white',
};

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  className?: string;
}

export function Button({
  title,
  variant = 'primary',
  loading = false,
  disabled,
  className,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      className={cn(
        'h-12 flex-row items-center justify-center rounded-xl px-4',
        container[variant],
        isDisabled && 'opacity-50',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text className={cn('text-base font-semibold', label[variant])}>{title}</Text>
      )}
    </Pressable>
  );
}
