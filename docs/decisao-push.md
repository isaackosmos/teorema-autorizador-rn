# Decisão B7 — caminho de push (FCM no Android, APNs no iOS)

> **Status:** **decisão do time pendente; a ficha E1 foi implementada assumindo a opção 1.**
> `src/features/push/` existe e o plugin está no `app.json` — ver §8.1. O B7 continua aberto
> porque ele decide **quem entrega o push**, e essa resposta é do time, não do app.
> **Trava:** `CLAUDE.md §7.7` · `docs/plano-migracao.md` bloqueio 🔒 B7 (Bloco E, ficha E1 + tela 13).
> **Escopo:** decide **quem entrega o push** e **qual biblioteca** o app usa, lista a configuração
> exigida em cada plataforma e mostra como as quatro correções da ficha E1 se implementam. Não
> decide a tela 13 (E2), que depende de o servidor ter endpoint de notificações.
> **Verificação:** as citações de API foram conferidas contra a documentação do Expo em 04/09/2026
> (links no §12) e **reconferidas contra os typings instalados em 08/09/2026** (§4, §5, §6.1, §6.4);
> **nada foi executado em aparelho** — não há build nativo nem token obtido.
>
> **Dependências instaladas (08/09/2026).** `expo-notifications@57.0.17` e `expo-device@57.0.1`
> estão no `package.json` e no `node_modules`, instalados por `npx expo install` — **só as
> dependências, nenhum código de feature.** Isso **não** decide o B7: instalar a biblioteca não
> escolhe quem entrega o push, e nada foi ligado (o `app.json` segue com `plugins: ["expo-router"]`
> e sem `googleServicesFile`). O que a instalação fecha é a lacuna de verificação — §4, §5 (props
> do plugin), §6.1 e §6.4 agora estão conferidos contra `node_modules`, não contra tutorial. **A
> reconferência corrigiu uma citação invertida no §4** (ver §4.1); os cinco achados abertos
> estão consolidados no §8.

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
| `expo-notifications` no `package.json`                          | **instalado em 08/09/2026** (`57.0.17`), sem nenhum import no `src/`               |
| `expo-device` no `package.json`                                 | **instalado em 08/09/2026** (`57.0.1`) — é o guarda de emulador do §7.8            |
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
  (§10, pergunta 2).
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

**Versão instalada: `57.0.17`**, gravada como `~57.0.17` no `package.json` por
`npx expo install expo-notifications expo-device`. O `bundledNativeModules.json` deste SDK fixa
`~57.0.15`; o instalador resolveu o patch mais novo **dentro do mesmo range `~57.0.x`** — é o til
fazendo o que promete, não divergência de SDK. O `expo-device` ficou em `57.0.1`, exatamente o que a
lista do SDK pede. O versionamento é **unificado**: o pacote acompanha o número do SDK, e material de
fora que fale em `expo-notifications@0.3x` é de outra era de numeração — não dá para mapear versão
de tutorial para esta linha.

Uma biblioteca só, e ela cobre tudo que a ficha E1 precisa. **A tabela abaixo foi reconferida contra
`node_modules/expo-notifications/build/*.d.ts` da 57.0.17 em 08/09/2026** — não é mais leitura de
documentação:

| Necessidade E1                     | Assinatura real nos typings                                                                  | Arquivo                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------- |
| Token nativo (FCM/APNs)            | `getDevicePushTokenAsync(): Promise<DevicePushToken>`                                        | `getDevicePushTokenAsync.d.ts`     |
| Permissão sem laço                 | `getPermissionsAsync()` / `requestPermissionsAsync(permissions?)` → `granted`, `canAskAgain` | `NotificationPermissions.d.ts`     |
| Comportamento em foreground        | `setNotificationHandler(handler: NotificationHandler \| null): void`                         | `NotificationsHandler.d.ts`        |
| Canal Android (obrigatório 8.0+)   | `setNotificationChannelAsync(id, channel): Promise<NotificationChannel \| null>`             | `setNotificationChannelAsync.d.ts` |
| Toque com app aberto               | `addNotificationResponseReceivedListener(l): EventSubscription`                              | `NotificationsEmitter.d.ts`        |
| Toque com app fechado (cold start) | `useLastNotificationResponse(): MaybeNotificationResponse`                                   | `useLastNotificationResponse.d.ts` |
| Badge                              | `setBadgeCountAsync(n, options?): Promise<boolean>`                                          | `setBadgeCountAsync.d.ts`          |

