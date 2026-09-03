import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { AvisoLoginPendente } from '@/features/auth/components/aviso-login-pendente';
import { LicencaErro } from '@/features/auth/components/licenca-erro';
import { PassoConexao } from '@/features/auth/components/passo-conexao';
import { PassoRegistro } from '@/features/auth/components/passo-registro';
import { useRegistrarAparelho } from '@/features/auth/hooks/use-registrar-aparelho';
import { resolverEtapa } from '@/features/auth/lib/etapa-configuracao';
import { MotivoLicenca } from '@/features/auth/schemas/auth.schema';
import { Button } from '@/shared/components/ui/button';
import { Screen } from '@/shared/components/ui/screen';
import { useCurrentUser, useSessionStore } from '@/shared/stores/session.store';
import { DeviceStatus } from '@/shared/types/session.types';

import type { EtapaConfiguracao } from '@/features/auth/lib/etapa-configuracao';

/** Título de cada passo. O passo em si é decidido por `resolverEtapa`. */
const CABECALHO: Record<EtapaConfiguracao, { numero: number; titulo: string; subtitulo: string }> =
  {
    conexao: {
      numero: 1,
      titulo: 'Conexão',
      subtitulo: 'Confirme o endereço do servidor do cliente e a base de dados.',
    },
    login: {
      numero: 2,
      titulo: 'Registro do aparelho',
      subtitulo: 'Falta identificar quem está registrando este aparelho.',
    },
    registro: {
      numero: 2,
      titulo: 'Registro do aparelho',
      subtitulo: 'Identifique este aparelho. O registro consome uma licença do contrato.',
    },
    licenca: { numero: 3, titulo: 'Licença', subtitulo: 'O registro não foi autorizado.' },
  };

/**
 * Configuração do aparelho: conexão → registro → licença.
 *
 * As telas #3 e #5 do índice vivem nesta rota, em passos. No original eram
 * seis abas do mesmo form (Configuração, Bancos, Identificação, Licença,
 * Concluído e Erro de licença), com vaivém entre elas e um `Sleep(5000)` na
 * de "Concluído" (docs/analise §7.2.13). Aqui o passo é derivado do que já
 * está resolvido na sessão, e terminar significa navegar.
 */
export default function ConfiguracaoScreen() {
  const router = useRouter();
  const device = useSessionStore((s) => s.device);
  const setDevice = useSessionStore((s) => s.setDevice);
  const user = useCurrentUser();
  const bloqueado = device.status === DeviceStatus.Bloqueado;

  const conexaoPronta = device.serverUrlActive !== null && device.tokenDatabase !== null;
  const [emConexao, setEmConexao] = useState(!conexaoPronta);

  const { mutate: registrar, isPending, error, data: resultado, reset } = useRegistrarAparelho();

  const etapa = resolverEtapa({ emConexao, temUsuario: user !== null, resultado, bloqueado });
  const { numero, titulo, subtitulo } = CABECALHO[etapa];
  const motivo = resultado?.ok === false ? resultado.motivo : MotivoLicenca.Bloqueado;

  // Destravar o bloqueio local é seguro: quem decide é o servidor, e sem isso
  // o "tentar de novo" só teria efeito depois de reinstalar o app.
  const tentarNovamente = () => {
    reset();
    if (bloqueado) setDevice({ status: DeviceStatus.NaoRegistrado });
  };

  return (
    <Screen>
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        <View className="gap-6 px-6 py-8">
          <View className="gap-1">
            <Text className="text-xs font-medium uppercase text-muted">Passo {numero} de 3</Text>
            <Text className="text-2xl font-bold text-foreground">{titulo}</Text>
            <Text className="text-sm text-muted">{subtitulo}</Text>
          </View>

          {etapa === 'conexao' ? <PassoConexao onConcluir={() => setEmConexao(false)} /> : null}

          {etapa === 'login' ? (
            <AvisoLoginPendente onEntrar={() => router.replace('/(auth)/login')} />
          ) : null}

          {etapa === 'registro' ? (
            <PassoRegistro onSubmit={registrar} isPending={isPending} error={error} />
          ) : null}

          {etapa === 'licenca' ? <LicencaErro motivo={motivo} onRetry={tentarNovamente} /> : null}

          {etapa === 'conexao' ? null : (
            <Button title="Alterar conexão" variant="outline" onPress={() => setEmConexao(true)} />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
