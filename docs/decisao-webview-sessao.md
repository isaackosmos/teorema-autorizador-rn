# Decisão B6 — sessão dentro da WebView

> **Status:** **opções levantadas; decisão do time pendente.** Nada foi implementado — nem a
> dependência existe ainda (🔒 B5).
> **Trava:** `CLAUDE.md §7.4` · `docs/plano-migracao.md` bloqueio 🔒 B6 (Bloco D, telas 14–17).
> **Escopo:** este documento decide **como a sessão chega ao HTML** e, no mesmo contrato, como o
> **contexto do borderô** (`sequencia` + `resposta`) chega lá — o desvio D7 anotado na revisão do
> Bloco C. Não decide 🔒 B2 (nativo × web) nem 🔒 B5 (instalar `react-native-webview`): as duas
> opções abaixo pressupõem que a resposta de B2 é **web**.

---

## 1. Recomendação em uma frase

**Handshake por `postMessage`** — a página anuncia que está pronta, o app responde com **um** payload
tipado contendo sessão _e_ contexto — porque é a única opção que fecha B6 **e** D7 sem depender do
Orion, e porque `injectedJavaScriptBeforeContentLoaded` sozinho não é confiável no Android. O
**cookie `HttpOnly`** (opção B) é melhor em segurança, mas não cobre o D7 e exige mudança de
servidor; se vamos pagar uma mudança de servidor, o alvo certo é o **ticket de uso único**
(opção C), que resolve o problema de raiz. Caminho: **A′ agora, C como alvo.**

---

## 2. O problema exato

### 2.1 O que o original faz

A sessão inteira vai no **fragmento (`#`) da URL** — `token`, `userId`, `companyId`, `codeCompany`,
`userCode`, `baseUrl`, tudo URL-encoded (`analise §5.3`), listado entre as falhas críticas em
`analise §7.1` e §7.2:

```
GET /v2/htmlresponse/autorizador/index.html#config=<...>&token=<JWT>&_t=1717171717
```

Por que isso é ruim, concretamente:

- o fragmento entra no **histórico da WebView** e no **cache**, e sobrevive ao logout do app;
- fica legível em `window.location.hash` para **qualquer** script da página, inclusive terceiros;
- vaza para `Referer`, para telemetria da própria página e para qualquer log de erro que registre a
  URL corrente;
- o `_t=<unix>` grudado no fim existe só para forçar o `init()` a rodar de novo (`analise §5.3`) — é
  sintoma de a sessão viajar pela URL, não uma otimização.

### 2.2 O que já existe neste repositório

