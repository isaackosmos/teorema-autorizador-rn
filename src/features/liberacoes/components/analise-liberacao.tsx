import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { DecisaoForm } from '@/features/liberacoes/components/decisao-form';
import { LiberacaoResumo } from '@/features/liberacoes/components/liberacao-resumo';
import { useAnaliseLiberacao } from '@/features/liberacoes/hooks/use-analise-liberacao';
import { borderoAberturaSchema } from '@/features/liberacoes/schemas/bordero-abertura.schema';
import { useBorderoAberturaStore } from '@/features/liberacoes/stores/bordero-abertura.store';

import type { Decisao, Liberacao } from '@/features/liberacoes/schemas/liberacao.schema';
import type { ApiError } from '@/shared/lib/http/errors';

/** Web system que decide um borderô — o `sistema` da rota `(app)/web/[sistema]`. */
const SISTEMA_BORDERO = 'autorizador';

interface AnaliseLiberacaoProps {
  liberacao: Liberacao;
  onConcluir: (decisao: Decisao) => void;
}

/**
 * Corpo da tela de análise: o caso, o texto de resposta e a decisão.
 *
 * Enquanto a reserva não volta, os botões ficam travados; se ela falhar, o
 * formulário dá lugar ao aviso — decidir não faria sentido.
 */
export function AnaliseLiberacao({ liberacao, onConcluir }: AnaliseLiberacaoProps) {
  const router = useRouter();
  const publicarAbertura = useBorderoAberturaStore((s) => s.publicar);
  const { reservando, erroReserva, erroDecisao, decisaoPendente, decidir } = useAnaliseLiberacao(
    liberacao,
    onConcluir,
  );

  const sequenciaBordero = liberacao.borderoSequencia;

  /**
   * Sequência do payload, nunca extraída do texto do label (§7.1.7).
   *
   * O contexto viaja pelo store de ida, não pela URL: `resposta` é texto livre
   * do usuário, e parâmetro de rota fica no histórico — mesma classe de
   * problema do fragmento do original (§4.11). Na URL sobra só `sistema`.
   *
   * A guarda existe porque `borderoSequencia` é anulável: o atalho só aparece
   * com sequência, e sem ela não há borderô para abrir — nem contexto válido a
   * publicar (o schema exige a sequência).
   */
  function abrirBordero(resposta: string) {
    if (!sequenciaBordero) return;

    publicarAbertura(
      borderoAberturaSchema.parse({
        sistema: SISTEMA_BORDERO,
        sequencia: sequenciaBordero,
        resposta,
      }),
    );

    router.push({ pathname: '/(app)/web/[sistema]', params: { sistema: SISTEMA_BORDERO } });
  }

  function verCliente() {
    router.push({ pathname: '/(app)/liberacoes/[id]/cliente', params: { id: liberacao.id } });
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1"
    >
      <ScrollView contentContainerClassName="gap-4 p-4" keyboardShouldPersistTaps="handled">
        <LiberacaoResumo
          liberacao={liberacao}
          // Sem código de cliente não há o que abrir (docs/analise §3.3).
          onVerCliente={liberacao.cliente.codigo ? verCliente : undefined}
        />

        {erroReserva ? (
          <AvisoReserva erro={erroReserva} />
        ) : (
          <DecisaoForm
            onDecidir={decidir}
            decisaoPendente={decisaoPendente}
            erro={erroDecisao}
            disabled={reservando}
            bordero={sequenciaBordero ? { onAbrir: abrirBordero } : null}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * A reserva não passou: liberação já decidida, fora da alçada, ou servidor
 * fora do ar. Quem separa os casos é o `status` do `ApiError`, e o texto
 * exibido é o do servidor, como veio (docs/analise §7.1.3). Um aviso só —
 * nada de diálogo empilhado.
 */
function AvisoReserva({ erro }: { erro: ApiError }) {
  const titulo = erro.isNetworkError
    ? 'Servidor não respondeu'
    : 'Não foi possível abrir para análise';

  return (
    <View
      accessibilityRole="alert"
      className="gap-1 rounded-2xl border border-recusado/40 bg-recusado/10 p-4"
    >
      <Text className="text-sm font-semibold text-recusado">{titulo}</Text>
      <Text className="text-sm text-recusado">{erro.message}</Text>
    </View>
  );
}
