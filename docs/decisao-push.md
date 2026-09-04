# Decisão B7 — caminho de push (FCM no Android, APNs no iOS)

> **Status:** **opções levantadas; decisão do time pendente.** Nada implementado — não há
> dependência de push no `package.json`, nem plugin no `app.json`.
> **Trava:** `CLAUDE.md §7.7` · `docs/plano-migracao.md` bloqueio 🔒 B7 (Bloco E, ficha E1 + tela 13).
> **Escopo:** decide **quem entrega o push** e **qual biblioteca** o app usa, lista a configuração
> exigida em cada plataforma e mostra como as quatro correções da ficha E1 se implementam. Não
> decide a tela 13 (E2), que depende de o servidor ter endpoint de notificações.
> **Verificação:** as citações de API foram conferidas contra a documentação do Expo em 04/09/2026
> (links no §11); **nada foi executado em aparelho** — o app não tem push instalado.

---

## 1. Recomendação em uma frase

**`expo-notifications` obtendo o token nativo com `getDevicePushTokenAsync()`, com o Orion central
enviando direto para FCM e APNs** — mantém o desenho que o servidor já tem (`/v1/application/tokenpush`
guardando `{register_id, push_token}`), não coloca terceiro na rota de uma decisão financeira, e é
o único caminho que não exige reescrever o lado do envio. O custo é justamente o que o 🔒 B7
descreve: **o servidor continua com dois caminhos de envio**, porque no Android o token é FCM e no
iOS é APNs. Se o time quiser **um** caminho só, a alternativa honesta é a opção 2 (Firebase nas duas
plataformas) — e ela troca trabalho de servidor por trabalho e risco no app.

---

## 2. De onde partimos

### 2.1 O que o original faz

- **Android:** FCM via `FMX.PushNotification.Android` + `google-services.json` (`analise §5.4`).
- **iOS:** APNs nativo (`FMX.PushNotification.iOS`). O repo legado **não tem o Firebase iOS SDK
  completo**, então o token devolvido é device token da Apple, **não** um token FCM — e é por isso
  que o servidor precisa tratar os dois caminhos (`analise §5.4`). **Esse é o 🔒 B7 inteiro.**
- **Fluxo:** `OnServiceConnectionChange` captura o token → `EnviaTokenPushServer` →
  `POST /v1/application/tokenpush` no central, com `{register_id, push_token}` (`analise §5.2`).
- **Recebimento:** `OnServiceConnectionReceiveNotification` despeja o payload num `TMemo` de debug
  (`MemoDebugPush`, em produção — `analise §7.3.27`) e chama `GatilhoNotificacao`.

E os quatro defeitos que a ficha E1 manda não repetir:

| Defeito                                                                                    | Onde                    |
| ------------------------------------------------------------------------------------------ | ----------------------- |
| `ExigeNotificacaoHabilitada`: negou → modal → solicita de novo → **chama a si mesma**      | `analise §3.2`, §7.2.14 |
| Caso `negadapermanentemente` **vazio**, todo comentado — ninguém é levado às Configurações | `analise §7.2.14`       |
| `Sleep(1000)` na verificação de permissão                                                  | `analise §7.2.13`       |
| Roteamento "se o form está instanciado, recarrega" — **nos demais casos, nada acontece**   | `analise §3.2`          |

### 2.2 O que já existe neste repositório

