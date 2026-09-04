import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Text, View } from 'react-native';

import { Decisao, decisaoSchema } from '@/features/liberacoes/schemas/liberacao.schema';
import { Button } from '@/shared/components/ui/button';
import { TextField } from '@/shared/components/ui/text-field';

import type { DecisaoInput } from '@/features/liberacoes/schemas/liberacao.schema';

interface DecisaoFormProps {
  onDecidir: (decisao: Decisao, resposta: string) => void;
  /** Decisão em trânsito no servidor; `null` quando não há nenhuma. */
  decisaoPendente: Decisao | null;
  erro: Error | null;
  /** Trava os botões enquanto a reserva não voltou. */
  disabled?: boolean;
  /**
   * Presente quando a liberação é de borderô: o atalho substitui os dois
   * botões, como no original — a decisão vem do web system.
   */
  bordero?: { onAbrir: (resposta: string) => void } | null;
}

/**
 * Texto livre de resposta + a decisão.
 *
 * Sem cadeado antes dos botões (docs/analise §7.2.16) e sem "Sugestão IA"
 * (§7.1.1): a tela mostra o caso e as duas ações, nada mais.
 */
export function DecisaoForm({
  onDecidir,
  decisaoPendente,
  erro,
  disabled = false,
  bordero = null,
}: DecisaoFormProps) {
  const { control, handleSubmit } = useForm<DecisaoInput>({
    resolver: zodResolver(decisaoSchema),
    defaultValues: { resposta: '' },
  });

  const comResposta = (acao: (resposta: string) => void) =>
    handleSubmit((valores) => acao(decisaoSchema.parse(valores).resposta))();

  const ocupado = disabled || decisaoPendente !== null;

  return (
    <View className="gap-4">
      <TextField
        control={control}
        name="resposta"
        label="Resposta"
        placeholder="Justificativa enviada junto com a decisão (opcional)"
        multiline
        maxLength={500}
      />

      {/* A mensagem é a do servidor, como veio (docs/analise §7.1.3). */}
      {erro ? (
        <Text accessibilityRole="alert" className="text-sm text-recusado">
          {erro.message}
        </Text>
      ) : null}

      {bordero ? (
        <Button
          title="Analisar borderô"
          loading={decisaoPendente !== null}
          disabled={ocupado}
          onPress={() => comResposta(bordero.onAbrir)}
        />
      ) : (
        <View className="flex-row gap-3">
          <Button
            className="flex-1"
            title="Autorizar"
            variant="aprovar"
            loading={decisaoPendente === Decisao.Autorizar}
            disabled={ocupado}
            onPress={() => comResposta((resposta) => onDecidir(Decisao.Autorizar, resposta))}
          />
          <Button
            className="flex-1"
            title="Reprovar"
            variant="recusar"
            loading={decisaoPendente === Decisao.Reprovar}
            disabled={ocupado}
            onPress={() => comResposta((resposta) => onDecidir(Decisao.Reprovar, resposta))}
          />
        </View>
      )}
    </View>
  );
}