### 4.1 O que a reconferência corrigiu e o que ela acrescentou

**Uma citação estava invertida.** A versão anterior deste documento dizia que "as versões síncronas
`getLastNotificationResponse()` / `clearLastNotificationResponse()` foram substituídas pelas
`…Async`". **É o contrário.** Em `NotificationsEmitter.d.ts` da 57.0.17, quem carrega `@deprecated`
é o par **assíncrono**:

| Função                                 | Estado real na 57.0.17                                             |
| -------------------------------------- | ------------------------------------------------------------------ |
| `getLastNotificationResponseAsync()`   | marcada `@deprecated`: "Use getLastNotificationResponse instead"   |
| `clearLastNotificationResponseAsync()` | marcada `@deprecated`: "Use clearLastNotificationResponse instead" |
| `getLastNotificationResponse()`        | **substituta**, síncrona → `NotificationResponse \| null`          |
| `clearLastNotificationResponse()`      | **substituta**, síncrona → `void`                                  |

As duas síncronas saem pelo `export * from './NotificationsEmitter'` do `index.d.ts`: não aparecem
na lista de exports nomeados, mas são públicas.

**`shouldShowAlert`: deprecação confirmada — e ela é mais do que trocar o nome.** Em
`Notifications.types.d.ts`, o `NotificationBehavior` marca `shouldShowAlert?: boolean` como
`@deprecated instead, specify shouldShowBanner and / or shouldShowList`, mas `shouldShowBanner`,
`shouldShowList`, `shouldPlaySound` e `shouldSetBadge` são **obrigatórios**. Um handler copiado de
tutorial antigo não "só avisa": ele **não compila** enquanto não declarar os quatro.

Três coisas que só apareceram com os typings na mão:

- **`useLastNotificationResponse()` devolve `MaybeNotificationResponse`** — `undefined` enquanto
  ainda não se sabe, `null` quando não houve resposta, e o objeto quando houve. Tratar `undefined`
  como "não houve" é decidir antes de saber; o cold start do §6.4 depende dessa distinção.
- **`setBadgeCountAsync` devolve `Promise<boolean>`**, não `void`: resolve `false` em launcher
  Android sem suporte a badge e, no iOS, sem `allowBadge` concedido. Não é fire-and-forget.
- **`DevicePushToken` é `{ type: 'ios' | 'android'; data: string }`** (`Tokens.types.d.ts`) — **a
  plataforma já vem junto com o token.** Isso torna a pergunta 2 do §10 (mandar a plataforma no
  `tokenpush`) barata do lado do app: não há nada a inferir, é repassar o `type`.

`expo-linking` (57.0.8) resolve o §6.2 — `openSettings(): Promise<void>` conferido em
`build/Linking.d.ts`. `expo-device` (57.0.1) resolve a armadilha §7.8 — `isDevice` é uma
**constante `boolean` síncrona** (`build/Device.d.ts`), não uma promessa: o guarda é um `if`, sem
`await`.

---

## 5. Configuração por plataforma

### 5.1 Android (FCM)

| Onde                   | O quê                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Firebase Console       | projeto + app Android com o package **exatamente** `br.inf.teorema.autorizador4`                                        |
| `google-services.json` | baixado do console, na raiz do projeto. Pode ser **commitado** (só identificadores públicos)                            |
| `app.json`             | `expo.android.googleServicesFile: "./google-services.json"` — **obrigatório** para registrar no FCM                     |
| `app.json`             | `expo-notifications` em `plugins`, com `icon`, `color` e `defaultChannel` (nomes conferidos, ver abaixo)                |
| Código                 | `setNotificationChannelAsync()` **antes** de pedir o token (ver armadilha §7.1)                                         |
| Orion (envio)          | service-account JSON do FCM V1 → OAuth 2.0 → `POST /v1/projects/<projeto>/messages:send`                                |
| `.gitignore`           | a service-account JSON do envio **nunca** entra no repo — ela é do servidor, não do app (ver nota)                      |
| Google Cloud           | se a API key do `google-services.json` tiver restrição, habilitar _FCM Registration API_ e _Firebase Installations API_ |
| Play Console           | usar o **SHA-1 da chave de assinatura de release**, não a de upload                                                     |

