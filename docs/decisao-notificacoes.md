# Decisão B8 — fonte de dados da tela de notificações

> **Status:** **proposta de contrato; resposta do time e do Orion pendente.** Nenhuma linha de app
> foi escrita por causa deste documento — a tela 13 segue ⬜ de propósito.
> **Trava:** `CLAUDE.md §7.9` · `docs/plano-migracao.md` bloqueio 🔒 B8 (Bloco E, ficha E2 / tela 13).
> No `CLAUDE.md §7` o B8 é o item **9**, não o 8: sete pontos do `decisao-push.md` citam `§7.8`
> querendo dizer o bundle id compartilhado, e renumerá-lo publicaria sete ponteiros errados.
> **Escopo:** decide **de quem é a lista do sino** e, se a resposta for "do servidor", fixa o
> contrato do endpoint e da tradução do payload. Não decide o push (🔒 B7,
> [`decisao-push.md`](decisao-push.md)), que é sobre _quem entrega a mensagem_ — são coisas
> diferentes, e a ficha E1 anda sem esta resposta.
> **Verificação:** o inventário de endpoints do legado foi conferido em
> [`analise-app-original.md §5`](analise-app-original.md) (as duas superfícies inteiras) e o estado
> do app, contra o código em 15/09/2026. **Nada foi executado contra servidor** — vale a ressalva
> do `CLAUDE.md §6`.

---

## 1. Recomendação em uma frase

**Um endpoint de notificações no servidor do cliente (tenant), devolvendo a lista já pronta para a
tela e carregando o mesmo `tipo` que o payload de push usa** — é a única opção que atende ao
"Pronto quando" da ficha E2, e o acoplamento com o push não é detalhe: sem ele o app fica com dois
vocabulários para dizer "esta notificação aponta para tal tela", que é exatamente o que o
`CLAUDE.md §5.8` proíbe. **Se a resposta do Orion for "não vai ter endpoint", a decisão honesta não
é inventar um: é a opção 3 do §3** — o sino abre a fila, e a tela 13 sai do índice por decisão
registrada, em vez de ficar ⬜ para sempre.

---

## 2. De onde partimos

### 2.1 O que o original faz

**Nada.** Não é implementação incompleta que se termina — é conteúdo falso.
`uFrmNotificacao.AjustaLayout` monta um JSON literal com _"Aqui vai a mensagem de testes que estou
testando com a quebra de linha do listview"_ e exibe isso; é o que qualquer usuário vê ao tocar no
sino (`analise §7.2.11`).

Isso está no `CLAUDE.md §8` como coisa que **não se migra**, e é a razão de a ficha E2 exigir fonte
de dados real antes da tela.

Sobre o **badge**, corre neste repositório a afirmação de que era um `TLabel` com `'0'` fixo no
`.fmx`, que nenhum código atualizava — está no comentário de
[`use-notificacoes-nao-lidas.ts`](../src/features/notificacoes/hooks/use-notificacoes-nao-lidas.ts),
citando a `§7.2.11`. **A análise não sustenta isso:** a `§7.2.11` trata só do JSON de teste, e a
única menção a badge no inventário (`§2.1`, no chrome de `TFrmPrincipalBase`) não diz de onde vinha
o número. É afirmação **herdada e não reconferida** — quem for ao monorepo confirma ou derruba. Não
muda nada aqui: o que decide a E2 é a ausência de endpoint, não o que o `.fmx` fazia com o rótulo.

Dois fatos fecham a questão de onde o dado _poderia_ estar:

- **Nenhum dos dois servidores expõe rota de notificação.** O inventário do legado (`analise §5`)
  lista as duas superfícies por inteiro — central (`companyinformation`, `getserverurl`,
  `register`, `lastlogin`, `tokenpush`) e tenant (`ping`, `auth/*`, `application/*`,
  `remoteauthorization/*`, `bordero/*`, `purchaseauthorization/*`, `purchaserequisition/*`). Não há
  nada de notificação em nenhuma das duas.
