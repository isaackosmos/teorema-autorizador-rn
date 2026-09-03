import { Text, View } from 'react-native';

import { MotivoLicenca } from '@/features/auth/schemas/auth.schema';
import { Button } from '@/shared/components/ui/button';

import type { MotivoLicenca as Motivo } from '@/features/auth/schemas/auth.schema';

interface LicencaErroProps {
  motivo: Motivo;
  onRetry: () => void;
}

/**
 * No original eram **três abas** com o mesmo desenho e um label trocado
 * (`TabItemLicencaErro` alimentada por três `if`), e o "tentar de novo"
 * reiniciava o fluxo inteiro (docs/plano-migracao A3/A5). Aqui é um componente
 * só, parametrizado pelo motivo, com a orientação certa em cada caso.
 */
const ORIENTACAO: Record<Motivo, { titulo: string; texto: string }> = {
  [MotivoLicenca.Bloqueado]: {
    titulo: 'Aparelho bloqueado',
    texto:
      'Este aparelho está bloqueado no licenciamento. Fale com o suporte da Teorema para liberá-lo.',
  },
  [MotivoLicenca.SemLicencas]: {
    titulo: 'Sem licenças disponíveis',
    texto:
      'Todas as licenças contratadas já estão em uso. Peça para liberar uma licença ou remover o registro de outro aparelho.',
  },
  [MotivoLicenca.DemoExpirada]: {
    titulo: 'Demonstração expirada',
    texto:
      'O período de demonstração terminou. Fale com a Teorema para contratar as licenças do Autorizador.',
  },
};

export function LicencaErro({ motivo, onRetry }: LicencaErroProps) {
  const { titulo, texto } = ORIENTACAO[motivo];

  return (
    <View className="items-center gap-4 py-4">
      <Text className="text-4xl">🔒</Text>

      <View className="gap-2">
        <Text className="text-center text-xl font-bold text-foreground">{titulo}</Text>
        <Text className="text-center text-sm text-muted">{texto}</Text>
      </View>

      <Button title="Tentar de novo" variant="outline" onPress={onRetry} className="self-stretch" />
    </View>
  );
}
