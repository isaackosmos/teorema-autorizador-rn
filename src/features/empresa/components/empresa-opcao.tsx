import { Pressable, Text, View } from 'react-native';

import type { Company } from '@/shared/types/session.types';

interface EmpresaOpcaoProps {
  empresa: Company;
  onPress: (empresa: Company) => void;
}

/** Item da lista de empresas. Recebe o modelo pronto e só apresenta. */
export function EmpresaOpcao({ empresa, onPress }: EmpresaOpcaoProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(empresa)}
      className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-4 active:opacity-80"
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-background">
        <Text className="text-sm font-semibold text-primary">{empresa.code}</Text>
      </View>

      <Text className="flex-1 text-base font-semibold text-foreground" numberOfLines={2}>
        {empresa.name || `Empresa ${empresa.code}`}
      </Text>
    </Pressable>
  );
}