- **Nem havia armazenamento local para isso.** A única tabela própria do app no SQLite era
  `APOIO_AUTORIZADOR`, de uma coluna e uma linha, guardando a ordenação preferida de pedidos
  (`analise §4.1`) — que neste projeto é a ficha F5, não notificação.

Ou seja: a tela 13 nunca teve fonte. É a única do índice que não é _migração_ de nada.

### 2.2 O que já existe neste repositório

O app **já está no estado que a ficha E2 prescreve** para "o servidor ainda não tem endpoint", e
isso importa: não há defeito a corrigir hoje, só uma fonte a definir.

| Onde                                                                                                | O que está lá                                                                                           |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [`notificacoes.keys.ts`](../src/features/notificacoes/api/notificacoes.keys.ts)                     | `all` e `lista(userCode)` já existem, esperando quem escreva nelas                                      |
| [`use-notificacoes-nao-lidas.ts`](../src/features/notificacoes/hooks/use-notificacoes-nao-lidas.ts) | `queryFn: skipToken` — o hook só observa o cache; cache vazio é badge ausente, nunca um zero decorativo |
| [`app-header.tsx`](../src/shared/components/ui/app-header.tsx)                                      | o sino só renderiza com `total > 0`; como a contagem é sempre 0, a tela está fora do alcance do usuário |
| [`(app)/notificacoes.tsx`](<../src/app/(app)/notificacoes.tsx>)                                     | placeholder que diz o que migrar e por que ainda não foi                                                |
| [`push-payload.schema.ts`](../src/features/push/schemas/push-payload.schema.ts)                     | união discriminada por `tipo` (`liberacao` \| `cotacao`) — **o vocabulário que já existe**              |
| [`rota-da-notificacao.ts`](../src/features/push/lib/rota-da-notificacao.ts)                         | payload → rota; hoje leva à liberação ou à cotação, nunca a `/notificacoes`                             |

Vale registrar que [`decisao-push.md §11`](decisao-push.md) já dizia, em 04/09/2026, que a E2
estava travada nisto — o que faltava era o bloqueio virar linha na tabela do plano §6, e é o que
este documento fecha.

### 2.3 Três fatos que restringem as opções

1. **O aparelho é compartilhado.** É premissa do projeto — o cache de empresas é por usuário
   (`empresas:<userCode>`) justamente por isso. Qualquer estado de "lido" precisa ser por usuário,
   nunca global do aparelho.
2. **O app é cliente fino.** Decidir o que conta como notificação pendente é regra de negócio: se o
   app derivar a lista cruzando fila + cotação + borderô, ele passa a ter uma regra que o Orion não
   tem, e as duas divergem no primeiro ajuste de alçada.
3. **Push e lista são a mesma informação por dois caminhos.** O que chega por push é o que deveria
   estar na lista. Se os dois caminhos tiverem formatos diferentes, o app precisa de duas traduções
   e de dois mapas de rota para o mesmo destino.

---

## 3. A pergunta que o B8 realmente é: de quem é a lista

### Opção 1 — endpoint no tenant, no formato da tela (recomendada)

O Orion do cliente passa a expor a lista; o app lê, traduz no schema e renderiza. É o desenho de
todas as outras telas deste app.

**Por que no tenant e não no central:** o que decide o cliente não é o prefixo do path, é de quem é
o dado (`CLAUDE.md §4.1`). Notificação de liberação depende da base do cliente — é tenant, como
`searchpending`. O central só sabe de licença e aparelho.

**Prós** — atende ao aceite da E2 por inteiro (lista real, badge na mesma query, toque com
destino); o estado de "lido" vale em todos os aparelhos do mesmo usuário; o app não ganha regra
nenhuma.
**Contras** — é trabalho de servidor, e é o único caminho que não anda sem ele.

