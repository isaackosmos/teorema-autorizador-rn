import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { Button } from '@/shared/components/ui/button';
import { Screen } from '@/shared/components/ui/screen';
import { useCurrentCompany, useSessionStore } from '@/shared/stores/session.store';

import type { Href } from 'expo-router';

/**
 * Menu pós-login.
 *
 * Só entram itens que o usuário realmente pode abrir. O app Delphi mantinha
 * quatro itens com `Visible = False` apontando para telas nativas já
 * substituídas por web systems (docs/analise §7.2.10).
 */
const ITENS: { titulo: string; href: Href }[] = [
  { titulo: 'Liberações Remotas', href: '/(app)/liberacoes' },
  { titulo: 'Pedidos de Compra', href: '/(app)/web/autcompras' },
  { titulo: 'Autorização de Cotação', href: '/(app)/web/autcotacao' },
  { titulo: 'Requisição de Compra', href: '/(app)/web/reqcompras' },
  { titulo: 'Autorizador Financeiro', href: '/(app)/web/autorizador' },
];

export default function MenuScreen() {
  const router = useRouter();
  const company = useCurrentCompany();
  const signOut = useSessionStore((s) => s.signOut);

  return (
    <Screen edges={['bottom']}>
      <ScrollView contentContainerClassName="gap-3 p-4">
        <View className="pb-2">
          <Text className="text-sm text-muted">Empresa</Text>
          <Text className="text-base font-semibold text-foreground">{company?.name ?? '—'}</Text>
        </View>

        {ITENS.map((item) => (
          <Button
            key={item.titulo}
            title={item.titulo}
            variant="outline"
            onPress={() => router.push(item.href)}
          />
        ))}

        <Button title="Sair" variant="outline" className="mt-6" onPress={signOut} />
      </ScrollView>
    </Screen>
  );
}
