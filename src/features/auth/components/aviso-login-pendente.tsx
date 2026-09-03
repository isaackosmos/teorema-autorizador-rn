import { Text, View } from 'react-native';

import { Button } from '@/shared/components/ui/button';

interface AvisoLoginPendenteProps {
  onEntrar: () => void;
}

/**
 * O registro do aparelho exige um usuário do ERP: o servidor central grava
 * `userlogin`/`userid` no registro e recusa a requisição sem eles
 * (`Validate('CreateRegister')`). No original a ordem era a mesma — a aba de
 * identificação só aparecia depois do login.
 */
export function AvisoLoginPendente({ onEntrar }: AvisoLoginPendenteProps) {
  return (
    <View className="gap-4 rounded-xl border border-border bg-surface p-4">
      <Text className="text-sm text-muted">
        A licença é registrada no nome de quem está usando o aparelho. Entre com seu usuário do ERP
        para concluir o registro — você volta para cá em seguida.
      </Text>

      <Button title="Entrar" onPress={onEntrar} />
    </View>
  );
}