### Opção 2 — histórico local do que o push entregou

O app grava cada payload recebido (o listener de `use-roteamento-push` já passa por ali) numa chave
de MMKV por usuário, e a tela lista isso.

**Prós** — zero trabalho de servidor; o dado é **real** (chegou de verdade, não é inventado), então
respeita a letra da ficha; funciona offline.
**Contras, que são muitos** — só existe o que chegou **depois** de instalar o app e conceder
permissão; reinstalar zera; cada aparelho tem uma lista diferente; notificação que o sistema
descartou (app fechado há muito, cota do FCM) simplesmente não aparece; e o badge passaria a contar
estado do aparelho em vez de verdade do servidor — quem decide a liberação no desktop continuaria
com o número no celular. Some a isso o `CLAUDE.md §4.8`, que manda não persistir o que o sistema
operacional já é dono.

É defensável como _conveniência_, nunca como fonte da verdade do badge.

### Opção 3 — não migrar a tela; o sino leva à fila

Assume que a informação que o usuário quer do sino é "quantas decisões me esperam" — e essa **já
tem endpoint**: é o `searchpending` que a tela 9 usa. O badge passa a contar a fila, o toque navega
para `/(app)/liberacoes`, a tela 13 sai do índice §6 para a tabela de **Fora de escopo** e a feature
`notificacoes` é absorvida pela `liberacoes`.

**Prós** — zero trabalho de servidor, zero contrato inventado, nada de falso na tela, e resolve o
último ⬜ do placar **decidindo** em vez de codificando.
**Contras** — perde histórico (só mostra o que está pendente agora) e perde a **autorização de
cotação de compras** (`autcotacao` / `purchaseauthorization`), que é o destino do
`TipoNotificacao.Cotacao` e não passa por `searchpending`. Cuidado com o nome: liberação de
**origem** cotação (`CO` no `ORIGEM_LABEL`) _está_ na fila — são coisas diferentes com a mesma
palavra. É uma tela a menos do que o original prometia, e isso precisa ser escolha consciente do
time, não efeito colateral.

### Comparação

|                                       | Opção 1 · endpoint          | Opção 2 · histórico local           | Opção 3 · sino → fila |
| ------------------------------------- | --------------------------- | ----------------------------------- | --------------------- |
| Trabalho de servidor                  | **sim, é o custo**          | nenhum                              | nenhum                |
| Atende ao "Pronto quando" da E2       | **sim**                     | parcialmente (lista sim, badge não) | não — muda a ficha    |
| Vale em todos os aparelhos do usuário | **sim**                     | não                                 | sim                   |
| Histórico (o que já foi decidido)     | **sim, se o Orion guardar** | só o que chegou                     | não                   |
| Inclui cotação / borderô              | **sim**                     | sim                                 | não                   |
| Quando fica disponível                | depende do Orion            | ~1 dia de app                       | ~2 h de app           |

---

## 4. Contrato proposto (v1) — se a opção 1 for aprovada

Proposta, não requisito: os **nomes de coluna são do servidor**, e o app se adapta no schema. O que
o app precisa de verdade é a **forma** — um id, um tipo que case com o push, texto para exibir,
data, estado de lido, e o bastante para montar a rota do destino.

### 4.1 Listar

```
GET /v1/notification/list/{usercode}
```

Segue a forma que o Orion já usa em `/v1/purchaserequisition/list/{iduser}`. Sem paginação na v1 —
`searchpending` também não tem, e introduzir paginação antes de existir volume seria resolver
problema que ninguém tem. Se a resposta puder passar de algumas centenas de itens, é a pergunta 5
do §7.

### 4.2 Marcar como lida

```
POST /v1/notification/read/{id}/{usercode}
```

Mesma forma de `reserve/{id}/{usercode}`. O `usercode` no path não é redundância: o estado é por
usuário e o aparelho é compartilhado (§2.3). **Se o Orion não for guardar "lido", esta rota não
existe** — ver a pergunta 2 do §7 e o custo que isso tem.

