import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Text, View } from 'react-native';

import { borderoRetornoSchema } from '@/features/liberacoes/schemas/bordero-retorno.schema';
import { useBorderoAberturaStore } from '@/features/liberacoes/stores/bordero-abertura.store';
import { useBorderoRetornoStore } from '@/features/liberacoes/stores/bordero-retorno.store';
import { WebSystemView } from '@/features/web-systems/components/web-system-view';
import { isSistemaWeb, SISTEMAS_WEB } from '@/features/web-systems/lib/sistemas-web';
import { Screen } from '@/shared/components/ui/screen';

import type { ContextoWeb } from '@/features/web-systems/lib/sessao-web';

/**
 * Contêiner único dos quatro web systems (plano D) — uma rota, não quatro
 * telas: o Delphi tinha três forms idênticos além do genérico que já fazia o
 * mesmo (docs/analise §7.3.21).
 *
 * A rota só compõe, e é ela — não as features — quem liga `liberacoes` a
 * `web-systems` (CLAUDE.md §2, §4.12): o contexto de abertura vem do store de
 * ida e o resultado do borderô volta pelo store de volta, ambos de
 * `liberacoes`; o transporte até o HTML é de `web-systems`.
 */
export default function WebSystemScreen() {
  const { sistema } = useLocalSearchParams<{ sistema: string }>();
  const router = useRouter();
  const publicarRetorno = useBorderoRetornoStore((s) => s.publicar);
  const consumirAbertura = useBorderoAberturaStore((s) => s.consumir);

  const contexto = useRef<ContextoWeb | null>(null);

  /**
   * Consumido **uma vez**, na montagem: o store limpa na leitura (§4.11).
   * Guardar em ref é o que faz o contexto sobreviver a uma recarga da página,
   * que refaz o handshake e pergunta de novo.
   */
  useEffect(() => {
    const abertura = consumirAbertura(sistema);
    if (abertura) {
      contexto.current = { sequencia: abertura.sequencia, resposta: abertura.resposta };
    }
  }, [consumirAbertura, sistema]);

  const obterContexto = useCallback(() => contexto.current, []);
  const fechar = useCallback(() => router.back(), [router]);

  /** O borderô terminou: publica para a análise e fecha, nesta ordem. */
  const aoRetornar = useCallback(
    (retorno: unknown) => {
      const validado = borderoRetornoSchema.safeParse(retorno);

      if (validado.success) {
        publicarRetorno(validado.data);
        avisarSequenciaDivergente(validado.data.sequencia, contexto.current?.sequencia);
      } else {
        // Fora do contrato: não dá para decidir a liberação com isso. A tela
        // fecha do mesmo jeito e a situação anterior é preservada.
        console.warn('[web-system] retorno do borderô fora do contrato; descartado.');
      }

      router.back();
    },
    [publicarRetorno, router],
  );

  if (!isSistemaWeb(sistema)) {
    return (
      <Screen edges={['bottom']}>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-base text-muted">
            Sistema desconhecido: {sistema ?? '—'}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: SISTEMAS_WEB[sistema].titulo }} />
      <Screen edges={['bottom']}>
        <WebSystemView
          sistema={sistema}
          obterContexto={obterContexto}
          onRetorno={aoRetornar}
          onFechar={fechar}
        />
      </Screen>
    </>
  );
}

/**
 * O store de volta filtra pela sequência de quem abriu, então uma divergência
 * não aplica nada — some em silêncio. Relatar é o que separa "o usuário
 * fechou sem decidir" de "o HTML devolveu o borderô errado".
 */
function avisarSequenciaDivergente(recebida: string, esperada: string | undefined): void {
  if (!esperada || recebida === esperada) return;

  console.warn(
    `[web-system] borderô devolveu a sequência ${recebida}, esperada ${esperada}; ` +
      'a análise vai ignorar o retorno.',
  );
}
