import { Image, Pressable, Text, View } from 'react-native';

import { OfflineBanner } from '@/shared/components/ui/offline-banner';

interface AppHeaderProps {
  usuario: string;
  empresa: string;
  /** `data:` URI da logo; ausente cai no marcador com a inicial da empresa. */
  logoUri?: string | null;
  /** O sino só é renderizado com `total > 0`: sem notificação, sem atalho. */
  notificacoes?: { total: number; onPress: () => void };
}

/**
 * Cabeçalho da área autenticada: quem está logado, em qual empresa, a logo,
 * o badge de notificações e o aviso de offline.
 *
 * Substitui o `RectCabecalho` do `TFrmPrincipalBase`, que trazia junto o menu
 * lateral animado com sete `TFloatAnimation` (docs/analise §2.2) — aqui a
 * navegação é plana, do Expo Router.
 *
 * Componente de apresentação: o dado de servidor (logo, contagem) entra por
 * prop, vindo dos hooks da feature na rota.
 */
export function AppHeader({ usuario, empresa, logoUri, notificacoes }: AppHeaderProps) {
  return (
    <View className="gap-3 border-b border-border bg-surface px-4 pb-3 pt-1">
      <View className="flex-row items-center gap-3">
        <LogoEmpresa uri={logoUri} empresa={empresa} />

        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
            {empresa}
          </Text>
          <Text className="text-xs text-muted" numberOfLines={1}>
            {usuario}
          </Text>
        </View>

        {notificacoes && notificacoes.total > 0 ? (
          <BotaoNotificacoes total={notificacoes.total} onPress={notificacoes.onPress} />
        ) : null}
      </View>

      <OfflineBanner />
    </View>
  );
}

function LogoEmpresa({ uri, empresa }: { uri?: string | null; empresa: string }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        resizeMode="contain"
        accessibilityLabel={`Logo de ${empresa}`}
        className="h-11 w-16 rounded-lg"
      />
    );
  }

  return (
    <View className="h-11 w-16 items-center justify-center rounded-lg border border-border bg-background">
      <Text className="text-lg font-semibold text-muted">
        {empresa.trim().charAt(0).toUpperCase() || '—'}
      </Text>
    </View>
  );
}

function BotaoNotificacoes({ total, onPress }: { total: number; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Notificações: ${total}`}
      onPress={onPress}
      className="flex-row items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 active:opacity-80"
    >
      <Text className="text-xs font-medium text-foreground">Notificações</Text>
      <View className="rounded-full bg-recusado px-2 py-0.5">
        <Text className="text-xs font-semibold text-white">{total > 99 ? '99+' : total}</Text>
      </View>
    </Pressable>
  );
}