| Peça                                                            | Situação                                                                           |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/features/notificacoes/hooks/use-notificacoes-nao-lidas.ts` | badge lendo só o cache, com `queryFn: skipToken` (`CLAUDE.md §4.4`)                |
| `src/features/notificacoes/api/notificacoes.keys.ts`            | query keys já hierárquicas                                                         |
| `src/app/(app)/notificacoes.tsx`                                | tela 13, pendente (E2)                                                             |
| `src/shared/lib/http/client.ts`                                 | `centralApi` pronto — é dele que sai o `tokenpush`                                 |
| `device.registerId` em `session.types.ts`                       | **pré-requisito do token**: sem registro do aparelho não há o que enviar           |
| `expo-linking` no `package.json`                                | já instalado — é o que abre as Configurações do sistema (§6.2)                     |
| `package.json`                                                  | **nenhuma** dependência de push                                                    |
| `app.json`                                                      | `plugins: ["expo-router"]` só; sem `googleServicesFile`, sem plugin de notificação |

Duas consequências de ordem que valem registrar: o `tokenpush` exige `register_id`, então a captura
do token só acontece **depois** de A5 (registro do aparelho); e como o app **não roda no Expo Go**
(`CLAUDE.md §1`, Nitro + Worklets), push exige build nativo de qualquer forma — o que elimina a
classe inteira de dúvidas sobre push em Expo Go.

---

## 3. A pergunta que o B7 realmente é: quem entrega

A biblioteca do app é quase consequência. A decisão de fundo é **quem fala com FCM/APNs**.

### Opção 1 — `expo-notifications` + token nativo, Orion envia direto (recomendada)

O app chama `getDevicePushTokenAsync()`, que devolve **token FCM no Android e token APNs no iOS**, e
manda para o `tokenpush`. O Orion envia para `https://fcm.googleapis.com/v1/projects/<projeto>/messages:send`
(FCM V1, com OAuth 2.0 a partir de uma service-account JSON) e para `api.push.apple.com` /
`api.sandbox.push.apple.com` (HTTP/2, JWT assinado com a chave `.p8`).

A documentação do Expo é explícita de que isso é suportado e não obriga a usar a EAS: _"the
`expo-notifications` API is push-service agnostic"_.

**Prós**

- **Preserva o desenho do servidor.** `tokenpush` continua guardando um token opaco; a tabela não
  muda, e o Orion já tem os dois caminhos de envio escritos para o app Delphi.
- **Sem terceiro na rota.** Nada de um serviço externo intermediando notificação de autorização
  financeira — nem como dependência de disponibilidade, nem como questão de dados.
- **Uma biblioteca só no app**, que também cobre permissão, canal Android, badge e o listener de
  toque. Sem coexistência de bibliotecas (ver opção 2).
- **Convivência com o app legado.** Os dois apps mandam tokens da mesma forma para o mesmo endpoint
  durante a transição.

**Contras**

- **O 🔒 B7 continua existindo do lado do servidor:** dois formatos de token, dois protocolos, duas
  credenciais, dois hosts (e, no iOS, sandbox × produção). O app não conserta isso.
- O Orion precisa **descobrir a plataforma** para escolher o caminho. Hoje o `tokenpush` recebe
  `{register_id, push_token}` e nada diz se aquilo é FCM ou APNs — dá para inferir pelo registro do
  aparelho, mas é frágil. **Mandar a plataforma explicitamente é a mudança mínima que eu pediria**
  (§9, pergunta 2).
- A migração FCM legado → **FCM V1** (OAuth com service account) é obrigatória hoje; se o Orion
  ainda usa a API legada de servidor, isso é trabalho dele independentemente desta decisão.

### Opção 2 — Firebase nas duas plataformas (`@react-native-firebase/messaging`)

Com o Firebase iOS SDK no app, o iOS também devolve **token FCM**; o Firebase relaia para o APNs
internamente. O servidor passa a ter **um** caminho de envio.

**Prós**

- **Mata o 🔒 B7 onde ele dói:** um formato de token, um protocolo, uma credencial de envio.
- Sem lidar com JWT de APNs, HTTP/2 e sandbox × produção no Orion.

**Contras**