### 4.3 Payload e tradução

O payload entra em `SCREAMING_SNAKE` e sai camelCase, como todo o resto (`CLAUDE.md §4.2`). Nome de
coluna não passa de `schemas/`.

| Campo esperado               | Vira       | Observação                                                                 |
| ---------------------------- | ---------- | -------------------------------------------------------------------------- |
| `NOTIFICACAO_SEQUENCIA`      | `id`       | `z.coerce.string()`, como `LIBERACAO_SEQUENCIA`                            |
| `NOTIFICACAO_TIPO`           | `tipo`     | **`'liberacao'` \| `'cotacao'`** — o mesmo vocabulário do push             |
| `NOTIFICACAO_TITULO`         | `titulo`   | `optionalText`; campo ausente não vira linha vazia                         |
| `NOTIFICACAO_MENSAGEM`       | `mensagem` | texto livre, exibido inteiro — **sem parse posicional** (`analise §7.1.6`) |
| `NOTIFICACAO_DATA` / `_HORA` | `data`     | **peça um campo só, ISO com hora** — ver a nota abaixo                     |
| `NOTIFICACAO_LIDA`           | `isLida`   | `'S'`/`'N'`, a convenção do ERP                                            |
| `LIBERACAO_SEQUENCIA`        | `destino`  | o alvo do toque, quando o tipo é `liberacao`                               |

**Sobre a data:** o `orionDateToIso` de `shared/lib/format/date.ts` devolve **só** `yyyy-mm-dd` —
ele casa `dd/mm/yyyy` e descarta o resto. Numa lista de notificações a hora é o que ordena e o que
o usuário lê, e **nenhuma função deste repositório produz ISO com hora hoje**. Então o contrato pede
um campo só, já com data e hora (`NOTIFICACAO_DATAHORA`); se vierem separados, o combinador é
trabalho novo em `shared/lib/format/date.ts` e precisa ser dito na hora de implementar, não
descoberto depois de o Orion entregar.

**O ponto que mais importa do contrato:** o par `tipo` + `destino` precisa ser a **mesma união
discriminada** do [`push-payload.schema.ts`](../src/features/push/schemas/push-payload.schema.ts) —
`liberacao` carrega `id`, `cotacao` não carrega nada. Com isso, o
[`rotaDaNotificacao`](../src/features/push/lib/rota-da-notificacao.ts) que o push já usa serve os
dois caminhos, e a regra "de que tela é esta notificação" existe **uma vez** no app. Se o servidor
mandar um vocabulário diferente aqui, o app fica com duas traduções e dois mapas de rota para o
mesmo destino — e é assim que se repete o `analise §7.3.19`.

⚠️ **"Mesma união" não é "importar de `features/push`".** `notificacoes` importar de `push` é
feature importando feature, que o `CLAUDE.md §2` proíbe. Quem implementar faz o movimento **antes**
do primeiro import: `TipoNotificacao` e a união discriminada sobem para `shared/lib/schema/`, e o
`rotaDaNotificacao` vai com eles (é ele que traduz tipo → rota nas duas pontas). Só depois as duas
features passam a ler de `shared/`. Reaproveitar aqui significa **mover para `shared/`**, nunca
atravessar a fronteira.

Corolário: **tipo que o app não conhece é descartado, não adivinhado** — é o que o
`pushPayloadSchema` já faz. Um tipo novo no Orion é uma linha em `TipoNotificacao` e uma no mapa de
rota, valendo para as duas pontas de uma vez.

### 4.4 Como o badge passa a funcionar

O `use-notificacoes-nao-lidas` passa a contar os itens com `isLida === false` da **mesma** query da
lista — mesma `queryKey`, `select` diferente —, que é o que o aceite da E2 pede. O `app-header.tsx`
não é tocado: ele já esconde o sino quando a contagem é 0.

