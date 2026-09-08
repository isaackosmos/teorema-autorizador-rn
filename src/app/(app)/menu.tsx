import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ScrollView } from 'react-native';

import { useLogoEmpresa } from '@/features/empresa/hooks/use-logo-empresa';
import { useNotificacoesNaoLidas } from '@/features/notificacoes/hooks/use-notificacoes-nao-lidas';
import { AvisoPush } from '@/features/push/components/aviso-push';
import { AppHeader } from '@/shared/components/ui/app-header';
import { Button } from '@/shared/components/ui/button';
import { Screen } from '@/shared/components/ui/screen';
import { useCurrentCompany, useCurrentUser, useSessionStore } from '@/shared/stores/session.store';

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
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const signOut = useSessionStore((s) => s.signOut);

  const { data: logoUri } = useLogoEmpresa();
  const naoLidas = useNotificacoesNaoLidas();

  const usuario = user?.name?.trim() || user?.code || '—';

  /** Sai do usuário mantendo o aparelho registrado (plano B1). */
  function sair() {
    signOut();
    // Cache é do usuário que sai: fila, logo e badge não sobrevivem à troca.
    queryClient.clear();
  }

  return (
    <Screen>
      <AppHeader
        usuario={usuario}
        empresa={company?.name ?? '—'}
        logoUri={logoUri}
        // O cabeçalho só mostra o sino quando o total é maior que zero: a
        // tela de notificações ainda não tem fonte de dados (plano E2) e item
        // que não abre nada não existe no menu (docs/analise §7.2.10).
        notificacoes={{ total: naoLidas, onPress: () => router.push('/(app)/notificacoes') }}
      />

      <ScrollView contentContainerClassName="gap-3 p-4">
        {/* Só aparece com a permissão de notificação recusada, e é dispensável. */}
        <AvisoPush />

        {ITENS.map((item) => (
          <Button
            key={item.titulo}
            title={item.titulo}
            variant="outline"
            onPress={() => router.push(item.href)}
          />
        ))}

        <Button title="Sair" variant="outline" className="mt-6" onPress={sair} />
      </ScrollView>
    </Screen>
  );
}