- **Conflito documentado com `expo-notifications` no iOS.** As duas bibliotecas disputam o delegate
  de notificação; há issue aberta no repo do Expo sobre coexistência (expo/expo#33509) e PR sobre o
  `@react-native-firebase/messaging` sobrescrever o Expo (expo/expo#33666). E a orientação do próprio
  guia do Expo é escolher **um** sistema, não somar dois — o que empurra para reimplementar
  permissão, canal e listener fora do `expo-notifications`.
- Dependência nativa pesada e config plugin próprio (`expo-build-properties`, `firebase.json`,
  `GoogleService-Info.plist`), num app que hoje só precisa de `prebuild`.
- **Ainda exige a chave APNs `.p8`** — carregada no Firebase em vez de no Orion. Não desaparece,
  muda de lugar.
- O app legado continua mandando token APNs. Durante a coexistência (`CLAUDE.md §7.8`) o servidor
  teria **os dois caminhos de todo jeito** — o ganho só chega quando o Delphi sair de circulação.

### Opção 3 — Expo Push Service (`getExpoPushTokenAsync` + `exp.host`)

O Orion faria `POST https://exp.host/--/api/v2/push/send` com um `ExpoPushToken`, e a Expo
distribuiria para FCM/APNs.

**Prós:** um caminho no servidor, sem credencial de FCM nem APNs no Orion, payload único.
**Contras:** coloca um **serviço de terceiro na entrega de uma autorização financeira**; exige
projeto EAS e `projectId` no app, além de subir as credenciais das duas plataformas para a Expo;
o Orion passa a depender de acesso à internet para `exp.host`; e o token muda de natureza
(`ExponentPushToken[...]`), invalidando o que está gravado hoje. Para este produto, **não recomendo**
— mas fica registrado porque é a rota mais barata em esforço e alguém vai perguntar.

### Comparação

| Critério                             | 1 · nativo + Orion envia | 2 · Firebase nos dois | 3 · Expo Push |
| ------------------------------------ | ------------------------ | --------------------- | ------------- |
| Caminhos de envio no servidor        | 2 (FCM + APNs)           | 1 (FCM)               | 1 (exp.host)  |
| Muda o contrato do `tokenpush`       | não (só a plataforma)    | não                   | **sim**       |
| Terceiro na entrega                  | não                      | Google (já está)      | **Expo**      |
| Bibliotecas de notificação no app    | 1                        | 2, em conflito        | 1             |
| Credencial APNs `.p8` necessária     | sim, no Orion            | sim, no Firebase      | sim, na Expo  |
| Peso nativo no app                   | baixo                    | alto                  | baixo         |
| Aproveita o envio que o Orion já tem | ✅                       | parcial               | ❌            |
| Resolve 🔒 B7 de fato                | ❌ documenta e isola     | ✅                    | ✅            |

---

## 4. Biblioteca: `expo-notifications`

Uma só, e ela cobre tudo que a ficha E1 precisa:

| Necessidade E1                     | API                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| Token nativo (FCM/APNs)            | `getDevicePushTokenAsync()`                                                     |
| Permissão sem laço                 | `getPermissionsAsync()` / `requestPermissionsAsync()` → `status`, `canAskAgain` |
| Comportamento em foreground        | `setNotificationHandler({ shouldShowBanner, shouldShowList, … })`               |
| Canal Android (obrigatório 8.0+)   | `setNotificationChannelAsync()`                                                 |
| Toque com app aberto               | `addNotificationResponseReceivedListener()`                                     |
| Toque com app fechado (cold start) | `useLastNotificationResponse()` / `getLastNotificationResponseAsync()`          |
| Badge                              | `setBadgeCountAsync()`                                                          |

**Cuidado de API já verificado:** `shouldShowAlert` está **deprecado** no `NotificationBehavior` —
use `shouldShowBanner` + `shouldShowList`. E as versões síncronas
`getLastNotificationResponse()` / `clearLastNotificationResponse()` foram substituídas pelas
`…Async`. Tutorial antigo copiado sem conferir entra com as duas coisas erradas.

`expo-linking` (já instalado) resolve o §6.2. Nenhuma outra dependência é necessária na opção 1.

---

## 5. Configuração por plataforma

### 5.1 Android (FCM)

| Onde                   | O quê                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Firebase Console       | projeto + app Android com o package **exatamente** `br.inf.teorema.autorizador4`                                        |
| `google-services.json` | baixado do console, na raiz do projeto. Pode ser **commitado** (só identificadores públicos)                            |
| `app.json`             | `expo.android.googleServicesFile: "./google-services.json"` — **obrigatório** para registrar no FCM                     |
| `app.json`             | `expo-notifications` em `plugins`, com ícone, cor e `defaultChannel`                                                    |
| Código                 | `setNotificationChannelAsync()` **antes** de pedir o token (ver armadilha §7.1)                                         |
| Orion (envio)          | service-account JSON do FCM V1 → OAuth 2.0 → `POST /v1/projects/<projeto>/messages:send`                                |
| `.gitignore`           | a service-account JSON do envio **nunca** entra no repo — ela é do servidor, não do app                                 |
| Google Cloud           | se a API key do `google-services.json` tiver restrição, habilitar _FCM Registration API_ e _Firebase Installations API_ |
| Play Console           | usar o **SHA-1 da chave de assinatura de release**, não a de upload                                                     |

Permissão: `POST_NOTIFICATIONS` só existe no **Android 13+ (API 33)**; abaixo disso a notificação é
concedida por padrão — mas o **canal continua obrigatório** desde o Android 8.

### 5.2 iOS (APNs)

| Onde            | O quê                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apple Developer | capability **Push Notifications** no App ID `br.inf.teorema.autorizador4`                                                                                           |
| Apple Developer | chave **APNs `.p8`** + _Key ID_ + _Team ID_ — é o que o Orion usa para assinar o JWT de envio                                                                       |
| `app.json`      | `expo-notifications` em `plugins`; `enableBackgroundRemoteNotifications: true` **se** houver push silencioso (adiciona `remote-notification` a `UIBackgroundModes`) |
| Entitlement     | o plugin marca `aps-environment` como `development`; o Xcode promove para produção no build de release                                                              |
| Orion (envio)   | HTTP/2 para `api.sandbox.push.apple.com` (dev) **ou** `api.push.apple.com` (produção); tópico = bundle id                                                           |

Não há string de permissão (`Info.plist`) a preencher para notificação.

**Permissão no iOS é uma bala só:** o sistema permite **um** prompt. Depois de um "Não permitir",
`canAskAgain` fica `false` para sempre e o único caminho é Configurações. Ou seja, o ramo
`negadapermanentemente` que o original deixou **vazio** não é caso de borda no iOS — é o estado
normal de quem recusou uma vez. Ler a resposta pelo `ios.status`
(`NOT_DETERMINED | DENIED | AUTHORIZED | PROVISIONAL | EPHEMERAL`) quando a distinção importar; o
`status` da raiz achata `PROVISIONAL`/`EPHEMERAL`.

---

## 6. Como a ficha E1 é atendida

### 6.1 Permissão: pede uma vez, sem laço (§7.2.14)

O original era recursivo. Aqui é uma função linear com três saídas e **nenhuma** chamada a si mesma:

```ts
/** docs/analise §7.2.14 — o original re-solicitava em laço recursivo, sem limite. */
export async function garantirPermissao(): Promise<EstadoPermissao> {
  const atual = await Notifications.getPermissionsAsync();
  if (atual.granted) return 'concedida';

  // Só pede quando o sistema ainda aceita perguntar. No iOS isso é verdade
  // uma única vez na vida do app; no Android 13+, até a negação definitiva.
  if (!atual.canAskAgain) return 'negada-definitivamente';

  const pedido = await Notifications.requestPermissionsAsync();
  if (pedido.granted) return 'concedida';

  return pedido.canAskAgain ? 'negada' : 'negada-definitivamente';
}
```

`'negada'` é estado terminal **desta** execução: o app segue funcionando com um aviso dispensável,
como a ficha E1 pede. Nada de modal que volta.

### 6.2 `negada-definitivamente` → Configurações do sistema

É o ramo que estava comentado no original. Com `expo-linking` já instalado:

```ts
import * as Linking from 'expo-linking';

// docs/analise §7.2.14 — no original este caso estava vazio: "por regras de
// negócio não posso obrigar 100%". Não obrigar não é deixar sem caminho.
Linking.openSettings();
```

Um aviso dispensável no chrome do app, com uma ação que abre as Configurações. Não é bloqueio de
tela: sem permissão o app **continua inteiro** — a fila de liberações é a fonte da verdade, push é
conveniência.

### 6.3 Sem espera artificial (§7.2.13)

O `Sleep(1000)` do original existia para "dar tempo" de a permissão resolver. As APIs acima são
`Promise`; não há o que esperar. **Nenhum `setTimeout` entra nesta feature** (`CLAUDE.md §5.10`), e
o registro do token não bloqueia a navegação: falhou, o app funciona e tenta na próxima abertura.

### 6.4 Roteamento pelo payload, não por "form instanciado" (§3.2)

O original perguntava se um form existia e, se não existisse, **não fazia nada**. Aqui o payload é
validado e vira rota — e o TanStack Query dispensa a pergunta:

```ts
/** O que o servidor manda em `data`. Payload é entrada não confiável (§4.8). */
export const pushPayloadSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('liberacao'), id: z.coerce.string() }),
  z.object({ tipo: z.literal('cotacao') }),
]);

export function rotaDaNotificacao(payload: PushPayload): Href {
  if (payload.tipo === 'liberacao') {
    return { pathname: '/(app)/liberacoes/[id]', params: { id: payload.id } };
  }
  return { pathname: '/(app)/web/[sistema]', params: { sistema: 'autcotacao' } };
}
```

Duas entradas, um destino:

- **app aberto** — `addNotificationResponseReceivedListener` no `_layout.tsx`;
- **app fechado** — `useLastNotificationResponse()`, aplicado depois de o router montar.

E o "recarrega a fila se estiver instanciada" vira **invalidação de cache**: ao chegar a notificação,
`queryClient.invalidateQueries({ queryKey: liberacoesKeys.all })` atualiza o que estiver montado e
não faz nada quando não há nada montado — sem o app precisar saber que tela existe. Payload que não
casa com o schema é descartado com `console.warn` (`CLAUDE.md §5.4`); não navega para lugar nenhum.

### 6.5 Sem memo de debug (§7.3.27)

`MemoDebugPush` era um `TMemo` de depuração no form base **de produção**. O canal aqui é
`console.warn`/`console.error`, e o item de observabilidade do `CLAUDE.md §6` segue valendo.

---

## 7. Armadilhas que custam um dia cada

1. **Android 13: crie o canal antes de pedir o token.** A documentação do Expo é explícita —
   `setNotificationChannelAsync()` **antes** de `getDevicePushTokenAsync()`.
2. **APNs sandbox × produção.** Build de desenvolvimento gera token válido só no host _sandbox_.
   Token de dev enviado para `api.push.apple.com` falha, e a mensagem de erro da Apple não é óbvia.
   O Orion precisa saber de qual ambiente o token veio.
3. **Bundle id compartilhado com o app legado** (`CLAUDE.md §7.8`). O tópico APNs **é** o bundle id e
   o app Firebase Android é amarrado ao package. Se em desenvolvimento você usar identificador de
   variante (como o §7.8 manda), essa variante precisa de **app Firebase próprio** e de
   **entitlement próprio** — senão o push simplesmente não chega, sem erro no app.
4. **O token muda** (reinstalação, restauração de backup, limpeza de dados, rotação do FCM). Reenviar
   o token a cada abertura autenticada é mais barato que descobrir depois que o aparelho está mudo;
   e o servidor precisa aceitar sobrescrever por `register_id`.
5. **`getDevicePushTokenAsync` falha offline.** É requisição de rede: trate como qualquer chamada
   (`ApiError`, decisão por `status`), sem travar o boot.
6. **Permissão concedida ≠ token obtido ≠ push entregue.** São três falhas distintas. Uma flag só
   ("push ok") esconde qual das três aconteceu.
7. **Push não substitui a fila.** Notificação é aviso; a verdade é o `searchpending`. Nada de
   decidir liberação a partir do conteúdo da notificação.

---

## 8. O que muda neste repositório na opção 1

| Arquivo                                                         | Mudança                                                                                                                            |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                                                  | `expo-notifications` (🔒 B7)                                                                                                       |
| `app.json`                                                      | `plugins`: `expo-notifications` (ícone, cor, canal); `android.googleServicesFile`; `ios` background mode se houver push silencioso |
| `google-services.json`                                          | novo, na raiz, commitado                                                                                                           |
| `src/features/push/lib/permissao-notificacao.ts`                | novo: `garantirPermissao()` do §6.1                                                                                                |
| `src/features/push/lib/rota-da-notificacao.ts`                  | novo: payload → `Href` (§6.4)                                                                                                      |
| `src/features/push/schemas/push-payload.schema.ts`              | novo: união discriminada validando o payload                                                                                       |
| `src/features/push/api/push.api.ts`                             | novo: `POST /v1/application/tokenpush` no `centralApi`                                                                             |
| `src/features/push/hooks/use-registrar-push.ts`                 | novo: permissão → token → `tokenpush`; roda com aparelho registrado                                                                |
| `src/features/push/hooks/use-roteamento-push.ts`                | novo: listener + cold start + invalidação de cache                                                                                 |
| `src/app/_layout.tsx`                                           | `setNotificationHandler` + os dois hooks acima — só composição                                                                     |
| `src/features/notificacoes/hooks/use-notificacoes-nao-lidas.ts` | sai o `skipToken` quando E2 tiver endpoint; o badge é o mesmo cache                                                                |
| `CLAUDE.md §6` · `§7.7`                                         | linha de push da infraestrutura transversal e decisão registrada                                                                   |

`features/push/` é feature nova e **não** importa de `features/liberacoes/` (`CLAUDE.md §2`): o
roteamento devolve um `Href` e a invalidação usa a query key, que é o contrato público da fila.

---

## 9. Perguntas que precisam de resposta humana

1. **O Orion já envia por FCM V1** (OAuth 2.0 + service account), ou ainda usa a API legada de
   servidor? Se for a legada, isso é trabalho obrigatório e independe desta decisão.
2. **O `tokenpush` pode receber a plataforma?** Hoje é `{register_id, push_token}` e nada distingue
   FCM de APNs. É a mudança mínima da opção 1 — e sem ela o servidor adivinha.
3. **Quem guarda a chave APNs `.p8`** e quem sabe se o token é de sandbox ou de produção?
4. **Vale pagar a opção 2** (Firebase nas duas plataformas) para o servidor ter um caminho só,
   sabendo que o ganho só chega quando o app Delphi sair de circulação?
5. **Que payloads o servidor manda hoje?** O §6.4 assume `liberacao` e `cotacao` (os dois gatilhos
   que o original tratava). O schema precisa da lista real antes de virar código.
6. **Push silencioso** para atualizar badge/fila em background: existe na intenção? Muda o
   `UIBackgroundModes` do iOS e o formato da mensagem.

---

## 10. Como isso se encaixa no plano

O Bloco E tem duas fichas e elas não dependem uma da outra:

- **E1 (esta decisão)** pode andar assim que B7 for respondido: permissão, token, roteamento e
  invalidação não precisam da tela 13.
- **E2 (tela 13)** continua travada em algo diferente — **o servidor não tem endpoint de
  notificações**. É por isso que o badge está com `skipToken` e a tela fora do menu: a ficha E2 é
  explícita de que ela não é migrada sem fonte de dados real, para não repetir o JSON de teste do
  original (`analise §7.2.11`).

Ou seja: dá para ter push funcionando (acordando o app na liberação certa) **antes** de existir tela
de notificações. A ordem do plano permite, e o `CLAUDE.md §6` deve refletir isso quando E1 fechar.

---

## 11. Referências

- `docs/analise-app-original.md` §5.2 (`tokenpush`), §5.4 (FCM/APNs no legado), §3.2 (permissão em
  laço e roteamento por form instanciado), §7.2.11 (JSON de teste), §7.2.13 (`Sleep`), §7.2.14 (laço
  e ramo vazio), §7.3.27 (`MemoDebugPush`).
- `docs/plano-migracao.md` — ficha E1, ficha E2 e §6 (🔒 B7).
- `CLAUDE.md` §4.4 (badge com `skipToken`), §4.8 (entrada não confiável), §5.4 (`console.warn`),
  §5.10 (sem espera artificial), §7.7, §7.8 (bundle id compartilhado).
- Expo, consultado em 04/09/2026:
  - [`expo-notifications`](https://docs.expo.dev/versions/latest/sdk/notifications/) — API, deprecação
    de `shouldShowAlert`, canal antes do token no Android 13, `enableBackgroundRemoteNotifications`.
  - [Enviar por FCM e APNs sem o serviço da Expo](https://docs.expo.dev/push-notifications/sending-notifications-custom/)
    — `getDevicePushTokenAsync`, credenciais e endpoints dos dois lados.
  - [Credenciais FCM](https://docs.expo.dev/push-notifications/fcm-credentials/) — `google-services.json`,
    `android.googleServicesFile`, APIs a habilitar, SHA-1 de release.
  - [Escolher um serviço de push](https://docs.expo.dev/guides/using-push-notifications-services/) —
    orientação de não somar dois sistemas de notificação.
  - Conflito `expo-notifications` × `@react-native-firebase/messaging`:
    [expo/expo#33509](https://github.com/expo/expo/issues/33509),
    [expo/expo#33666](https://github.com/expo/expo/pull/33666).