| Arquivo                                                       | Situação                                                              |
| ------------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/app/(app)/web/[sistema].tsx`                             | placeholder; o comentário já proíbe o fragmento                       |
| `src/features/liberacoes/schemas/bordero-retorno.schema.ts`   | contrato de **volta** já tipado (`sequencia`, `situacao`, `resposta`) |
| `src/features/liberacoes/stores/bordero-retorno.store.ts`     | canal de volta, não persistido, consumido uma vez (`CLAUDE.md §4.11`) |
| `src/features/liberacoes/components/analise-liberacao.tsx:33` | **o D7**: `params: { sistema, sequencia, resposta }` — a ida é URL    |

Ou seja: o caminho de **volta** já está resolvido e tipado. Falta o de **ida** — e hoje ele é a mesma
classe de problema do fragmento, um nível acima:

```tsx
router.push({
  pathname: '/(app)/web/[sistema]',
  params: { sistema: 'autorizador', sequencia: sequenciaBordero ?? '', resposta },
});
```

`resposta` é **texto livre digitado pelo usuário** sobre uma decisão financeira, viajando numa URL de
rota. Ainda não é a URL da WebView, mas é uma URL: entra no estado de navegação do Expo Router, é
serializável, aparece em deep link e em qualquer log de navegação. E, se a tela web for escrita sem
decidir B6 antes, é dessa URL que o desenvolvedor vai copiar os valores direto para a URL do HTML —
o fragmento voltaria por inércia.

### 2.3 Quatro fatos que restringem as opções

1. **O HTML é servido pelo próprio tenant.** `GET /v2/htmlresponse/<sistema>/index.html` sai da mesma
   `baseURL` que a API (`device.serverUrlActive`). Página e API são **mesma origem** — o que torna o
   cookie tecnicamente viável, e torna o `baseUrl` que hoje viaja na URL uma informação que a página
   já poderia inferir.
2. **A página faz as próprias chamadas autenticadas.** Ela não é uma view passiva: precisa do token
   para os `fetch`/XHR dela. Qualquer mecanismo que autentique **só o documento inicial** não serve.
3. **Cada sistema espera um conjunto de parâmetros** (`plano D`): `autcompras`/`autcotacao` querem
   `baseUrl, token, userId, companyId, codeCompany, userCode`; `reqcompras` só
   `baseUrl, token, userId`. O contrato de dados é do HTML — o que está em discussão é o
   **transporte**.
4. **Mudança no Orion é o caminho lento.** 🔒 B1 é a prova: a decisão do app está tomada e commitada
   há tempo, e o login continua sem funcionar porque o servidor não subiu. Opção que dependa do
   backend não destrava o Bloco D no prazo do Bloco D.

---

## 3. Opção A — `injectedJavaScriptBeforeContentLoaded` + `postMessage`

A sessão nunca aparece na URL: ela é **injetada no contexto JS** da página antes do conteúdo, e a
página devolve o que produzir pela ponte `onMessage`.

### 3.1 A forma direta (A)

```tsx
const payload = JSON.stringify({ baseUrl, token, userId, companyId, codeCompany, userCode });

<WebView
  source={{ uri: `${baseUrl}/v2/htmlresponse/${sistema}/index.html` }}
  injectedJavaScriptBeforeContentLoaded={`window.__TEOREMA_SESSION__ = ${payload}; true;`}
  onMessage={tratarMensagem}
/>;
```

**Problema documentado:** no iOS isso é um `WKUserScript` em `atDocumentStart` e roda de fato antes
dos scripts da página; no **Android** a injeção acontece em `onPageStarted` e a própria documentação
do `react-native-webview` avisa que **não há garantia de rodar antes dos scripts da página**. Uma
página que leia `window.__TEOREMA_SESSION__` no topo do bundle funciona no iOS e falha
intermitentemente no Android — o pior tipo de falha. (A verificar contra a versão que 🔒 B5
instalar; a ressalva vale como premissa de projeto, não como bug observado.)

### 3.2 A forma recomendada (A′ — handshake)

Inverte quem começa: a página pede, o app responde. Assim a corrida deixa de existir.

```tsx
// A página, quando pronta:
//   window.ReactNativeWebView.postMessage(JSON.stringify({ tipo: 'sessao:solicitar' }));

function tratarMensagem(event: WebViewMessageEvent) {
  const msg = mensagemWebSchema.safeParse(JSON.parse(event.nativeEvent.data));
  if (!msg.success) return;

  if (msg.data.tipo === 'sessao:solicitar') {
    ref.current?.injectJavaScript(`window.__teoremaInit(${JSON.stringify(payload)}); true;`);
  }
  if (msg.data.tipo === 'bordero:retorno') {
    publicar(msg.data.retorno); // borderoRetornoSchema, store da §4.11
  }
}
```

- `injectJavaScript` (imperativo, pelo ref) roda **quando o app quer**, sem depender de ciclo de vida
  de página.
- Recarregar a página refaz o handshake sozinho: **morre o `_t=<unix>`** do original, que era
  exatamente o remendo para o `init()` não rodar de novo.
- É a mesma ponte para os dois sentidos → atende ao "um contrato de mensagem só" do plano D
  (`app://menu` e `delphi://` viram um).

### 3.3 Prós

- **Zero token na URL** — nem query, nem fragmento, nem histórico, nem cache.
- **Não depende do Orion.** Só do HTML, que é nosso e mora no mesmo servidor. Destrava o Bloco D sem
  entrar na fila de B1/B4.
