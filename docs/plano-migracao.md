# Plano de migração — Teorema Autorizador (Delphi/FMX → React Native)

> Deriva do inventário em [`docs/analise-app-original.md`](analise-app-original.md) e do índice de
> telas do [`CLAUDE.md §6`](../CLAUDE.md). O **status de cada tela continua sendo mantido no
> `CLAUDE.md §6`** — aqui está o _como_ e o _em que ordem_, não o placar.
>
> Regra que atravessa o documento inteiro: o app é **cliente fino**. Nada do que está abaixo
> reintroduz regra de negócio no dispositivo. Quando uma correção depende do Orion Server, ela está
> marcada com 🔒 e aparece em [§6 Bloqueios](#6-bloqueios-e-dependências-externas).

---

## 1. Como o plano está organizado

O trabalho está dividido em **seis blocos lógicos**. Um bloco é uma fatia vertical entregável:
rota + feature (`api` / `schemas` / `hooks` / `components`) + o que for para `shared/`. Não se migra
"a camada de API de tudo" e depois "as telas de tudo" — migra-se bloco a bloco, cada um utilizável
ponta a ponta.

| Bloco | Nome                           | Telas (índice do `CLAUDE.md §6`) | Por que existe                                           |
| ----- | ------------------------------ | -------------------------------- | -------------------------------------------------------- |
| **A** | Identidade e onboarding        | 1, 2, 3, 5, 4, 6                 | Sem isso não há `baseURL`, nem JWT, nem empresa corrente |
| **B** | Chrome do app e sessão viva    | 8, 7                             | Casca comum a todas as telas autenticadas                |
| **C** | Liberações (núcleo do produto) | 9, 10, 11, 12                    | É a razão de o app existir                               |
| **D** | Web systems                    | 14, 15, 16, 17                   | Quatro itens de menu, uma rota só                        |
| **E** | Notificações e push            | 13 + infra de push               | Faz o app ser acordado pela decisão pendente             |
| **F** | Resiliência e qualidade        | — (transversal)                  | Fallback, cache offline, testes                          |

### Critério de ordenação

1. **Caminho crítico primeiro.** Nada é testável de verdade enquanto login → empresa não fecha.
2. **Depois, o núcleo de valor** (liberações), que é onde estão as falhas críticas da análise §7.1.
3. **Por último, o que é casca ou pode ser adiado** sem travar ninguém (web systems, push, offline).
4. **Bloqueio de servidor não para o bloco.** Onde há 🔒, a tela é entregue com o ponto isolado em um
   único arquivo (como já é `src/features/auth/lib/password.ts`), não espalhado pela UI.

---

## 2. Ordem de migração

```
Fase 0  destravar    ── decisões 🔒 + react-native-webview        (paralelo a tudo)
   │
Fase 1  BLOCO A      ── documento → configuração/licença → login → empresa
   │
Fase 2  BLOCO B      ── chrome do menu, histórico de usuários, troca de usuário/logout
   │
Fase 3  BLOCO C      ── fila → análise → cliente → feedback
   │                    (maior densidade de correções: §7.1.1, .2, .6, .7, .8 e §7.2.16)
   ├──────────────┐
Fase 4  BLOCO D    │ ── rota única de web system (4 itens de menu)
Fase 5  BLOCO E    │ ── push + tela de notificações   ← pode andar em paralelo à Fase 4
   └──────────────┘
Fase 6  BLOCO F      ── fallback primário/secundário/offline, cache de empresas, testes
```

Fases 4 e 5 são independentes entre si e só dependem do Bloco B (menu) e da sessão. A Fase 6 é
incremental: cada item pode entrar assim que o bloco que ele protege existir.

---

## 3. Blocos e telas

Legenda de cada ficha: **Preservar** = regra real do produto (análise §8) · **Corrigir** = o que
_não_ se repete do original, com a referência da análise · **Pronto quando** = critério de aceite.

---

### Bloco A — Identidade e onboarding

O original resolvia tudo isso em **um form com 11 abas** (`TFrmLoginBase`, `.fmx` de 3,1 MB). Aqui
vira uma rota por etapa dentro de `(auth)/`, cada uma com estado próprio, e o `index.tsx` decide o
destino pela sessão persistida — o que já está feito.

#### A1 · Splash / roteamento inicial — `src/app/index.tsx` ✅

Já migrado; serve de referência para o resto do bloco. O ganho sobre o original: decisão **síncrona**
via MMKV, sem os 3 s de `Sleep` do splash (§7.2.13).

#### A2 · Documento da empresa — `(auth)/documento`

|            |                                                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Origem     | `TFrmLoginBase` (aba Documento)                                                                                                   |
| API        | `centralApi` · `GET /v1/application/companyinformation?document=&systemcode=00076` · `GET /v1/application/getserverurl?document=` |
| Depende de | `centralApi`, `session.store` (✅ prontos)                                                                                        |

**Preservar** — validação do documento contra o `systemcode` `00076`; resolução de
`SERVER_URL_PRIMARY` / `SECONDARY` / `PRINT` para a sessão; o CNPJ de demo continua sendo um
documento como outro qualquer — o servidor é quem responde se é demo.

**Corrigir**

- Máscara e validação de CNPJ/CPF **no schema Zod**, não em evento de tecla de campo (`§4.7` do CLAUDE.md).
- Documento não encontrado é **status HTTP**, não comparação de texto (§7.1.3). Mensagem única na
  tela, sem diálogo empilhado (§7.1.8).
- Uma tela = uma decisão. O original misturava documento, bancos e erro de licença nas mesmas abas.

**Pronto quando** — documento válido grava `device.companyDocument` + as três URLs e navega para
`(auth)/configuracao`; documento inválido mostra erro inline e não altera a sessão.

#### A3 · Configuração de servidor + A5 · Registro do aparelho e licença — `(auth)/configuracao`

As duas telas do índice (#3 e #5) vivem na mesma rota, em passos: **testar conexão → registrar
aparelho → ler licença**. Separar em duas rotas só recria o vaivém de abas do original.

|        |                                                                                                             |
| ------ | ----------------------------------------------------------------------------------------------------------- |
| Origem | `TFrmLoginBase` (abas Configuração, Bancos, Identificação, Licença, Concluído, Erro de licença)             |
| API    | `tenantApi` `GET /v1/ping`, `GET /v1/auth/setup/{documento}` · `centralApi` `POST /v1/application/register` |

**Preservar** — teste de ping no primário e, falhando, no secundário, gravando em
`device.serverUrlActive` qual respondeu; escolha da base quando o tenant expõe mais de uma
(`/v1/auth/setup`); respostas de negócio do registro (`bloqueado`, `licencas`, `demo`) levando a um
estado de erro de licença; `REGISTER_EXPIRATION <= agora` volta o aparelho para
`DeviceStatus.NaoRegistrado` e reinicia o registro.

**Corrigir**

- Sem `Sleep(5000)` na tela "Concluído" (§7.2.13): terminou, navega.
- Endereço de servidor é campo de formulário na própria tela — o original abria um **modal genérico
  de entrada de texto** (`TFrmImput`) para isso.
- Os três estados de licença viram **um** componente de erro parametrizado, não três abas.
- Nada de campo de senha pré-preenchido a partir do armazenamento local (§7.1.9).

**Pronto quando** — ao fim do passo, `device.status === Ativo`, `serverUrlActive` preenchido e
`registerExpiration` gravado; qualquer um dos três erros de licença mostra a orientação certa e
oferece "tentar de novo" sem reiniciar o app.

#### A4 · Login — `(auth)/login` 🟨 🔒

|          |                                                                                                                                                                                                                                                                |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Origem   | `TFrmLoginBase` (aba Login)                                                                                                                                                                                                                                    |
| API      | `tenantApi` · `POST /v1/auth/login` (header `tokendatabase`)                                                                                                                                                                                                   |
| Bloqueio | 🔒 **B1 — resolvido no app, pendente no servidor.** Decidido: senha em texto puro sobre TLS, hash no Orion. `preparePassword()` já é passthrough; o login real só funciona quando o novo contrato subir. Ver [`decisao-hash-senha.md`](decisao-hash-senha.md). |

UI, schema, `useLogin` e o envio da senha já existem, e a resposta já é lida pelo campo correto
(`TOKEN` → `jwt`). Falta o servidor aceitar o novo contrato de senha e o tratamento fino de erro.

**Preservar** — `username` em maiúsculas; envio do `registerid`; `DEVICE_STATUS = 2` bloqueia o
aparelho e persiste o bloqueio; sucesso persiste JWT + `USUARIO_ID` + `USUARIO_CODIGO`.

**Corrigir**

- **Nunca persistir a senha** (§7.1.9). O store já tem `partialize`; manter assim.
- Erros `usuario` / `senha` / `cadastro` decididos por **status/código estável** (🔒 B4), não pelo
  texto do campo `erro` (§7.1.3). Enquanto o servidor não padroniza, mapear em **um único** módulo da
  feature `auth`, com o fallback genérico como caminho normal e não como acidente.
- Mensagem de erro única, no formulário, vinda do estado do `useMutation`.

**Pronto quando** — decidido o hash, o login real fecha a sessão e navega para `(auth)/empresa`.

#### A6 · Escolha de empresa — `(auth)/empresa`

|        |                                                                |
| ------ | -------------------------------------------------------------- |
| Origem | `TFrmLoginBase` (aba Escolha de empresa)                       |
| API    | `tenantApi` · `GET /v1/application/companyfromuser/{usercode}` |

**Preservar** — a empresa escolhida (≠ empresa licenciada) define a empresa corrente e é
pré-requisito do menu; a lista precisa ficar **em cache** para o login offline (ver F2).

**Corrigir**

- Lista via TanStack Query + `<QueryState>`; nada de copiar a resposta para dentro do store
  (`§4.8` do CLAUDE.md) — só a empresa **escolhida** vai para a sessão.
- Usuário com uma empresa só: seleciona e segue, sem tela intermediária.

**Pronto quando** — `company` na sessão e redirecionamento para `(app)/menu`; trocar de empresa
depois é possível pelo chrome (Bloco B) sem refazer login.

#### A7 · Histórico de usuários

Depende do chrome; ficha em **B2**.

---

### Bloco B — Chrome do app e sessão viva

O `TFrmPrincipalBase` do original concentrava cabeçalho, menu lateral animado, badge, indicador
offline, logo da empresa e ciclo de vida do push. Aqui isso se quebra em um **layout de rota**
(`src/app/(app)/_layout.tsx`) mais componentes em `shared/components/`, para que nenhuma tela
autenticada precise redesenhar a casca.

#### B1 · Menu principal — `(app)/menu` ✅

|        |                                                                |
| ------ | -------------------------------------------------------------- |
| Origem | `TFrmPrincipal` + `TFrmPrincipalBase`                          |
| API    | `tenantApi` · `GET /v1/application/photocompany/{codeCompany}` |

Fechada: itens, navegação, cabeçalho com usuário/empresa, logo em cache, badge de notificações e
indicador de offline.

**Preservar** — os cinco itens realmente visíveis (liberações + quatro web systems); o gatilho de
push abrindo a tela certa (Bloco E).

**Corrigir**

- **Nenhum item invisível.** O original mantinha quatro itens `Visible = False` apontando para telas
  nativas já substituídas (§7.2.10). Se um item não pode ser aberto, ele não existe no código.
- Logo da empresa é `useQuery` com cache, não download a cada abertura do form.
- Badge de notificação vem do cache da query de notificações, não de contador em variável global.
- O menu lateral animado do original vira navegação plana: os destinos são poucos e o Expo Router já
  dá pilha e voltar. Sem `ShowModal` instanciando um form novo a cada clique (§7.3.23).

**Pronto quando** — cabeçalho mostra usuário, empresa e logo; badge reflete o número real; estado
offline é visível; sair volta para `(auth)/login` limpando a sessão do usuário (não a do aparelho).

#### B2 · Histórico de usuários — seletor no login/chrome

|        |                                                        |
| ------ | ------------------------------------------------------ |
| Origem | `TFrmHistoricoUsuarios` (tabela local `LOGIN_HISTORY`) |

**Preservar** — trocar de usuário sem redigitar o nome de login.

**Corrigir**

- O histórico guarda **só o `username`** e a data do último acesso, no MMKV. O original guardava a
  senha em texto claro no SQLite (§7.1.9): isso não é migrado em nenhuma forma.
- Não é tela cheia de navegação: é um seletor no login/chrome.

**Pronto quando** — escolher um usuário do histórico preenche o campo e leva ao login; remover um
item do histórico funciona.

---

### Bloco C — Liberações (núcleo do produto)

É o bloco com mais correções pendentes: cinco dos nove itens críticos da análise §7.1 estão aqui.
A feature `features/liberacoes/` já tem API, schema, keys, dois hooks e o card.

#### C1 · Fila de liberações — `(app)/liberacoes` ✅

|        |                                                        |
| ------ | ------------------------------------------------------ |
| Origem | `TFrmLiberacoes` › `TabItemNotificacoes`               |
| API    | `GET /v1/remoteauthorization/searchpending/{usercode}` |

Fechada: busca sobre a lista já carregada, ícone por tipo de solicitação, pull-to-refresh e os
três estados no `<QueryState>` — o vazio da busca fica no `ListEmptyComponent`, para o campo
continuar na tela e dar para limpar o termo.

**Preservar** — filtro de tipos por flags de `TEO_USUARIOS` e filtro de alçada de desconto continuam
**no servidor**; borderôs pendentes chegam anexados à mesma fila (`TIPO_REGISTRO = 'BORDERO'`, já
exposto como `isBordero` no schema) e abrem direto o web system, sem passar por reserva.

**Corrigir**

- **Busca de verdade.** O original neutralizava o `TSearchBox` da `TListView` (`Opacity := 0`, que
  continua ocupando espaço e capturando toque) e espelhava o texto num `TEdit` paralelo — com **duas**
  estratégias diferentes para isso no mesmo app (§7.2.15). Aqui: um campo de filtro sobre a lista já
  carregada, um jeito só.
- **Sem parse posicional da mensagem** (§7.1.6). O schema já expõe `cliente`, `vendedor`, `empresa` e
  `origemLabel` como campos próprios; o card usa isso e trata `mensagem` como texto simples.
- Ícone por `solicitacao` vem de um mapa em módulo (`SOLICITACAO_ICON` em
  `features/liberacoes/lib/solicitacao-icon.ts`), não de uma **aba oculta usada como depósito de
  bitmaps** (`TabItemIcones`, §7.3.22). Glifo Unicode em `<Text>`: o projeto não tem biblioteca de
  ícones e este mapa não justificou instalar a primeira — trocar por `@expo/vector-icons` mexe só
  nesse módulo.
- Nada de fundo de item gerado com `MakeScreenshot` por linha renderizada (§7.3.22).
- `id === '0'` é item inválido: some da lista, em vez de virar alerta ao tocar.

**Pronto quando** — a busca filtra por cliente/mensagem/origem, o ícone é correto por tipo, há
pull-to-refresh e os três estados estão cobertos por `<QueryState>`.

#### C2 · Análise da liberação — `(app)/liberacoes/[id]`

|        |                                                                                                                  |
| ------ | ---------------------------------------------------------------------------------------------------------------- |
| Origem | `TFrmLiberacoes` › `TabItemDetalhes`                                                                             |
| API    | `reserve/{id}/{usercode}` na entrada · `release/{id}/{usercode}` na saída sem decidir · `authorize\|reject/{id}` |

A tela mais delicada do app: é onde o dinheiro é decidido.

**Preservar** — reserva ao abrir; devolução ao sair sem decidir (e só se a liberação ainda estiver em
`'1'` para o próprio usuário); ciclo `0 → 1 → 2|3`; o texto livre de resposta acompanhando a decisão;
o atalho de borderô abrindo o web system e traduzindo o retorno (`S`/`P` → autoriza, `N` → reprova,
vazio → preserva a situação anterior).

**Corrigir**

- **Remover a "Sugestão IA"** (§7.1.1): `Sleep(3000)` e um texto fixo no `.fmx` dizendo que todo
  cliente é "Bom Pagador", ao lado dos botões de decisão de crédito. Não migrar em nenhuma forma.
- **Remover o cadeado** (§7.2.16): um toque a mais que não protege nada. Se o time quiser proteção, o
  certo é confirmação explícita na ação, não um enfeite antes dela.
- **Sequência do borderô vem do payload** (`borderoSequencia`), nunca da última palavra de um label
  (§7.1.7).
- **Sucesso é 2xx.** Não comparar o corpo com `'{}'` (§7.1.8), e nunca dois diálogos empilhados.
- Erro de alçada ou liberação já decidida é tratado por **status** (§7.1.3), exibindo a mensagem do
  servidor como veio — sem `if mensagem = 'Erro ao requisitar servidor 400'`.
- Layout em flexbox: sem `200 + ((nLinhas - 6) * 21)` nem alturas fixas 200/230/317 (§7.2.17). A
  mensagem rola; não trunca em 9 linhas.
- Sem injetar "Cliente - X" no meio do texto da mensagem: `cliente.nome` é campo próprio e tem seu
  lugar no cabeçalho.
- Se `cliente.codigo` for nulo, o atalho para C3 não é renderizado (mesma regra do original, sem os
  malabarismos de altura).
- Concorrência: 🔒 B3. A reserva **não** trava de fato no servidor. Até isso mudar, a tela não promete
  exclusividade — nada de rótulo "reservado para você".

**Pronto quando** — abrir reserva, voltar devolve, autorizar/reprovar invalida `liberacoesKeys.all`,
e o erro do servidor aparece uma vez só, com a mensagem certa.

#### C3 · Dados do cliente — `(app)/liberacoes/[id]/cliente`

|        |                                                                                             |
| ------ | ------------------------------------------------------------------------------------------- |
| Origem | `TFrmLiberacoes` › `TabItemDetalhesCliente`                                                 |
| API    | `customerdataanalytics/{empresa}/{cliente}` · `customerpurchasehistory/{empresa}/{cliente}` |

**Preservar** — situação do cadastro, limite de crédito, primeira/última compra com valor, maior
compra, média de atraso e a lista de títulos com marcação baixado/pendente
(`FINANCEIRO_BAIXADO = 'S'`).

**Corrigir**

- **Fora os campos `FALTA IMPL...`** de Saldo de Crédito e Saldo Encontro de Contas (§7.2.12): ou o
  servidor devolve o valor, ou o campo não aparece.
- Sem `Sleep(500)` "para o skeleton aparecer" (§7.2.13).
- As duas respostas precisam de schema Zod próprio — hoje `buscarAnaliseCredito` e
  `buscarHistoricoCompras` devolvem `data` cru. Essa dívida fecha junto com a tela.

**Pronto quando** — as duas queries têm schema, a tela cobre carregando/erro/vazio e nenhum campo
mostra texto de placeholder de desenvolvimento.

#### C4 · Feedback da decisão — parte de C2

**Corrigir** — o original ia para uma aba de feedback e dava `Sleep(2000)` obrigatório antes de voltar
(§7.2.13). Aqui: feedback é estado da própria tela (ou um toast), a invalidação da query já atualiza a
fila, e o usuário volta quando quiser. As duas abas (`Aceito` / `Recusado`) viram **um** componente
parametrizado pela decisão (§7.3.21).

---

### Bloco D — Web systems

Quatro itens de menu, **uma** rota: `(app)/web/[sistema]`. O original tinha três forms praticamente
idênticos (~60 linhas cada) mais o `TFrmWebSystems` genérico que já fazia a mesma coisa (§7.3.21) —
inclusive com typo no nome de duas units (§7.3.27).

| Item de menu           | `sistema`     | Origem              |
| ---------------------- | ------------- | ------------------- |
| Pedidos de Compra      | `autcompras`  | `TFrmAutComprasWeb` |
| Autorização de Cotação | `autcotacao`  | `TFrmAutCotacaoWeb` |
| Requisição de Compra   | `reqcompras`  | `TFrmReqComprasWeb` |
| Autorizador Financeiro | `autorizador` | `TFrmWebSystems`    |

|           |                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------- |
| API       | `GET /v2/htmlresponse/<sistema>/index.html`                                                       |
| Bloqueios | 🔒 B2 (nativo vs. web) · 🔒 B5 (`react-native-webview` não instalado) · 🔒 B6 (sessão na WebView) |

**Preservar** — o conjunto de parâmetros que cada sistema espera (`autcompras`/`autcotacao`:
`baseUrl, token, userId, companyId, codeCompany, userCode`; `reqcompras`: `baseUrl, token, userId`);
a ponte de retorno que fecha a tela; para o `autorizador` aberto a partir de uma liberação, o JSON de
saída com `{ situacao, resposta }`.

**Corrigir**

- **JWT fora do fragmento da URL** (§7.1.9): no fragmento ele fica no histórico e no cache da WebView.
  Definir o mecanismo em 🔒 B6 (`injectedJavaScriptBeforeContentLoaded` + `postMessage`, ou header /
  cookie de sessão) **antes** de escrever a tela.
- Uma ponte só, tipada, com schema Zod validando o payload que volta do HTML — não `delphi://<json>`
  concatenado com string.
- `app://menu` e `delphi://` viram **um** contrato de mensagem; sem dois protocolos para a mesma coisa
  (`§5` de Clean Code no CLAUDE.md: um jeito só de fazer cada coisa).
- O `_t=<unix>` que o original anexa à URL para forçar recarga é sintoma de o HTML não reagir à mudança
  de deep link: registrar como pendência do web system, não como truque permanente no app.
- A regra de situação final do borderô (`S`/`N`/`P`) está escrita **três vezes** hoje — app, servidor e
  HTML (§7.3.21). No app novo ela existe **zero** vezes: o app só repassa o que o web devolve.

**Pronto quando** — os quatro itens abrem pela mesma rota, a sessão não trafega no fragmento, voltar
fecha a WebView, e o retorno do `autorizador` alimenta a decisão da liberação de origem.

---

### Bloco E — Notificações e push

#### E1 · Infra de push (FCM / APNs) 🔒 B7

**Preservar** — captura do token → `POST /v1/application/tokenpush` no servidor central; notificação
recebida com o app aberto **recarrega a tela certa** (fila de liberações ou cotação).

**Corrigir**

- **Sem laço infinito de pedido de permissão** (§7.2.14): pede uma vez; negado, o app segue funcionando
  com um aviso dispensável; negado permanentemente, oferece abrir as Configurações do sistema — que é
  justamente o ramo que estava **vazio** no original.
- Sem `Sleep(1000)` na verificação de permissão (§7.2.13).
- **Sem memo de debug de push em produção** (`MemoDebugPush`, §7.3.27).
- Roteamento por notificação usa o router a partir do payload, não `se o form está instanciado então
recarrega` — que, no original, simplesmente não fazia nada nos demais casos.

#### E2 · Tela de notificações — `(app)/notificacoes`

**Corrigir** — o original monta um **JSON literal de teste** ("Aqui vai a mensagem de testes…") e é
isso que o usuário vê ao tocar no sino (§7.2.11). Esta tela só é migrada com fonte de dados real; se o
servidor ainda não tem endpoint de notificações, ela permanece fora do menu em vez de exibir conteúdo
falso.

**Pronto quando** — a lista vem do servidor, o badge do chrome usa a mesma query, e tocar em uma
notificação leva ao destino correspondente.

---

### Bloco F — Resiliência e qualidade (transversal)

| #   | Item                                     | Origem / § | O que fazer                                                                                                                                    |
| --- | ---------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Fallback primário → secundário → offline | §3.1       | Resolver no `tenantApi` a cada requisição, gravando o resultado em `device.serverUrlActive`; sem duplicar o teste em cada tela                 |
| F2  | Cache offline de empresas                | §3.1       | Substituto da tabela `COMPANYS` do SQLite: persistir a lista no MMKV para o login offline                                                      |
| F3  | Erro tipado ponta a ponta                | §7.1.3     | Auditar cada tratamento de erro: decisão sempre por `ApiError.status`, nunca por texto                                                         |
| F4  | Testes automatizados                     | §1         | O original **não tem nenhum**. Começar pelos schemas Zod (tradução de payload) e pelos hooks de mutação — é onde um erro silencioso custa caro |
| F5  | Preferências de UI                       | §7.3.25    | O original guardava a ordenação preferida num `UPDATE` sem `WHERE` numa tabela de uma linha. Aqui é uma chave no MMKV                          |

---

## 4. O que não é migrado

Confirmado na análise e reafirmado aqui para não voltar em revisão:

- Borderô nativo (`TFrmBordero`) e Pedidos/Requisição de Compra nativos (`TFrmPedidosCompra`) — já
  estavam `Visible = False`, substituídos pelos web systems (§7.2.10). Sujeito a 🔒 B2.
- Gravador de vídeo e leitor de código de barras — inertes neste app.
- "Sugestão IA", campos `FALTA IMPL...`, JSON de teste das notificações, cadeado, esperas artificiais,
  parse posicional/textual e senha em claro (§7.1, §7.2, §8).

---

## 5. Critério de pronto (vale para toda tela)

1. Rota em `src/app/` só **compõe**: hooks, `<Screen>`, `<QueryState>`. Zero `axios`, zero regra.
2. Feature com `api/` + `schemas/` + `hooks/`; tipo de domínio derivado de `z.output`.
3. Payload do Orion traduzido no schema; **nome de coluna Firebird não sai de `schemas/`**.
4. Todo erro decidido por `ApiError.status`.
5. Formulário = React Hook Form + Zod; validação só no schema.
6. Estilo só por `className`, com tokens semânticos.
7. `npm run lint` e `npm run typecheck` limpos (o `pre-push` já barra o segundo).
8. Onde uma regra veio do Delphi, o comentário cita a origem (`docs/analise §X`).
9. Linha correspondente do `CLAUDE.md §6` atualizada no mesmo commit.

---

## 6. Bloqueios e dependências externas

Repetem as **Decisões em aberto** do `CLAUDE.md §7`, aqui amarradas ao bloco que travam.

| 🔒  | Bloqueio                                                                                                             | Trava      | Impacto se não resolver                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| B1  | Hash da senha — decidido (texto puro + TLS); falta o Orion aceitar. [`decisao-hash-senha.md`](decisao-hash-senha.md) | A4         | **Login não funciona** enquanto o servidor comparar MD5. Segue de maior prioridade — trava o app inteiro |
| B2  | Nativo ou web para compras e borderô                                                                                 | Bloco D    | Se a decisão for nativo, as telas 14–17 mudam de natureza e o Bloco D é reescrito                        |
| B3  | Reserva real da liberação (situação `'1'` + TTL)                                                                     | C2         | A trava de concorrência segue fictícia; o app não pode prometer exclusividade                            |
| B4  | Código de erro estável no servidor                                                                                   | A4, C2, F3 | Mapeamento de erro continua frágil, ainda que isolado num módulo                                         |
| B5  | `react-native-webview`                                                                                               | Bloco D    | Dependência ainda não instalada                                                                          |
| B6  | Mecanismo de sessão na WebView                                                                                       | Bloco D    | Escrever a tela antes da decisão significa reintroduzir o JWT no fragmento                               |
| B7  | Caminho de push: FCM (Android) × APNs (iOS)                                                                          | Bloco E    | Push funciona só em uma das plataformas                                                                  |

**Ordem de ataque sugerida:** B1 agora (trava tudo) → B4 e B3 durante o Bloco C → B2, B5 e B6 antes de
abrir o Bloco D → B7 antes do Bloco E.