Permissão: `POST_NOTIFICATIONS` só existe no **Android 13+ (API 33)**; abaixo disso a notificação é
concedida por padrão — mas o **canal continua obrigatório** desde o Android 8.

**Props do plugin, conferidas no schema instalado (08/09/2026).**
`node_modules/expo-notifications/plugin/build/withNotifications.d.ts` declara exatamente
`icon?`, `color?` (default `'#ffffff'`), `defaultChannel?` e `sounds?: string[]` no lado Android —
os três primeiros são os que a linha acima usa. Não existe prop de canal além do `defaultChannel`:
qualquer outro canal é criado em runtime por `setNotificationChannelAsync()`.

**Nota sobre a service-account (achado 4 do §8 — ainda não consertado):** hoje **não há regra**
que a barre. O
`.gitignore` cobre `*.p8`, `*.p12`, `*.jks`, `*.key` e `*.mobileprovision` — nada pega um `.json` de
credencial, e `google-services.json` (que **deve** ser commitado) impede um `*.json` genérico. O
risco é baixo, porque a chave de envio é artefato de servidor e não tem motivo para passar por este
repo, mas o conserto é uma linha e cabe na mesma entrega.

### 5.2 iOS (APNs)

| Onde            | O quê                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apple Developer | capability **Push Notifications** no App ID `br.inf.teorema.autorizador4`                                                                                           |
| Apple Developer | chave **APNs `.p8`** + _Key ID_ + _Team ID_ — é o que o Orion usa para assinar o JWT de envio                                                                       |
| `app.json`      | `expo-notifications` em `plugins`; `enableBackgroundRemoteNotifications: true` **se** houver push silencioso (adiciona `remote-notification` a `UIBackgroundModes`) |
| Entitlement     | o plugin escreve `aps-environment` com o valor da prop `mode` (default `'development'`), e **só se a chave ainda não existir**                                      |
| Orion (envio)   | HTTP/2 para `api.sandbox.push.apple.com` (dev) **ou** `api.push.apple.com` (produção); tópico = bundle id                                                           |

Não há string de permissão (`Info.plist`) a preencher para notificação.

**Conferido no plugin instalado (08/09/2026):** `withNotificationsIOS.js` faz
`config.modResults['aps-environment'] = mode` — com `mode = 'development'` como default — **apenas
quando a chave ainda não está preenchida**, e `enableBackgroundRemoteNotifications: true` empurra
`'remote-notification'` para `UIBackgroundModes`. Ou seja: a promoção para produção é
`mode: 'production'` no `app.json` (ou um entitlement já escrito), **não** algo que o build de
release faça sozinho — a versão anterior deste documento dizia que o Xcode promovia, e não é o que
o plugin faz.

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

**Conferido nos typings (08/09/2026):** `NotificationPermissionsStatus` estende o
`PermissionResponse` do `expo`, então `granted` e `canAskAgain` existem como a função acima usa
(`NotificationPermissions.types.d.ts`). O bloco `ios?` traz `status: IosAuthorizationStatus`, um
`enum` real com `NOT_DETERMINED | DENIED | AUTHORIZED | PROVISIONAL | EPHEMERAL` — o §5.2 estava
certo. Uma consequência que o exemplo da própria documentação do Expo explicita: com autorização
**provisória** o `granted` vem `false`, e quem quiser aceitar provisional precisa testar
`ios?.status === IosAuthorizationStatus.PROVISIONAL` à parte. Para o autorizador, tratar provisional
como "não concedida" é o comportamento correto — notificação de decisão financeira não deve chegar
silenciosa —, mas é escolha, não acaso.

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

**Mas essa invalidação, como está escrita, paga a dívida D5 na hora errada.** `liberacoesKeys.all`
é prefixo de `credito(empresa, cliente)` e `historico(empresa, cliente)` — conferido em
`liberacoes.keys.ts`. Hoje o D5 (`CLAUDE.md §9`) é aceitável porque quem dispara é o usuário, ao
decidir. Com push, quem dispara é o **servidor**, num evento que o usuário não controla: cada
notificação recebida refaz a análise de crédito de todo cliente em cache. **A E1 é o momento de
criar o prefixo de fila** que o D5 já previa (`liberacoesKeys.fila`, com `pendentes` abaixo dele) e
invalidar só ele — senão a dívida deixa de ser dívida e vira defeito.