- **Cobre o D7 no mesmo payload** (ver §7): sessão e contexto viajam juntos, tipados, validados por
  Zod nas duas pontas. Uma mudança, dois bloqueios.
- **Contexto por abertura, não por sessão.** `sequencia` e `resposta` pertencem a _esta_ abertura da
  tela; um cookie de sessão não sabe expressar isso.
- **Funciona para os `fetch` da própria página** (fato 2.3.2): o token está em JS, que é de onde a
  página monta os headers dela hoje.
- **Termina com a página.** Fechada a WebView, o contexto JS morre; não há jar de cookie para limpar
  no logout.

### 3.4 Contras

- **O token fica legível em JavaScript.** Qualquer XSS, dependência comprometida ou script de
  terceiro dentro do HTML lê `window.__TEOREMA_SESSION__`. É estritamente pior que um cookie
  `HttpOnly` — e é o argumento que só a opção C resolve.
- **Injeta em toda página carregada.** Se o HTML navegar para fora, a injeção acompanha. Exige
  `originWhitelist` + `onShouldStartLoadWithRequest` travados na origem do tenant (§9).
- **Exige mudança no HTML** (expor `__teoremaInit` e mandar `sessao:solicitar`). Menor que mudar o
  Orion, mas não é zero — e enquanto o HTML só souber ler o fragmento, o app teria de conviver com
  os dois. Não conviver: a página é atualizada junto, ou o Bloco D espera.
- **Ponte é `string`.** `window.ReactNativeWebView.postMessage` só aceita string; JSON + Zod nas duas
  pontas é obrigatório, não opcional.
- **Injeção é concatenação de código.** `JSON.stringify` no payload é a defesa mínima; `resposta` é
  texto livre do usuário e entraria no meio de um `<script>` (§9).
- A ponte só existe quando `onMessage` está definido — omitir a prop quebra a injeção no Android
  silenciosamente.

---

## 4. Opção B — header ou cookie de sessão

### 4.1 Header no `source` — não serve sozinho

```tsx
<WebView source={{ uri, headers: { Authorization: `Bearer ${jwt}` } }} />
```

Os headers de `source` valem **só para a requisição do documento principal**. Não acompanham
navegação subsequente, nem subrecursos, nem os `fetch`/XHR que a página faz. Contra o fato 2.3.2,
isso reprova: a página carregaria e todas as chamadas dela voltariam 401. Header serve para
_entregar o HTML_ com autenticação, não para _dar sessão_ à página. Fica descartado como mecanismo
único; pode ser um complemento se o Orion passar a exigir auth no próprio `htmlresponse`.

### 4.2 Cookie de sessão — a alternativa real

Página e API são mesma origem (fato 2.3.1), então um cookie de sessão do domínio do tenant é enviado
automaticamente **tanto** no documento **quanto** em todo `fetch` da página, sem uma linha de JS.

Duas formas de plantá-lo:

- **O servidor emite** — o `/v1/auth/login` responde
  `Set-Cookie: session=…; HttpOnly; Secure; SameSite=Lax`, e a WebView usa o jar compartilhado
  (`sharedCookiesEnabled` no iOS, `thirdPartyCookiesEnabled` no Android). Mudança de contrato no
  Orion.
- **O app planta** — `@react-native-cookies/cookies` grava o cookie antes de montar a WebView. Menos
  servidor, mas então o valor passa pelo JS do app e o cookie **não** é `HttpOnly` de ponta a ponta
  com o mesmo rigor — perde parte da vantagem que justifica a opção.

**Prós**

- **`HttpOnly` tira o token do alcance do JavaScript.** É a única das duas opções imune a XSS na
  página. Em segurança pura, é a melhor.
- **Nada na URL** — mesmo ganho da opção A quanto ao fragmento.
- **Transparente para o HTML** nas chamadas de API: mesma origem, credenciais viajam sozinhas.
- Rotação e expiração passam a ser do servidor, onde deviam estar.

**Contras**

