# Decisão B6 — sessão dentro da WebView

> **Status:** **DECIDIDA e IMPLEMENTADA em 10/09/2026 — opção A′ (handshake por `postMessage`).**
> A decisão e o contrato estão em [§13](#13-decisão-final--10092026); o que o app já faz, em
> [§14](#14-implementação--10092026). §3 a §7 ficam como o histórico que levou à escolha.
> **Trava:** era `CLAUDE.md §7.4` · `docs/plano-migracao.md` 🔒 B6 (Bloco D, telas 14–17) — **B6 sai
> da lista de bloqueios**. O que resta não é decisão: é a combinação com quem mantém o HTML (§13.5).
> **Escopo:** este documento decide **como a sessão chega ao HTML** e, no mesmo contrato, como o
> **contexto do borderô** (`sequencia` + `resposta`) chega lá — o desvio D7 anotado na revisão do
> Bloco C. Não decide 🔒 B2 (nativo × web) nem 🔒 B5 (instalar `react-native-webview`): a decisão
> pressupõe que a resposta de B2 é **web**.
>
> **Atualização de 04/09/2026 — a metade do D7 que era só do app já foi corrigida**, sem esperar a
> decisão: a ida da análise para a rota `web/[sistema]` passou para o
> `bordero-abertura.store.ts` e na URL sobrou só `sistema` (§2.2, §7b). A travessia app → HTML, para
> a sessão **e** para esse contexto, é o que §13 fecha.

---

## 1. Recomendação em uma frase

> **Aceita em 10/09/2026.** Decisão, justificativa contra o estado do repo e contrato de
> mensagem em [§13](#13-decisão-final--10092026).

**Handshake por `postMessage`** — a página anuncia que está pronta, o app responde com **um** payload
tipado contendo sessão _e_ contexto — porque é a única opção que fecha B6 **e** a metade (a) do D7
sem depender do Orion, e porque `injectedJavaScriptBeforeContentLoaded` sozinho não é confiável no
Android. O **cookie `HttpOnly`** (opção B) é melhor em segurança, mas não cobre o contexto do D7 e
exige mudança de servidor; se vamos pagar uma mudança de servidor, o alvo certo é o
**ticket de uso único**
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

| Arquivo                                                      | Situação                                                                         |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `src/app/(app)/web/[sistema].tsx`                            | placeholder; o comentário já proíbe o fragmento                                  |
| `src/features/liberacoes/schemas/bordero-retorno.schema.ts`  | contrato de **volta** já tipado (`sequencia`, `situacao`, `resposta`)            |
| `src/features/liberacoes/stores/bordero-retorno.store.ts`    | canal de volta, não persistido, consumido uma vez (`CLAUDE.md §4.11`)            |
| `src/features/liberacoes/schemas/bordero-abertura.schema.ts` | contrato de **ida** já tipado (`sistema`, `sequencia`, `resposta`)               |
| `src/features/liberacoes/stores/bordero-abertura.store.ts`   | canal de ida, gêmeo do de volta; consumido pelo `sistema` da rota                |
| `src/features/liberacoes/components/analise-liberacao.tsx`   | `publicar()` + `push({ params: { sistema } })` — **a metade (b) do D7, fechada** |

Ou seja: os dois caminhos **dentro do app** já estão resolvidos e tipados. Até esta correção a ida
era a mesma classe de problema do fragmento, um nível acima:

```tsx
// ANTES — a ida era URL
router.push({
  pathname: '/(app)/web/[sistema]',
  params: { sistema: 'autorizador', sequencia: sequenciaBordero ?? '', resposta },
});

// AGORA — na URL sobra só o parâmetro da rota
publicarAbertura(borderoAberturaSchema.parse({ sistema: SISTEMA_BORDERO, sequencia, resposta }));
router.push({ pathname: '/(app)/web/[sistema]', params: { sistema: SISTEMA_BORDERO } });
```

O motivo, registrado porque vale para qualquer rota nova: `resposta` é **texto livre digitado pelo
usuário** sobre uma decisão financeira. Como parâmetro de rota ainda não era a URL da WebView, mas
era uma URL — entra no estado de navegação do Expo Router, é serializável, aparece em deep link e em
qualquer log de navegação. E, pior, se a tela web fosse escrita a partir dela, era desses parâmetros
que os valores seriam copiados direto para a URL do HTML: o fragmento voltaria por inércia. Fechar a
ida agora tira esse atalho do caminho **antes** de o Bloco D começar.

O que a decisão B6 ainda precisa cobrir é a metade (a): como esse contexto — e a sessão — atravessam
a fronteira app → HTML. Ver §7.

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

O D7 eram **dois trechos de URL**, e eles se resolvem em lugares diferentes. O segundo já está
resolvido; o primeiro é o que esta decisão trava:

**(a) App → WebView.** Com A′, `sequencia` e `resposta` entram no mesmo payload do handshake:

```ts
{ sessao: { baseUrl, token, userId, companyId, codeCompany, userCode },
  contexto: { sequencia, resposta } }
```

Nada disso toca a URL do HTML. Com B, o `contexto` fica órfão e volta para a query — o D7 continua
aberto.

**(b) Análise → rota `web/[sistema]`. ✅ FEITO** — independia da opção escolhida, então foi corrigido
antes da decisão. O padrão é o espelho do que já funcionava: o `bordero-retorno.store.ts`
(`CLAUDE.md §4.11`) resolve a **volta**, e agora existe o gêmeo da **ida**:

- `features/liberacoes/stores/bordero-abertura.store.ts` — não persistido, `publicar(payload)` na
  análise, `consumir(sistema)` na rota web, limpando na leitura. A chave é o `sistema` porque é a
  única identidade que a rota tem: ela não conhece a `sequencia` (que é justamente o dado que saiu
  da URL);
- payload validado por `borderoAberturaSchema`, irmão do `borderoRetornoSchema`, reaproveitando o
  campo `resposta` de `decisaoSchema` — é o mesmo texto, com o mesmo limite;
- na URL da rota sobra **só** `sistema`, que é o parâmetro da rota e não é dado de ninguém.

O texto livre do usuário deixou de existir como URL dentro do app, e o par ida/volta ficou simétrico:
um store para cada sentido, o mesmo padrão nos dois. Falta só o **consumo**, que é do contêiner web
— hoje placeholder. Com A′, `consumir(sistema)` alimenta direto o `contexto` do payload de handshake;
com B, esse mesmo contexto é o que fica órfão e volta para a query do HTML.

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

4. **Implementar A′** na entrega do Bloco D e **consumir o store de ida** no contêiner web:
   `consumir(sistema)` → `contexto` do handshake (§7b). O store e o schema já existem; falta a
   ponta que lê.
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

| Arquivo                                                      | Mudança                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------------- |
| `package.json`                                               | `react-native-webview` (🔒 B5)                                      |
| `src/app/(app)/web/[sistema].tsx`                            | placeholder → WebView + handshake; só compõe (`plano §5.1`)         |
| `src/features/web-systems/schemas/mensagem-web.schema.ts`    | novo: união discriminada das mensagens da ponte                     |
| `src/features/web-systems/lib/sessao-web.ts`                 | novo: monta o payload por `sistema` a partir da sessão (fato 2.3.3) |
| `src/features/liberacoes/stores/bordero-abertura.store.ts`   | ✅ já existe: canal de ida, espelho do de volta (§7b)               |
| `src/features/liberacoes/schemas/bordero-abertura.schema.ts` | ✅ já existe: irmão do `borderoRetornoSchema`                       |
| `src/features/liberacoes/components/analise-liberacao.tsx`   | ✅ já feito: `publicar()` + `push({ params: { sistema } })`         |
| `CLAUDE.md §6` · `§7.4`                                      | status das telas 14–17 e decisão registrada; o resto do D7 baixado  |

O `features/web-systems/` é feature nova e não importa de `features/liberacoes/` — o contexto do
borderô chega pelo store de ida, consumido pela **rota**, que é quem pode falar com as duas
(`CLAUDE.md §2`, regras de dependência).

---

## 11. Perguntas que precisam de resposta humana

Situação de cada uma depois da decisão em §13.2 — **só a 2 continua pendente**, e é a
dependência de entrega do Bloco D.

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
- `docs/plano-migracao.md` — Bloco D e §6 (🔒 B2 e B5; B6 baixado em 10/09/2026 por §13).
- `docs/decisao-hash-senha.md` — precedente de 🔒: decisão do app tomada, servidor pendente.
- `CLAUDE.md` §4.11 (store efêmero consumido uma vez), §4.8 (entrada não confiável), §5.8 (um jeito
  só de fazer cada coisa), §7.4 (registro do D7).
- `react-native-webview`: props `injectedJavaScriptBeforeContentLoaded`, `injectJavaScript`,
  `onMessage`, `originWhitelist`, `onShouldStartLoadWithRequest`, `sharedCookiesEnabled`,
  `thirdPartyCookiesEnabled`, `incognito` — **conferir na versão que 🔒 B5 instalar**; as ressalvas
  de plataforma do §3.1 são premissa de projeto, ainda não verificadas neste repo.

---

## 13. Decisão final — 10/09/2026

**Escolhida a opção A′: handshake por `postMessage`.** A página anuncia que está pronta, o app
responde com **um** payload tipado contendo sessão _e_ contexto. Nada — nem token, nem `sequencia`,
nem `resposta` — trafega em URL, query ou fragmento. **C (ticket de uso único) permanece como alvo**
quando houver frente aberta no Orion; a migração é do transporte, o contrato de dados de §13.3 não
muda.

Com isso **🔒 B6 sai da lista de bloqueios** do `plano-migracao.md §6` e do `CLAUDE.md §7`. O Bloco D
continua parado em 🔒 B2 e 🔒 B5, e na combinação com quem mantém o HTML (§13.5) — que é dependência
de entrega, não decisão em aberto.

### 13.1 Por que A′ continua sendo a melhor — conferido no repo em 10/09/2026

| Evidência no repositório                                                                                              | O que ela decide                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/(app)/web/[sistema].tsx` segue placeholder, e o comentário de cabeçalho já descreve A′ ponta a ponta         | nenhuma linha de transporte foi escrita ainda — a decisão não custa retrabalho, e o arquivo já está preparado para ela                                                    |
| `bordero-abertura.store.ts` existe, com `consumir(sistema)` **sem chamador**                                          | a única ponta que falta é a rota web. Com A′ ela alimenta `contexto` direto; com B o store perde a razão de existir e o contexto volta para a query — contra §4.11 e §5.8 |
| `bordero-retorno.store.ts` é o espelho, com `publicar` **sem produtor**                                               | os dois sentidos fecham na **mesma** ponte `onMessage`/`injectJavaScript`: um mecanismo, não dois                                                                         |
| `borderoAberturaSchema` e `borderoRetornoSchema` já tipados, `resposta` reaproveitando `decisaoSchema.shape.resposta` | o payload de A′ não inventa contrato: só falta `mensagem-web.schema.ts` (união das mensagens) e `sessao-web.ts` (recorte por sistema)                                     |
| 🔒 B1 continua travado no servidor — o login **nunca** rodou contra um Orion real (`CLAUDE.md §6`, ressalva)          | confirma o fato 2.3.4 na prática: opção que dependa do Orion (B ou C) não destrava o Bloco D no prazo do Bloco D                                                          |

Nada mudou desde 04/09 que enfraqueça A′ — e a metade (b) do D7, já fechada, **torna A′ mais barata
do que era quando o documento foi escrito**: o contexto já chega à rota web tipado e validado, basta
repassá-lo no payload do handshake.

O contra conhecido continua de pé e é aceito conscientemente: **o token fica legível em JavaScript
dentro da página**. É o preço de não depender do Orion, e é exatamente o que C resolve.

### 13.2 Perguntas de §11 — como ficam

| #   | Pergunta                            | Situação                                                                                                                      |
| --- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | 🔒 B2 web ou nativo                 | **pressuposto: web.** B2 continua formalmente aberta; se virar nativo, este documento vira histórico                          |
| 2   | Quem mantém o HTML, e há disposição | **continua pendente — é a dependência crítica.** §13.5 é a pauta dessa conversa                                               |
| 3   | Frente aberta no Orion              | não há; é o que sustenta A′ agora                                                                                             |
| 4   | Tenant sempre HTTPS                 | segue sem resposta. Deixa de decidir B, mas continua valendo pelo 🔒 B1 (senha em texto puro sobre TLS)                       |
| 5   | Rodar A′ e migrar para C depois     | **sim.** É a decisão. O HTML pode suportar os dois por um período: o `sessao:init` de §13.3 não muda, muda quem monta o token |

### 13.3 Contrato de mensagem (v1)

Duas pontes, uma para cada sentido, e **um** formato:

- **HTML → app:** `window.ReactNativeWebView.postMessage(<string JSON>)`, lido em `onMessage`.
- **app → HTML:** `ref.current?.injectJavaScript(...)`, chamando uma função que o HTML expõe.

Toda mensagem é um objeto JSON UTF-8 com o mesmo envelope:

```json
{ "v": 1, "tipo": "<nome>" }
```

...mais os campos próprios daquela mensagem.

- `v` — inteiro, hoje sempre `1`. Mensagem com `v` diferente do esperado é **descartada em silêncio**
  pelas duas pontas; é o que permite subir uma v2 sem quebrar app instalado.
- `tipo` — discriminante da união Zod em `features/web-systems/schemas/mensagem-web.schema.ts`.
- Campo desconhecido é ignorado (comportamento padrão do Zod, sem `passthrough`).

Quatro mensagens, e só quatro:

| Sentido    | `tipo`             | Carga                   |
| ---------- | ------------------ | ----------------------- |
| HTML → app | `sessao:solicitar` | —                       |
| app → HTML | `sessao:init`      | `{ sessao, contexto? }` |
| HTML → app | `bordero:retorno`  | `{ retorno }`           |
| HTML → app | `navegacao:fechar` | —                       |

#### `sessao:solicitar` — HTML → app

```json
{ "v": 1, "tipo": "sessao:solicitar" }
```

Mandada **uma vez por carga do documento**, assim que `window.__teoremaInit` existir — e de novo em
todo reload ou navegação interna que reinicialize o JS da página. Sem carga: quem sabe qual é o
sistema, a sessão e o contexto é o app.

É este handshake que mata o `_t=<unix>` do original (`analise §5.3`): recarregar refaz a sessão
sozinho, não precisa de URL nova para forçar o `init()`.

#### `sessao:init` — app → HTML

Não vai pela ponte de string: vai como chamada de função injetada.

```ts
const literal = JSON.stringify(JSON.stringify(payload))
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

ref.current?.injectJavaScript(`window.__teoremaInit(JSON.parse(${literal})); true;`);
```

O **duplo `JSON.stringify`** é obrigatório, não estilo: o de dentro monta o JSON, o de fora o
transforma em literal de string JavaScript, e é ele que neutraliza aspas e barras invertidas vindas
de `resposta`, que é texto livre do usuário (§9). `U+2028`/`U+2029` escapam à parte porque
`JSON.stringify` os deixa passar crus. O `true;` final evita o erro de valor de retorno não
serializável no iOS.

`payload`:

```json
{
  "v": 1,
  "tipo": "sessao:init",
  "sessao": {
    "baseUrl": "https://tenant.exemplo.com.br",
    "token": "<JWT>",
    "userId": "123",
    "companyId": "1",
    "codeCompany": "0001",
    "userCode": "ABC"
  },
  "contexto": { "sequencia": "45678", "resposta": "" }
}
```

- **Todos os valores são `string`.** Nada de número, nada de `null`: campo que não se aplica **não
  aparece**.
- **`sessao` é recortada por sistema** (fato 2.3.3), em `features/web-systems/lib/sessao-web.ts`.
  Mandar campo a mais é vazamento sem contrapartida:

  | `sistema`     | Campos de `sessao`                                                   |
  | ------------- | -------------------------------------------------------------------- |
  | `autcompras`  | `baseUrl`, `token`, `userId`, `companyId`, `codeCompany`, `userCode` |
  | `autcotacao`  | idem                                                                 |
  | `autorizador` | idem                                                                 |
  | `reqcompras`  | `baseUrl`, `token`, `userId`                                         |

- **`contexto` é opcional** e só existe quando a rota foi aberta pela análise de um borderô — ou
  seja, `sistema === 'autorizador'` **e** havia payload em `bordero-abertura.store.ts`. Abrir o
  `autorizador` pelo menu chega sem `contexto`; os outros três nunca têm. **O HTML precisa tratar as
  duas formas** — é a diferença entre "autorize este borderô" e "abra o autorizador".
- `contexto.sequencia` vem do payload (`borderoSequencia`), nunca de label (`analise §7.1.7`).
  `contexto.resposta` é o texto livre já digitado na análise e pode ser `""`.

**`__teoremaInit` tem de ser idempotente.** Pode ser chamada mais de uma vez na mesma página (novo
handshake, retry); a última chamada substitui a sessão anterior.

#### `bordero:retorno` — HTML → app

```json
{
  "v": 1,
  "tipo": "bordero:retorno",
  "retorno": { "sequencia": "45678", "situacao": "S", "resposta": "aprovado com ressalva" }
}
```

- `retorno` é exatamente o `borderoRetornoSchema` que já existe: `situacao` ∈ `'' | S | N | P`
  (tolerante a minúscula e a nulo, desconhecido cai em `''`), `sequencia` coagida a string,
  `resposta` aparada. **Quem calcula `S`/`N`/`P` é o borderô** — o app repassa e não recalcula em
  lugar nenhum (`analise §7.3.21`).
- **Semântica: publica _e_ fecha.** Ao receber, o app publica em `useBorderoRetornoStore` e fecha a
  rota na mesma ação. O HTML **não** manda `navegacao:fechar` em seguida — mensagem única elimina a
  corrida entre publicar e desmontar.
- `retorno.sequencia` tem de ser a mesma que chegou em `contexto.sequencia`: é a chave do
  `consumir(sequencia)` da análise (§4.11). Divergente, o app publica assim mesmo — o store filtra
  sozinho — e registra `console.warn` (§5.4).

#### `navegacao:fechar` — HTML → app

```json
{ "v": 1, "tipo": "navegacao:fechar" }
```

Fecha a rota **sem** resultado. Substitui `app://menu` e `delphi://` do original: um contrato só,
sem dois protocolos para a mesma coisa (§5.8).

### 13.4 Regras de recepção no app

- **`onMessage` sempre definido**, ainda que só descarte — sem ela a ponte não existe no Android.
- Toda mensagem passa por `JSON.parse` dentro de `try/catch` e depois por
  `mensagemWebSchema.safeParse`; o que não casar é **descartado em silêncio**. A WebView é entrada
  não confiável, igual à rede e ao disco (§4.8).
- O app só responde `sessao:solicitar` enquanto a URL corrente é da **origem do tenant**
  (`originWhitelist` + `onShouldStartLoadWithRequest`, §9). Fora dela, descarta sem responder — é o
  que impede injetar sessão em página estranha.
- **O contexto é consumido uma vez, no mount.** `consumir(sistema)` limpa o store na leitura (§4.11),
  então a rota guarda o resultado em `useRef` e responde **todo** handshake a partir dele. Consumir
  dentro do `onMessage` perderia o contexto no primeiro reload da página — este é o erro fácil de
  cometer na implementação.
- A sessão do payload é lida da sessão persistida no momento de responder, não congelada no mount.
- **Sem handshake, sem plano B na URL.** Se não chegar `sessao:solicitar` em ~5 s depois do
  `onLoadEnd`, a tela mostra estado de erro com "tentar de novo" (recarrega a WebView). Nunca
  acrescentar parâmetro à URL como alternativa.
- Avaliar `cacheEnabled={false}` / `incognito` na rota (§9).

### 13.5 O que precisa ser combinado com quem mantém o HTML

Pauta fechada da conversa que é a dependência crítica (pergunta 2 de §11):

1. expor `window.__teoremaInit(payload)` e mandar `sessao:solicitar` assim que ela existir;
2. **parar de ler `location.hash`** — o fragmento deixa de existir, e o `_t=<unix>` some junto;
3. **não guardar `token`** em `localStorage`, `sessionStorage` nem cookie próprio: a sessão vive na
   memória da página e morre com ela;
4. tratar `contexto` **ausente** (autorizador aberto pelo menu, e os outros três sistemas);
5. devolver `bordero:retorno` uma vez, com a `sequencia` que recebeu, e não mandar `navegacao:fechar`
   depois;
6. `postMessage` só com string JSON, sempre com `v` e `tipo`.

Enquanto o HTML só souber ler o fragmento, **não se convive com os dois**: ou a página é atualizada
junto, ou o Bloco D espera (§3.4).

### 13.6 O que esta decisão **não** fecha

- 🔒 **B2** (nativo × web) e 🔒 **B5** (`react-native-webview` não instalado) continuam de pé — são
  os dois bloqueios que sobram no Bloco D.
- **Opção C** fica registrada como pendência de servidor, junto de 🔒 B3 e 🔒 B4: é a forma correta,
  que o app hoje não pode implementar sozinho.
- O comportamento de `injectedJavaScriptBeforeContentLoaded` no Android (§3.1) segue **a verificar**
  na versão que 🔒 B5 instalar. A escolha de A′ dispensa a garantia; a verificação só diz se o
  `window.__TEOREMA_SESSION__` direto é atalho legítimo em alguma tela.
- Os arquivos de §10 continuam sendo o mapa da implementação: nenhum deles foi escrito nesta decisão.

---

## 14. Implementação — 10/09/2026

O app cumpre a sua metade do contrato de §13.3. Falta a do HTML (§13.5).

### 14.1 O que foi escrito

| Arquivo                                               | Papel                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `features/web-systems/lib/sistemas-web.ts`            | catálogo dos quatro sistemas: título, URL do HTML, origem do tenant e o guarda de `sistema` |
| `features/web-systems/lib/sessao-web.ts`              | recorte de `sessao` por sistema, montagem do `sessao:init` e o script de injeção            |
| `features/web-systems/schemas/mensagem-web.schema.ts` | união discriminada do que **chega**, com `v` de versão e descarte silencioso                |
| `features/web-systems/hooks/use-handshake-web.ts`     | responde ao handshake, trava a origem, detecta página que não pede a sessão                 |
| `features/web-systems/components/web-system-view.tsx` | a WebView e os dois avisos de falha (carga e handshake)                                     |
| `src/app/(app)/web/[sistema].tsx`                     | a rota: liga `liberacoes` (contexto e retorno) a `web-systems` (transporte)                 |
| `src/app/(app)/_layout.tsx`                           | cabeçalho visível na rota web — sem ele, HTML sem `navegacao:fechar` prende o usuário       |
| `src/app/(app)/menu.tsx`                              | os quatro itens saem do catálogo, não de uma lista copiada                                  |
| `package.json`                                        | `react-native-webview@13.16.1` — a versão que o Expo SDK 57 fixa                            |

O `features/web-systems/` não importa `features/liberacoes/`: o `retorno` do `bordero:retorno`
chega como `unknown` e quem o valida com `borderoRetornoSchema` é a **rota**, que pode falar com as
duas (`CLAUDE.md §2`, §4.12).

### 14.2 Decisões de implementação que o §13 não previa

- **Cabeçalho visível na rota web.** Estava `headerShown: false`. Com o handshake, a tela pode
  legitimamente parar num aviso ("a página não pediu a sessão") — e sem cabeçalho não haveria como
  sair dela no iOS a não ser pelo gesto. O título é o do sistema aberto.
- **Prazo de 5 s sem handshake.** Não é espera artificial (`CLAUDE.md §5.10`): nada é adiado por
  causa dele. É o que separa "carregando" de "esta página não implementa o contrato", e o único
  jeito de dizer isso ao usuário em vez de mostrar tela em branco. Termina em aviso com
  "tentar de novo", **nunca** em cair para a URL.
- **`onError` tem aviso próprio.** Falha de carga e falha de handshake são causas diferentes e
  mereciam mensagens diferentes; a WebView continua montada por baixo do aviso, para o
  "tentar de novo" poder recarregar.
- **Catálogo como fonte única.** Título e destino dos quatro sistemas ficam em
  `sistemas-web.ts`; o menu passou a derivar dali. Antes eram duas listas, e nada impedia o menu de
  apontar para um `sistema` que a rota não aceita.
- **`incognito` + `cacheEnabled={false}`** entraram (§9). É o que zera resíduo entre usuários no
  aparelho compartilhado, ao custo de o HTML não ter armazenamento que sobreviva à tela. Anotado em
  `CLAUDE.md §9`, dívida D7, junto do risco de tenant em `http://`.

### 14.3 Como verificar quando o HTML estiver pronto

1. `npm install` (a dependência é nativa: **exige `npm run prebuild` e dev client novo**).
2. Abrir cada um dos quatro itens do menu: a página carrega e **não** aparece o aviso de 5 s.
3. No `autorizador` aberto pelo menu, o payload chega **sem** `contexto`; aberto pela análise de um
   borderô, chega **com** `sequencia` e `resposta`.
4. Recarregar a página dentro da WebView: a sessão volta sozinha, sem `_t=<unix>`.
5. Decidir um borderô: `bordero:retorno` publica e fecha, e a análise aplica `S`/`P` → autoriza,
   `N` → reprova, vazio → preserva.
6. Conferir que nenhuma URL do histórico da WebView contém token — é o que esta decisão existe para
   garantir.