#### 6.4.1 Como ficou a invalidação (decisão registrada)

Três decisões, e a razão de cada uma:

**1. O prefixo de fila existe, e a chave não mudou de forma.** `liberacoesKeys.fila` é
`['liberacoes', 'pendentes']` e `pendentes(userCode)` continua produzindo
`['liberacoes', 'pendentes', userCode]` — exatamente o array de antes. Nomear o prefixo não
invalidou cache de ninguém nem alterou o comportamento de quem já existia; só passou a existir um
alvo estreito para invalidar. `credito` e `historico` seguem fora dele.

**2. O push invalida por tipo, não por feature.** `useRoteamentoPush` não recebe "invalide a fila":
recebe `atualizarPorTipo`, um `Partial<Record<TipoNotificacao, () => void>>`, e chama
`atualizarPorTipo[payload.tipo]?.()`. Notificação de `liberacao` chama o efeito de `liberacao`;
`cotacao` não tem efeito porque abre um web system, que não tem cache do TanStack Query. Um tipo
novo entra com o seu próprio efeito — ou com nenhum — em vez de herdar um alvo largo por descuido.

**3. A ligação mora na composição, não dentro de uma feature.** `features/push` não importa
`liberacoesKeys`: isso seria feature importando feature, que o `CLAUDE.md §2` proíbe — e a versão
anterior deste documento afirmava, errado, que a query key valeria como "contrato público" para
esse fim. Quem sabe invalidar a fila é a própria fila, em
`features/liberacoes/hooks/use-invalidar-fila.ts`; quem junta as duas pontas é
`app/(app)/_layout.tsx`, que é o que `app/` existe para fazer.

**O que continua devendo:** `use-decidir-liberacao.ts` ainda invalida `liberacoesKeys.all`. Não
mudei junto porque isso altera o que o usuário vê **depois de decidir** — é revisão da ficha C2,
não efeito colateral de push. O D5 segue no `CLAUDE.md §9`, agora com o prefixo pronto e uma linha
de distância.

**O `Href` do exemplo é rede de segurança só depois que os tipos existem — e eles não vêm no
checkout.** O `typedRoutes` está ligado no `app.json`, mas os tipos gerados vivem em
`.expo/types/router.d.ts`, que é **gitignorado**. Conferido em 08/09/2026 nas duas pontas:

| Estado do repositório             | `Href` devolvendo `'/(app)/rota-que-nao-existe'` |
| --------------------------------- | ------------------------------------------------ |
| checkout limpo, sem `.expo/types` | **passa** no `npm run typecheck`                 |
| depois de um `npx expo start`     | **falha** com `TS2322`                           |

O teste foi um arquivo descartável em `src/` com três funções tipadas como `Href`. Subir o dev
server (`npx expo start --dev-client`) gerou `.expo/types/router.d.ts` com a união literal das rotas
reais (`/(app)/menu`, `/(app)/liberacoes/[id]`, `/(app)/web/[sistema]`, …), e a partir daí o
`tsc --noEmit` acusou **os dois formatos** de rota inventada — a string
(`return '/(app)/rota-que-nao-existe'`) e o objeto
(`{ pathname: '/(app)/rota-que-nao-existe', params: { id: '1' } }`). A rota válida
`{ pathname: '/(app)/liberacoes/[id]', params: { id: '1' } }` compilou. O arquivo de teste foi
removido e o `router.d.ts` se regenerou sozinho sem ele — o typegen fica observando enquanto o
servidor está de pé.

**O `expo prebuild` não foi testado nesta rodada.** O dev server bastou para gerar os tipos, e o
`prebuild` cria `android/` e `ios/` (ambos gitignorados) sem que se precise deles aqui. Se alguém
depender do `prebuild` para gerar `.expo/types`, **confira**: a afirmação verificada é a do dev
server.