- **Não resolve o D7.** Cookie carrega _sessão_, não _contexto de abertura_. `sequencia` e `resposta`
  continuariam precisando de outro caminho — provavelmente a URL, ou seja, o D7 sobrevive e a opção
  A′ acaba precisando existir de qualquer forma, em paralelo. Dois mecanismos para o mesmo trajeto é
  exatamente o que o `CLAUDE.md §5.8` proíbe.
- **Depende do Orion** para valer a pena (a variante "o app planta" abre mão do principal benefício).
  Cai na fila do 🔒 B1/🔒 B4 — e hoje o Orion autentica por `Authorization: Bearer`, não por cookie.
- **Não cobre os parâmetros que o HTML espera.** `userId`, `companyId`, `codeCompany`, `userCode`
  (fato 2.3.3) não são sessão; ou a página passa a buscá-los numa rota nova (mais servidor), ou eles
  voltam para a URL.
- **Resíduo entre usuários.** O jar de cookie da WebView **persiste** entre execuções; o aparelho é
  compartilhado (é por isso que o cache de empresas é `empresas:<userCode>`, `CLAUDE.md §4.10`).
  Exige limpeza explícita no logout e na troca de usuário — um passo novo, fácil de esquecer, cujo
  esquecimento é silencioso e grave.
- **Duas plataformas, dois jars**, com flags e comportamentos distintos (`sharedCookiesEnabled` ×
  `thirdPartyCookiesEnabled`). Mais superfície de teste — num projeto que ainda não tem runner (§1).
- `SameSite`/`Secure` obrigam **HTTPS no tenant**. Vale verificar: o onboarding aceita endereço
  primário/secundário digitado, e nada garante hoje que seja `https`.

---

## 5. Opção C — ticket de uso único (o alvo, não o agora)

Nenhuma das duas opções acima resolve o problema de raiz: **o JWT do usuário continua sendo entregue
à página**, seja em JS (A) ou implicitamente em cookie (B). O padrão que resolve:

1. o app pede ao Orion um **ticket** de vida curta (segundos) e uso único, escopado a `<sistema>` +
   `<sequencia>`;
2. o ticket vai na URL — e pode ir, porque vazar um ticket já usado não vale nada;
3. o HTML troca o ticket por uma sessão própria numa chamada ao Orion.

**Prós:** o JWT do usuário nunca entra na WebView; o que estiver no histórico é inútil; contexto
(`sequencia`, `resposta`) vira **escopo do ticket**, validado no servidor — o D7 deixa de ser um
problema de transporte e passa a ser um dado autorizado.
**Contra:** é 100% servidor. Rota nova, armazenamento de ticket, TTL — a mesma classe de trabalho de
🔒 B3 (TTL de reserva) e 🔒 B1. Não destrava o Bloco D agora.

Registrado aqui para que a escolha de A′ seja **decisão consciente de prazo**, e para que, se o time
abrir uma frente no Orion, ela vá para C e não para B.

---

## 6. Comparação

| Critério                                            | A′ `postMessage`         | B cookie `HttpOnly`           | C ticket             |
| --------------------------------------------------- | ------------------------ | ----------------------------- | -------------------- |
| Token fora da URL / histórico / cache               | ✅                       | ✅                            | ✅ (só ticket morto) |
| Token inacessível ao JS da página                   | ❌ está em `window`      | ✅                            | ✅ (nem chega lá)    |
| Autentica os `fetch` da própria página (fato 2.3.2) | ✅ (a página põe header) | ✅ (automático)               | ✅                   |
| Entrega os parâmetros do HTML (fato 2.3.3)          | ✅ no payload            | ❌ voltam para a URL          | ✅ no escopo         |
| **Resolve o D7 no mesmo mecanismo**                 | ✅                       | ❌ precisa de A′ também       | ✅                   |
| Depende de mudança no Orion (fato 2.3.4)            | ❌ não                   | ✅ sim                        | ✅ sim, bastante     |
| Exige mudança no HTML dos web systems               | ✅ sim                   | parcial                       | ✅ sim               |
| Resíduo após logout / troca de usuário              | nenhum                   | jar de cookie, precisa limpar | nenhum               |
| Mata o `_t=<unix>` (`analise §5.3`)                 | ✅                       | ❌                            | ❌                   |
| Superfície de teste por plataforma                  | baixa                    | alta (2 jars)                 | baixa                |
| Destrava o Bloco D no prazo do Bloco D              | ✅                       | improvável                    | não                  |