**Não basta tirar o `skipToken`.** Ele é o `queryFn`, não uma flag ao lado dele: removido sozinho,
o observador do menu fica **sem fetcher**, o TanStack Query rejeita por `queryFn` ausente, o
`data ?? 0` devolve zero e o cabeçalho volta a exibir exatamente o **zero decorativo** que o
`CLAUDE.md §4.4` proíbe — o defeito do original, de volta pela porta de trás. O `skipToken` sai
**trocado** pela mesma `queryFn` da lista, não apagado.

### 4.5 Erros, decididos por status

Por `ApiError.status`, nunca por texto (`CLAUDE.md §5.11`):

| Status       | O que a tela faz                                                                    |
| ------------ | ----------------------------------------------------------------------------------- |
| 200 com `[]` | estado vazio do `QueryState` — "Nenhuma notificação."                               |
| 401          | **hoje não há tratamento central** — ver a ressalva logo abaixo                     |
| 404          | o tenant deste cliente ainda não tem a rota — "indisponível", **sem** retry         |
| 5xx          | erro com `onRetry`; a política de retry do `queryClient` já cobre                   |
| 0            | offline; o `OfflineBanner` já avisa (ler a dívida D9 do §9 antes de encostar nisto) |

O 404 é o caso interessante: enquanto o Orion for atualizado cliente a cliente, vai existir tenant
sem a rota. Tratar 404 como "indisponível" em vez de "erro" evita alarme falso — e é decisão por
status, não por mensagem.

**Ressalva sobre o 401, conferida no código e não suposta:** não existe interceptor de 401 neste
app. O `client.ts` só normaliza o erro e marca conectividade, e o único lugar que lê 401 é o
`erro-login.ts`. Hoje um 401 vira `ApiError(401)`, cai no `queryState` com a mensagem do servidor e
**não** derruba a sessão nem volta para o login. Se a lista de notificações puder receber 401 —
JWT expirado com o app aberto —, isso é **ficha própria** (expirar sessão na borda), não linha
deste contrato. Registrado aqui para não virar promessa: a tabela acima descreve o que a tela faz,
e para o 401 ela não faz nada de especial.

---

## 5. O que muda neste repositório quando a opção 1 for aprovada

Nada disso existe hoje, e nada disso deve ser escrito antes da resposta:

| Arquivo                                                     | O que faz                                                            |
| ----------------------------------------------------------- | -------------------------------------------------------------------- |
| `features/notificacoes/schemas/notificacao.schema.ts`       | valida e traduz o payload; `Notificacao = z.output<…>`               |
| `features/notificacoes/api/notificacoes.api.ts`             | `listar(userCode)` e `marcarLida(id, userCode)`                      |
| `features/notificacoes/hooks/use-notificacoes.ts`           | a query da lista                                                     |
| `features/notificacoes/hooks/use-marcar-lida.ts`            | mutation + invalidação de `notificacoesKeys.lista(userCode)`         |
| `features/notificacoes/components/notificacao-card.tsx`     | o item da lista                                                      |
| `features/notificacoes/hooks/use-notificacoes-nao-lidas.ts` | **alterado**: sai o `skipToken`, entra o `select` contando não lidas |
| `app/(app)/notificacoes.tsx`                                | **substituído**: `FlatList` + `queryState`, só composição            |

Fora da feature, dois pontos de contato e nada mais: o `rotaDaNotificacao` passa a ser chamado
também pela tela — e, se as duas features precisarem dele, ele sobe para `shared/`, porque
`notificacoes` não importa de `push` (`CLAUDE.md §2`) — e o `TipoNotificacao` vira o vocabulário
compartilhado. Ligação entre features, se necessária, é na rota (`§4.12`).

---

## 6. Como a ficha E2 é atendida

O "Pronto quando" tem três partes e o contrato do §4 fecha as três:

1. **"a lista vem do servidor"** — §4.1.
2. **"o badge do chrome usa a mesma query"** — §4.4: mesma `queryKey`, um `select` diferente.
3. **"tocar em uma notificação leva ao destino correspondente"** — §4.3, reaproveitando o
   `rotaDaNotificacao` do push em vez de escrever um segundo mapa.

E o **Corrigir** da ficha (o JSON de teste, `analise §7.2.11`) é atendido por construção: não
existe caminho no código proposto que produza texto que não veio do servidor.

---

## 7. Perguntas que precisam de resposta humana

1. **Existe tabela de notificação no ERP hoje?** Se não existe, a lista teria de ser derivada de
   `VENDAS_LIBERACAO` + cotação **no servidor** — o que é aceitável —, mas nunca no app (§2.3,
   fato 2).
2. **O estado "lido" é guardado por usuário no servidor?** Se não for, as opções são: o Orion passa
   a guardar, ou o app guarda em MMKV por usuário e **o badge deixa de valer entre aparelhos**. A
   segunda é perda real e precisa ser escolhida de propósito.
3. **O `tipo` pode ser o mesmo vocabulário do push** (`liberacao`, `cotacao`)? É o §4.3, e é o item
   que sai mais barato agora e mais caro depois. Conversa com a pergunta 5 do
   [`decisao-push.md §10`](decisao-push.md), que é a mesma dúvida pelo outro lado.
4. **Notificação de liberação já decidida: some ou vira histórico?** Se some, a lista é fila e o
   badge é trivial; se vira histórico, "não lida" é o que o badge conta e a lista cresce para
   sempre — o que traz a pergunta 5.
5. **Precisa paginar?** A v1 do §4.1 diz que não. Se a resposta for "algumas centenas por usuário",
   o contrato ganha `limit`/`offset` antes de virar código, não depois.
6. **É tenant, confirma?** O §3 argumenta que sim. Se por algum motivo a lista for do central, o
   cliente HTTP muda e o `tokendatabase` deixa de fazer sentido.

---

## 8. Se a resposta for "não vai ter endpoint"

Então o B8 fecha pela **opção 3**, e o que muda é documentação antes de código:

- `CLAUDE.md §6` — a tela 13 sai do índice de telas a migrar e entra na tabela **Fora de escopo**,
  com o motivo ("o servidor nunca teve fonte; o sino passa a abrir a fila"), do mesmo jeito que o
  borderô nativo está lá.
- `plano-migracao.md` — a ficha E2 é reescrita como "sino → fila" ou removida; o Bloco E passa a
  ter uma ficha só.
- No app: o badge lê `useLiberacoesPendentes` e o sino navega para `/(app)/liberacoes`; a feature
  `notificacoes` desaparece (as keys e o hook de badge vão para `liberacoes`); o
  `(app)/notificacoes.tsx` e a entrada dele no `_layout` são removidos.

O que **não** é aceitável em nenhum cenário: manter a tela com dado inventado, ou deixar o ⬜ no
placar sem que ninguém saiba que a espera é por uma resposta, não por código.

---

## 9. Referências

- `docs/analise-app-original.md` §7.2.11 (JSON de teste no sino), §5 (inventário das duas
  superfícies de API), §4.1 (`APOIO_AUTORIZADOR`), §3.2 (`GatilhoNotificacao`), §7.1.6 (parse
  posicional de mensagem), §7.3.19 (dois padrões para a mesma coisa).
- `docs/plano-migracao.md` — ficha E2, ficha E1 e §6 (🔒 B8).
- `docs/decisao-push.md` §10 pergunta 5 e §11 — onde este bloqueio foi notado primeiro, em
  04/09/2026.
- `CLAUDE.md` §4.1 (que cliente para que dado), §4.2 (tradução no schema), §4.12 (duas features na
  rota), §5.8 (um jeito só), §5.11 (erro por status), §8 (o que não migrar).