Conclusão prática, e ela não é "resolvido": **a proteção existe, mas é pressuposto de ambiente, não
garantia do repositório.** Num clone novo — ou numa máquina que nunca subiu o dev server — o
`typecheck` valida a _forma_ do objeto de rota e não a rota, e um `router.push` para rota
inexistente passa batido. Vale para o roteamento de push e para qualquer navegação do app. Fechar
isso de vez é gerar os tipos antes do `typecheck` (no `pre-push`, ou num CI quando houver) ou parar
de gitignorar `.expo/types` — decisão que não cabe nesta ficha, mas cabe registrar (achado 1 do §8).

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
8. **Emulador e simulador não têm token.** `getDevicePushTokenAsync()` só funciona em aparelho
   físico — no emulador Android e no simulador iOS ele falha, e não é falha de código. O guarda
   usual é `expo-device`, **instalado em 08/09/2026 na `57.0.1`** justamente para isso:
   `Device.isDevice` é uma constante `boolean` síncrona, então o guarda é
   `if (!Device.isDevice) return;` antes de pedir o token — sem `await`, sem estado. Instalar a
   dependência não escreve o guarda: **a E1 ainda precisa colocá-lo lá** (achado 3 do §8), ou alguém
   vai perder uma tarde achando que quebrou o registro.

---

## 8. Achados abertos da conferência contra o repositório

Cinco coisas que a conferência de 08/09/2026 encontrou e que **não são a decisão B7** — são trabalho
que a ficha E1 herda, ou correção deste documento. Cada uma diz o que já mudou e o que falta.

| #   | Achado                                                              | Onde vive | Estado após esta rodada                                            |
| --- | ------------------------------------------------------------------- | --------- | ------------------------------------------------------------------ |
| 1   | `typedRoutes` não protege num checkout limpo                        | §6.4      | **medido nas duas pontas**; a decisão de fechar continua em aberto |
| 2   | Invalidação por push herda a dívida D5                              | §6.4      | **em aberto** — é código da E1                                     |
| 3   | `getDevicePushTokenAsync()` falha em emulador, sem guarda           | §7.8      | dependência **instalada**; o guarda **não** foi escrito            |
| 4   | `.gitignore` não barra a service-account JSON do FCM                | §5.1      | **em aberto** — nada foi mexido nesta rodada                       |
| 5   | Citação de API invertida (`getLastNotificationResponse` × `…Async`) | §4.1      | **corrigido** neste documento                                      |

**1 — `typedRoutes`.** Rodar o dev server gera `.expo/types/router.d.ts` e o `tsc` passa a rejeitar
rota inexistente, nos dois formatos de `Href`; sem esse passo, aceita. Como `.expo/` é gitignorado,
a proteção é do ambiente, não do repositório — quem clonar e rodar só `npm run typecheck` não a tem.
O conserto é gerar os tipos antes do `typecheck` (hook `pre-push`, ou CI quando houver) ou versionar
`.expo/types`. **Não é assunto de push**: vale para todo `router.push` do app, e por isso não entra
na E1 sem uma decisão à parte.

**2 — D5.** `liberacoesKeys.all` é prefixo de `credito(…)` e `historico(…)`. Com push, quem dispara
a invalidação deixa de ser o usuário e passa a ser o servidor: **o momento de criar o prefixo de fila
é a E1**, antes de a invalidação existir. Detalhe e justificativa no §6.4.

**3 — guarda de emulador.** `expo-device@57.0.1` está instalado e `Device.isDevice` é constante
`boolean`. Falta o `if` no hook de registro — e falta decidir se, em emulador, o app apenas pula o
registro (recomendado) ou trata como erro comum (armadilha 5 do §7).

**4 — service-account.** O `.gitignore` cobre `*.p8`, `*.p12`, `*.jks`, `*.key` e
`*.mobileprovision`; nenhum padrão pega um `.json` de credencial, e um `*.json` genérico não serve
porque `google-services.json` **deve** ser commitado. Risco baixo (a chave de envio é artefato de
servidor), conserto de uma linha — e ele entra junto com o `google-services.json`, na mesma entrega
do §9.

**5 — a citação invertida.** Está corrigida no §4.1, com a tabela do estado real na 57.0.17. Fica
registrada aqui porque é a prova do motivo de reconferir contra `node_modules`: o erro veio de
leitura de documentação, sobreviveu a uma revisão, e só caiu quando os typings entraram no repo.

### 8.1 O que a implementação da E1 fechou