---

## 7. Como isso resolve o D7 — e o que muda no app em qualquer cenário

O D7 são **dois trechos de URL**, e eles se resolvem em lugares diferentes:

**(a) App → WebView.** Com A′, `sequencia` e `resposta` entram no mesmo payload do handshake:

```ts
{ sessao: { baseUrl, token, userId, companyId, codeCompany, userCode },
  contexto: { sequencia, resposta } }
```

Nada disso toca a URL do HTML. Com B, o `contexto` fica órfão e volta para a query — o D7 continua
aberto.

**(b) Análise → rota `web/[sistema]`.** Independe da opção escolhida: `resposta` **não deve** ser
parâmetro de rota. O repositório já tem o padrão exato, e é o espelho do que já funciona — o
`bordero-retorno.store.ts` (`CLAUDE.md §4.11`) resolve a **volta**; falta o gêmeo da **ida**:

- `features/liberacoes/stores/bordero-abertura.store.ts` — não persistido, `publicar(payload)` na
  análise, `consumir(sequencia)` na rota web, limpando na leitura;
- payload validado por um `borderoAberturaSchema` novo, irmão do `borderoRetornoSchema`;
- na URL da rota sobra **só** `sistema`, que é o parâmetro da rota e não é dado de ninguém.

Assim o texto livre do usuário deixa de existir como URL em qualquer ponto do trajeto, e o par
ida/volta fica simétrico e legível: um store para cada sentido, o mesmo padrão nos dois.

---

## 8. Caminho proposto

1. **Decidir 🔒 B2** (web × nativo). Se for nativo, este documento vira histórico.
2. **Instalar `react-native-webview`** (🔒 B5) e **confirmar na versão instalada** o comportamento de
   `injectedJavaScriptBeforeContentLoaded` no Android (§3.1). O handshake de A′ dispensa a garantia —
   a verificação é para saber se o `window.__TEOREMA_SESSION__` direto pode ser um atalho legítimo em
   alguma tela, não para escolher o mecanismo.
3. **Fechar o contrato de mensagem com quem mantém o HTML** — é a dependência de fato de A′.
   Mensagens propostas, uma só ponte, ambas as direções validadas por Zod:

   | Sentido    | `tipo`             | Carga                                           |
   | ---------- | ------------------ | ----------------------------------------------- |
   | HTML → app | `sessao:solicitar` | —                                               |
   | app → HTML | `sessao:init`      | `{ sessao, contexto }`                          |
   | HTML → app | `bordero:retorno`  | `{ sequencia, situacao, resposta }` (já existe) |
   | HTML → app | `navegacao:fechar` | — (substitui `app://menu` e `delphi://`)        |

4. **Implementar A′ + o store de ida** do §7 na mesma entrega do Bloco D.
5. **Registrar C como pendência de servidor**, junto de 🔒 B3 e 🔒 B4 — não como "melhoria futura"
   vaga, mas como a forma correta que o app hoje não pode implementar sozinho.

---

## 9. Cuidados válidos para qualquer opção

- **Travar a navegação na origem do tenant**: `originWhitelist` + `onShouldStartLoadWithRequest`. Sem
  isso, A′ injeta sessão em página estranha e B manda cookie para onde não deve.
- **`JSON.stringify` em tudo que entra em script injetado.** `resposta` é texto do usuário;
  `</script>` e barras invertidas não são hipótese remota.
- **Toda mensagem que chega do HTML passa por Zod** e é descartada em silêncio se não casar — a
  WebView é entrada não confiável, igual à rede e ao disco (`CLAUDE.md §4.8`).
- **`onMessage` sempre definido**, ou a ponte não existe no Android.
- **Sem cache e sem histórico**: avaliar `cacheEnabled={false}` / `incognito` na rota web. Barato, e
  ataca o mesmo resíduo que o fragmento causava.
- **A situação do borderô (`S`/`N`/`P`) continua com zero implementações no app**
  (`analise §7.3.21`). O app repassa; quem calcula é o borderô.
- **`_t=<unix>` não entra.** Se a página não reagir a uma nova sessão, isso é pendência do web
  system.
- **Se B for escolhida:** limpar o jar (`CookieManager.clearAll()`) no `signOut` **e** na troca de
  usuário, e conferir que o tenant é HTTPS.

---

## 10. O que muda neste repositório se A′ for aprovada

| Arquivo                                                       | Mudança                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------- |
| `package.json`                                                | `react-native-webview` (🔒 B5)                                      |
| `src/app/(app)/web/[sistema].tsx`                             | placeholder → WebView + handshake; só compõe (`plano §5.1`)         |
| `src/features/web-systems/schemas/mensagem-web.schema.ts`     | novo: união discriminada das mensagens da ponte                     |
| `src/features/web-systems/lib/sessao-web.ts`                  | novo: monta o payload por `sistema` a partir da sessão (fato 2.3.3) |
| `src/features/liberacoes/stores/bordero-abertura.store.ts`    | novo: canal de ida, espelho do de volta (§7b)                       |
| `src/features/liberacoes/schemas/bordero-abertura.schema.ts`  | novo: irmão do `borderoRetornoSchema`                               |
| `src/features/liberacoes/components/analise-liberacao.tsx:33` | `publicar()` + `router.push({ params: { sistema } })` — fim do D7   |
| `CLAUDE.md §6` · `§7.4` · `§9`                                | status das telas 14–17, decisão registrada, D7 baixado da dívida    |

O `features/web-systems/` é feature nova e não importa de `features/liberacoes/` — o contexto do
borderô chega pelo store de ida, consumido pela **rota**, que é quem pode falar com as duas
(`CLAUDE.md §2`, regras de dependência).

---

## 11. Perguntas que precisam de resposta humana

1. 🔒 B2: web ou nativo? Tudo aqui pressupõe web.
2. Quem mantém o HTML dos quatro web systems, e há disposição para expor `__teoremaInit` e o
   `sessao:solicitar`? **É a dependência crítica de A′** — sem ela, nenhuma opção que tire a sessão
   da URL funciona, porque a página é quem lê a sessão.
3. Existe frente aberta no Orion? Se sim, C entra nela; se não, A′ é o caminho.
4. O tenant é sempre HTTPS? (Decide se B é sequer viável, e vale saber de qualquer forma — a decisão
   B1 aposta em TLS para a senha.)
5. Aceita-se rodar A′ e depois migrar para C, com o HTML suportando os dois por um período?

---

## 12. Referências

- `docs/analise-app-original.md` §5.3 (fragmento, `app://menu`, `delphi://`, `_t=<unix>`), §7.1 (JWT
  no fragmento), §7.3.21 (três forms idênticos e a regra `S`/`N`/`P` triplicada).
- `docs/plano-migracao.md` — Bloco D e §6 (🔒 B2, B5, B6).
- `docs/decisao-hash-senha.md` — precedente de 🔒: decisão do app tomada, servidor pendente.
- `CLAUDE.md` §4.11 (store efêmero consumido uma vez), §4.8 (entrada não confiável), §5.8 (um jeito
  só de fazer cada coisa), §9 D7.
- `react-native-webview`: props `injectedJavaScriptBeforeContentLoaded`, `injectJavaScript`,
  `onMessage`, `originWhitelist`, `onShouldStartLoadWithRequest`, `sharedCookiesEnabled`,
  `thirdPartyCookiesEnabled`, `incognito` — **conferir na versão que 🔒 B5 instalar**; as ressalvas
  de plataforma do §3.1 são premissa de projeto, ainda não verificadas neste repo.