A ficha E1 foi escrita assumindo a **opção 1**. Arquivos novos, todos em `src/features/push/`:
`schemas/push-payload.schema.ts` e `schemas/token-push.schema.ts`, `api/push.api.ts`,
`lib/permissao-notificacao.ts`, `lib/canal-notificacao.ts`, `lib/exibicao-notificacao.ts`,
`lib/payload-push.ts`, `lib/rota-da-notificacao.ts`, `lib/registro-push.ts`,
`hooks/use-registrar-push.ts`, `hooks/use-roteamento-push.ts`, `stores/estado-push.store.ts` e
`components/aviso-push.tsx`. Fora da feature: o plugin no `app.json`,
`liberacoesKeys.fila`, `features/liberacoes/hooks/use-invalidar-fila.ts`, a composição em
`app/(app)/_layout.tsx`, o handler no `app/_layout.tsx` e o aviso no menu.

| Achado | O que mudou                                                                                                                                                                               |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | **continua aberto** — nada aqui muda o gitignore de `.expo/types`; é decisão de portão, não de push                                                                                       |
| 2      | **pago** — ver §6.4.1                                                                                                                                                                     |
| 3      | **fechado** — `registro-push.ts` sai por `Device.isDevice` antes de pedir o token                                                                                                         |
| 4      | **fechado** — o `.gitignore` barra `*service-account*.json`, `*serviceaccount*.json`, `*-adminsdk-*.json` e `fcm-*.json`, e diz por escrito que `google-services.json` continua commitado |
| 5      | **corrigido** — §4.1                                                                                                                                                                      |

**O que a E1 deliberadamente não fez**, porque não é código:

- `google-services.json` e `android.googleServicesFile` (§5.1) — dependem do Firebase Console. Sem
  eles o app compila e roda; o que não acontece é o registro no FCM.
- Credencial APNs `.p8`, capability e ambiente sandbox × produção (§5.2).
- O envio no Orion e as seis perguntas do §10 — em particular a lista real de payloads
  (pergunta 5), que é o que decide se `pushPayloadSchema` está completo.

**Nada foi executado em aparelho.** `lint` e `typecheck` passam, e é só isso que passou: sem build
nativo, nenhuma permissão foi pedida, nenhum token obtido e nenhuma notificação roteada.

---

## 9. O que muda neste repositório na opção 1

| Arquivo                                                         | Mudança                                                                                                                                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `package.json`                                                  | ✅ `expo-notifications@~57.0.17` — instalado em 08/09/2026 (§4)                                                                                                                      |
| `package.json`                                                  | ✅ `expo-device@~57.0.1` — instalado e usado no guarda de emulador                                                                                                                   |
| `app.json`                                                      | 🟨 `plugins`: `expo-notifications` com `defaultChannel: "liberacoes"`. Falta `android.googleServicesFile` (depende do arquivo) e o background mode do iOS, se houver push silencioso |
| `google-services.json`                                          | ⬜ depende do Firebase Console; entra na raiz, commitado                                                                                                                             |
| `src/features/push/lib/permissao-notificacao.ts`                | ✅ `garantirPermissao()` do §6.1 + `abrirConfiguracoesDeNotificacao()` do §6.2                                                                                                       |
| `src/features/push/lib/canal-notificacao.ts`                    | ✅ canal Android criado antes do token (armadilha 1)                                                                                                                                 |
| `src/features/push/lib/exibicao-notificacao.ts`                 | ✅ `setNotificationHandler` com os quatro campos obrigatórios (§4.1)                                                                                                                 |
| `src/features/push/lib/registro-push.ts`                        | ✅ guarda de emulador → canal → permissão → token → `tokenpush`                                                                                                                      |
| `src/features/push/lib/payload-push.ts`                         | ✅ `data` da notificação → payload validado ou `null` com `console.warn`                                                                                                             |
| `src/features/push/lib/rota-da-notificacao.ts`                  | ✅ payload → `Href` (§6.4)                                                                                                                                                           |
| `src/features/push/schemas/push-payload.schema.ts`              | ✅ união discriminada validando o payload                                                                                                                                            |
| `src/features/push/schemas/token-push.schema.ts`                | ✅ corpo do `tokenpush`; **sem** campo de plataforma, ver §10 pergunta 2                                                                                                             |
| `src/features/push/api/push.api.ts`                             | ✅ `POST /v1/application/tokenpush` no `centralApi`                                                                                                                                  |
| `src/features/push/hooks/use-registrar-push.ts`                 | ✅ dispara no efeito, com `device.registerId`; falha vira `console.warn`                                                                                                             |
| `src/features/push/hooks/use-roteamento-push.ts`                | ✅ listener + `useLastNotificationResponse` + efeito por tipo                                                                                                                        |
| `src/features/push/stores/estado-push.store.ts`                 | ✅ estado do registro, não persistido — liga o hook ao aviso                                                                                                                         |
| `src/features/push/components/aviso-push.tsx`                   | ✅ aviso dispensável, com Configurações no ramo definitivo (§6.2)                                                                                                                    |
| `src/app/_layout.tsx`                                           | ✅ `configurarExibicaoEmForeground()` no módulo, antes de qualquer notificação                                                                                                       |
| `src/app/(app)/_layout.tsx`                                     | ✅ os dois hooks e a ligação push → fila; é aqui que as duas features se encontram                                                                                                   |
| `src/features/notificacoes/hooks/use-notificacoes-nao-lidas.ts` | sai o `skipToken` quando E2 tiver endpoint; o badge é o mesmo cache                                                                                                                  |
| `src/features/liberacoes/api/liberacoes.keys.ts`                | prefixo de fila para a invalidação do §6.4 não derrubar `credito`/`historico` — paga o D5                                                                                            |
| `.gitignore`                                                    | regra para a service-account JSON do FCM (§5.1)                                                                                                                                      |
| `CLAUDE.md §6` · `§7.7` · `§9`                                  | linha de push da infraestrutura transversal, decisão registrada, D5 baixado da dívida                                                                                                |

`features/push/` é feature nova e **não** importa de `features/liberacoes/` (`CLAUDE.md §2`): o
roteamento devolve um `Href` e a invalidação usa a query key, que é o contrato público da fila.

---

## 10. Perguntas que precisam de resposta humana

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

## 11. Como isso se encaixa no plano

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

## 12. Referências

- `docs/analise-app-original.md` §5.2 (`tokenpush`), §5.4 (FCM/APNs no legado), §3.2 (permissão em
  laço e roteamento por form instanciado), §7.2.11 (JSON de teste), §7.2.13 (`Sleep`), §7.2.14 (laço
  e ramo vazio), §7.3.27 (`MemoDebugPush`).
- `docs/plano-migracao.md` — ficha E1, ficha E2 e §6 (🔒 B7).
- `CLAUDE.md` §4.4 (badge com `skipToken`), §4.8 (entrada não confiável), §5.4 (`console.warn`),
  §5.10 (sem espera artificial), §7.7, §7.8 (bundle id compartilhado).
- Conferido no próprio repositório em 08/09/2026, **com `expo-notifications@57.0.17` e
  `expo-device@57.0.1` instalados** (é o que dá para reproduzir sem rede e sem aparelho):
  - `node_modules/expo-notifications/build/index.d.ts` — superfície pública do pacote.
  - `build/NotificationsEmitter.d.ts` — `addNotificationResponseReceivedListener` e a deprecação
    real do par `…Async` (§4.1).
  - `build/Notifications.types.d.ts` — `NotificationBehavior`, `shouldShowAlert` deprecado e os
    quatro campos obrigatórios.
  - `build/NotificationPermissions.d.ts` + `.types.d.ts` — `granted`/`canAskAgain` e o enum
    `IosAuthorizationStatus` (§6.1).
  - `build/getDevicePushTokenAsync.d.ts` + `build/Tokens.types.d.ts` — `DevicePushToken` com
    `type: 'ios' | 'android'`.
  - `build/useLastNotificationResponse.d.ts`, `build/setBadgeCountAsync.d.ts`,
    `build/setNotificationChannelAsync.d.ts`.
  - `plugin/build/withNotifications.d.ts` e `plugin/build/withNotificationsIOS.js` — props do config
    plugin, `aps-environment` e `UIBackgroundModes` (§5).
  - `node_modules/expo-device/build/Device.d.ts` — `isDevice` como constante `boolean`.
  - `node_modules/expo-linking/build/Linking.d.ts` (`openSettings`),
    `node_modules/expo/bundledNativeModules.json` (o range que o SDK fixa),
    `src/features/liberacoes/api/liberacoes.keys.ts` (prefixo do D5), `app.json`, `.gitignore`.
  - `npx expo start` para gerar `.expo/types/router.d.ts` + um `tsc --noEmit` descartável, antes e
    depois, para medir o `Href` do §6.4.
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
