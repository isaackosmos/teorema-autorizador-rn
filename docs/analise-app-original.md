# Análise do app original — Teorema Autorizador (Delphi / FMX)

> Documento de inventário do aplicativo legado `../Teorema Autorizador`, levantado a partir do
> código-fonte (`.dpr`, `.pas`, `.fmx`), do código compartilhado em `../Commun` e, quando a regra
> só existe no servidor, do backend `Projects/Desktop/Orion Server Horse`.
> Base analisada: versão **1.0.27** (`Units/uAppConts.pas`), branch `master`.

---

## 1. Contexto e arquitetura geral

| Item | Valor |
|---|---|
| Nome interno | `Teorema Liberação Remota` (`uAppConts.NameApp`) |
| Package Android | `br.inf.teorema.autorizador4` |
| Código de sistema (licenciamento) | `00076` (`uAppConts.CodigoSistema`) |
| Banco local | SQLite `liberacao_remota.db` em `TPath.GetDocumentsPath\Database\` |
| Framework | Delphi FMX (FireMonkey) + Skia (`GlobalUseSkia := True`) |
| Plataformas | Android64 (principal), Android32, iOSDevice64, iOSSimARM64, OSX64/ARM64, Win32/Win64 |
| minSdk / targetSdk | 23 / 36 |
| Testes automatizados | **Nenhum** |
| Backend | Orion Server Horse (Delphi + Horse), rotas `v1/*`; base de dados ERP em Firebird |

O app é um **cliente fino**: nenhuma lógica de negócio de verdade roda localmente. A `Controller/Liberacoes.Controller.pas`
é apenas um wrapper de uma linha por endpoint. Todas as regras (alçada, nível de autorização, reserva,
situação do borderô) são decididas no servidor — o app apenas monta a URL/JSON e interpreta o retorno.

Distribuição do código:

```
Teorema Autorizador/              (código próprio — ~2.900 linhas .pas)
├── Controller/Liberacoes.Controller.pas   24 chamadas de API + 2 de SQLite local
├── Units/uAppConts.pas                    identidade do app
├── Units/uSQLApp.pas                      cria a tabela APOIO_AUTORIZADOR
└── Views/                                 7 formulários
../Commun/                        (compartilhado com Teorema OP, Concreteira, Inventario 4, Uptime…)
├── Controller/uBaseConfiguration.Controller.pas  login, registro de device, HTTP, config local
├── Units/                                 sessão, SQLite, JSON, diálogos, formatação, tools por SO
└── Views/                                 login, menu base, WebSystems, notificações, permissões
```

⚠️ Alterar qualquer coisa em `../Commun` afeta **todos** os apps da família "Aplicativos Horse".

---

## 2. Inventário de telas

### 2.1 Telas próprias do app

| # | Unit / Form | Tipo | Propósito |
|---|---|---|---|
| 1 | `uFrmPrincipal` / `TFrmPrincipal` | Nativa (herda `TFrmPrincipalBase`) | Menu pós-login. Roteia para todas as demais telas e recebe o gatilho de push. |
| 2 | `uFrmLiberacoes` / `TFrmLiberacoes` | Nativa | **Tela central do app.** Fila de liberações remotas do ERP (desconto, limite de crédito, preço, estorno, etc.), análise e decisão. |
| 3 | `uFrmBordero` / `TFrmBordero` | Nativa | Autorização de borderôs financeiros título a título. **Hoje desativada no menu** (`Visible = False`) — substituída pelo web system. |
| 4 | `uFrmPedidosCompra` / `TFrmPedidosCompra` | Nativa | Tela dupla via flag `iTipoForm`: `1` = autorização de pedidos de compra, `2` = requisições de compra. **Também desativada no menu.** |
| 5 | `uFrmAutCompasWeb` / `TFrmAutComprasWeb` | WebView | Autorização de compras — web system `autcompras`. |
| 6 | `uFrmAutCotacaoWeb` / `TFrmAutCotacaoWeb` | WebView | Autorização de cotação — web system `autcotacao`. Recebe gatilho de push. |
| 7 | `uFrmReqCompasWeb` / `TFrmReqComprasWeb` | WebView | Requisição de compras — web system `reqcompras`. |

### 2.2 Telas herdadas de `../Commun/Views`

| Unit / Form | Propósito |
|---|---|
| `uFrmLoginBase` / `TFrmLoginBase` | **11 abas** em um único form: Splash → Documento → Configuração → Bancos → Login → Identificação → Configuração pessoal → Licença → Concluído → Erro de licença → Escolha de empresa. |
| `uFrmPrincipalBase` / `TFrmPrincipalBase` | Chrome do app: cabeçalho, menu lateral animado, badge de notificações, indicador offline, logo da empresa, ciclo de vida do push. |
| `uFrmWebSystems` / `TFrmWebSystems` | Contêiner genérico de web systems (`/v2/htmlresponse/<sistema>`) com ponte nativa `delphi://` (câmera, galeria, vídeo, código de barras, WhatsApp, share). Usado para "Autorizador Financeiro" e para o borderô. |
| `uFrmNotificacao` / `TFrmNotificacao` | Lista de notificações do sino. **Conteúdo hardcoded de teste** (ver §7). |
| `uFrmHistoricoUsuarios` / `TFrmHistoricoUsuarios` | Lista `LOGIN_HISTORY` local para trocar de usuário sem redigitar o login. |
| `uFrmPermissao` / `TFrmPermissao` | Modal genérico de pedido de permissão (usado só para notificações). |
| `uFrmImput` / `TFrmImput` | Modal genérico de entrada de texto (endereços de servidor na tela de configuração). |
| `uFrmGravadorVideo`, `UnitLeitor` (`TFrmLeitor`) | Gravador de vídeo e leitor de código de barras — só acionados pela ponte `delphi://` do WebSystems; **inertes neste app**. |

### 2.3 Abas internas (o app usa `TTabControl` como stack de navegação)

- **`uFrmLiberacoes`**: `TabItemNotificacoes` (fila) · `TabItemDetalhes` (análise) · `TabItemDetalhesCliente` (crédito + histórico) · `TabItemFeedbackAceito` · `TabItemFeedbackRecusado` · `TabItemIcones` (**aba oculta usada só como repositório de bitmaps**).
- **`uFrmBordero`**: `TabItemMS` (lista de borderôs) · `TabItemDetalhe` (títulos DT) · `TabItemAnexos` (vazia).
- **`uFrmPedidosCompra`**: `TabItemImagens` (repositório de bitmaps) · `TabItemListagemMS` · `TabItemDetalhePedido` · `TabItemProdutos` · `TabItemObservacoes` · `TabItemRequisicao`.

### 2.4 Menu principal — o que está realmente visível

| Item do menu | Destino | Estado |
|---|---|---|
| Liberações Remotas | `TFrmLiberacoes` (nativa) | ✅ visível |
| Liberação Borderô | `TFrmBordero` (nativa) | ❌ `Visible = False` |
| Pedidos de Compra | `TFrmPedidosCompra` `iTipoForm=1` | ❌ `Visible = False` |
| Requisição de Compra | `TFrmPedidosCompra` `iTipoForm=2` | ❌ `Visible = False` |
| Pedidos de Compra | `TFrmAutComprasWeb` (web) | ✅ visível |
| Autorização de Cotação | `TFrmAutCotacaoWeb` (web) | ✅ visível |
| Requisição de Compra | `TFrmReqComprasWeb` (web) | ✅ visível |
| Autorizador Financeiro | `FrmWebSystems.Open('autorizador')` | ✅ visível |

> Ou seja: **~2.850 linhas de Pascal (`uFrmBordero` + `uFrmPedidosCompra`) e ~1,1 MB de `.fmx`
> continuam sendo compiladas e mantidas, mas o usuário não tem como abri-las pelo menu.**
> O único ponto que ainda referencia `TFrmBordero` é o `uses` de `uFrmLiberacoes` — o fluxo real
> de borderô já foi migrado para o web system.

---

## 3. Regras de negócio por tela

### 3.1 `TFrmLoginBase` — onboarding, registro de dispositivo e login

Fluxo em três estágios distintos, todos dentro do mesmo form:

1. **Bootstrap no servidor central Teorema** (`https://orion2.teorema.inf.br`, token fixo compilado):
   - `GetCompanyDocument` valida CNPJ/CPF + `systemcode=00076`; sem registro → erro "Documento ou Licença não encontrado".
   - CNPJ `02.383.417/0001-06` ativa o modo demo (`IsDemo := True`).
   - `BuscaEnderecos` resolve `SERVER_URL_PRIMARY` / `SECONDARY` / `PRINT` do tenant.
   - `SolicitaCadastroConta` registra o aparelho. Respostas de negócio: `bloqueado`, `licencas` (sem licenças), `demo` (expirada) → aba de erro de licença.
2. **Definição de conexão**: testa `/v1/ping` no primário; falhando, tenta o secundário; falhando os dois,
   oferece **login offline** (usa a lista de empresas em cache na tabela `COMPANYS`).
3. **Login no servidor do cliente**: `POST /v1/auth/login` com `username` em maiúsculas, `password` em **MD5 puro**,
   `registerid`, header `tokendatabase`.
   - `erro=usuario` → "Usuário não encontrado"; `erro=senha` → "Senha não confere"; `erro=cadastro` → "Aparelho com registro excluído".
   - `DEVICE_STATUS = 2` → grava status 2 localmente e bloqueia ("Dispositivo Bloqueado").
   - Sucesso → persiste `JWT`, `USUARIO_ID`, `USUARIO_CODIGO`.
4. **Validade da licença**: se `REGISTER_EXPIRATION <= Now`, força `DEVICE_STATUS := 0` e reinicia o registro.
5. **Escolha da empresa** (`/v1/application/companyfromuser/{usercode}`) define `CURRENT_COMPANY_*` e só então abre o menu.

### 3.2 `TFrmPrincipal` — menu

- No `FormShow` cria a tabela local `APOIO_AUTORIZADOR` (`CheckDb`) e chama `ExigeNotificacaoHabilitada`.
- **Permissão de notificação (Android)**: se `negada`, exibe modal e re-solicita — **em laço recursivo, sem limite**.
  Se `negadapermanentemente`, o bloco está **vazio** (código comentado: "por regras de negócio não posso obrigar 100%").
- **Roteamento de push com app aberto** (`GatilhoNotificacao`): se `FrmLiberacoes` estiver instanciado, recarrega a fila;
  senão, se `FrmAutCotacaoWeb` estiver instanciado, recarrega a página. Caso contrário, nada acontece.

### 3.3 `TFrmLiberacoes` — fila de liberações (regra principal do produto)

**Listagem** (`GET /v1/remoteauthorization/searchpending/{usercode}`) — filtros aplicados no servidor:
- Somente `LIBERACAO_LIBERADA IN (0, 1)` e `LIBERACAO_OBSERVACOES = '1'`.
- Somente os tipos (`LIBERACAO_SOLICITACAO`) que o usuário tem permissão para autorizar, derivados das flags de
  `TEO_USUARIOS` (ver tabela em §4.4).
- **Filtro de alçada de desconto**: esconde solicitações cujo `LIBERACAO_DESCONTO` supere a alçada do usuário em
  `TEO_USUARIOS_ALCADA` (tipo `'2'`): `ALCADA_DESCONTO_UNITARIO` para `LIBERACAO_TIPO='I'`,
  `ALCADA_DESCONTO_GERAL` para `'G'`. Sem alçada cadastrada ou zerada, nada é escondido.
- Borderôs pendentes são **anexados sinteticamente** à mesma lista (`TIPO_REGISTRO = 'BORDERO'`), lendo
  `FINANCEIRO_BORDERO_MS` com `BORDERO_SITUACAO = 'O'` — e só para usuários com `USUARIO_AUT_PGT_FINANC = 'S'`.

**Renderização do item** (regras puramente de apresentação, no app):
- A 1ª linha de `LIBERACAO_MENSAGEM` é sempre a empresa; as linhas seguintes são extraídas **por índice posicional**
  (`SplitString(...)[1]` e `[2]` no Android, `[2]` e `[4]` no Windows).
- Se a API trouxer `CLIFOR_NOME`/`VENDEDOR_NOME`, eles viram o destaque em negrito e o motivo desce para a linha cinza.
- `LIBERACAO_ORIGEM` mapeia para a categoria exibida: `P`=Pedido de Vendas, `O`=Orçamento, `OS`=Ordem de Serviço,
  `N`=Nota Fiscal, `F`=Financeiro, `M`=Entrada/Saída de Itens, `C`=Pedido de Compra, `E`=Estoque, `R`=Romaneio,
  `T`=Transformação, `CO`=Cotação, `V`=Vendas Balcão.
- `LIBERACAO_SOLICITACAO` escolhe o ícone (16 grupos — ver §4.4).

**Abertura / reserva**:
- Identificador `'0'` é rejeitado no cliente ("Identificador de liberação inválido").
- `GET /v1/remoteauthorization/reserve/{id}/{usercode}` grava `LIBERACAO_LIBERADA='1'` e
  `USUARIO_CODIGO_LIBERADOR = usercode`. O servidor recusa quando a situação é `2` (já aprovada),
  `3` (já reprovada) ou `9` (desistência), e reaplica a validação de alçada.
- Item com `TIPO_REGISTRO = 'BORDERO'` **não passa por reserva** — abre direto o web system (desde 22/06/2026
  o ERP não cria mais linha em `VENDAS_LIBERACAO` para borderô).

**Tela de análise**:
- Um "cadeado" (`RectCadeado`) precisa ser tocado para revelar os botões Autorizar/Recusar.
- Se `CLIFOR_NOME` não aparece na mensagem, o app **injeta a linha "Cliente - X" logo após a 1ª linha** (não no fim,
  porque o quadro corta o excedente). A altura do quadro é calculada como `200 + ((nLinhas - 6) * 21)`, limitada
  entre 6 e 9 linhas.
- Se `ITEM_REDUZIDO` estiver vazio, oculta os blocos de item e encolhe o layout (alturas fixas 200/230 vs. 317/317).
- Se `CLIFOR_CODIGO` estiver vazio, esconde o atalho "mais informações do cliente".
- `IdentificaBordero`: se o **texto exibido** contiver "Bordero", extrai a **última palavra** da mensagem como
  sequência do borderô e troca os botões de decisão pelo atalho de borderô.
- **Voltar sem decidir é permitido**: `GET /v1/remoteauthorization/release/{id}/{usercode}` devolve a liberação
  para a fila (`LIBERACAO_LIBERADA='0'`, liberador limpo) — e só se ela ainda estiver em `'1'` **para o próprio
  usuário**, para não derrubar a análise de outro. Se a devolução falhar, volta para a lista mesmo assim.

**Decisão**:
- Autorizar: `POST /v1/remoteauthorization/authorize/{id}` com o corpo = texto livre do memo de resposta →
  `LIBERACAO_LIBERADA='2'`, `LIBERACAO_RESPOSTA = resposta`.
- Rejeitar: `POST /v1/remoteauthorization/reject/{id}` → `LIBERACAO_LIBERADA='3'`.
- Ambos revalidam a alçada de desconto no servidor e podem retornar 400 com mensagem pronta
  ("Desconto de X% acima da sua alçada de Y%…").
- Após a decisão: tela de feedback → `Sleep(2000)` → volta para a lista e recarrega.

**Fluxo de borderô embutido na liberação**:
- O atalho abre `FrmWebSystems.Open('autorizador', 'S', sequencia, resposta)`.
- Ao fechar, o HTML devolve JSON pela ponte `delphi://`: `situacao` (`S` todos aprovados / `N` todos reprovados /
  `P` parcial) e `resposta` (texto editado).
- O botão "Aprovar todos" traduz isso: `S` ou `P` → autoriza a liberação; `N` → rejeita. Se o usuário só fechou a
  tela, `situacao` vem vazia e a situação anterior é preservada.

**Detalhes do cliente** (`customerdataanalytics` + `customerpurchasehistory`): situação do cadastro, limite de crédito,
primeira/última compra com valor, maior compra, média de atraso, e lista de títulos financeiros com ícone
baixado/pendente (`FINANCEIRO_BAIXADO = 'S'`).

### 3.4 `TFrmBordero` (nativa, desativada)

- Lista borderôs com `BORDERO_SITUACAO = 'O'`; detalhe traz os títulos (`FINANCEIRO_BORDERO_DT` × `FINANCEIRO_DT`).
- **Borderô vazio** → aviso "Este borderô está vazio. Recomenda-se excluir o registro pelo sistema desktop."
- **Borderô com 1 único título** → abre um modal simplificado de aprovar/recusar direto.
- Decisão título a título por **swipe** (direita = aprova, esquerda = reprova) ou pelos botões "Aprovar todos" /
  "Reprovar todos". Estado da decisão guardado em `TagFloat` do item: `0` pendente, `1` aprovado, `2` reprovado.
- **Não deixa finalizar com algum título pendente** ("Você precisa definir todos os documentos antes de finalizar").
- Calcula a situação final no cliente (`S` / `N` / `P`) — e o servidor **recalcula a mesma coisa** ao gravar.
- `POST /v1/bordero/decision/{sequencia}/{usercode}` com array de
  `{id, id_financial, id_user, id_bordero, status}` (`status`: `1` aprovado, `0` reprovado). O servidor atualiza
  `FINANCEIRO_BORDERO_DT.AUTHORIZED`, insere histórico em `FINANCE_AUTORIZATION` e grava `BORDERO_SITUACAO`.

### 3.5 `TFrmPedidosCompra` (nativa, desativada) — dois modos

**Modo 1 — Pedidos de compra** (`GET /v1/purchaseauthorization/pendingauthorization`):
- Parâmetros: `previouslevel` (S/N), `showcompanies` (S/N), `order` (`VALOR` | `PREVISAO` | `EMISSAO`),
  `iduser`, `idcompany`, `codecompany`.
- Ordenação preferida é **persistida no SQLite local** (`APOIO_AUTORIZADOR.ORDEM_LISTAGEM_PEDIDOS`) e recarregada
  no `FormShow`. Default: `VALOR`.
- Regras do servidor: só `COMPRA_SITUACAO = 'P'`; modo **grupo** (`PARAMETRO_USA_GRUPO_AUTORIZ = 'S'`) exige que o
  usuário seja membro do grupo (`AUTHORIZATIONS_DT`) e que `AUTHORIZATION_LEVEL_VALUE >= COMPRA_VALOR_TOTAL`;
  modo **usuário** só mostra pedidos onde `USUARIO_CODIGO_AUTORIZADOR` é o próprio.
  Com `previouslevel = 'S'`, um nível superior pode pegar pedido ainda parado em nível anterior.
- Valor exibido: `COMPRA_VALOR_TOTAL / 100` (o campo vem em centavos).
- Seleção múltipla por item (`Tag = 1`), com ações rápidas de aprovar/reprovar direto no card.
- **Alçada mensal** (`GET /v1/purchaseauthorization/limitamountpermonth/{idcompany}/{iduser}`): se `TOTAL_VALUE = '0'`
  o widget some; senão desenha a barra proporcional `REMAINING_VALUE / TOTAL_VALUE`.
- Aprovar/Reprovar enviam um **array** de pedidos selecionados com `iduser`, `internalobservation`, `codecompany`,
  `previouslevel`, `usercode`. O servidor valida nível, alçada por transação e alçada mensal por pedido, e devolve
  `{}` em caso de sucesso total ou `{"mensagem": "..."}` no primeiro erro.
- Observações do pedido podem ser salvas sem movimentar (`POST /v1/purchaseauthorization/addnote`).

**Modo 2 — Requisições** (`GET /v1/purchaserequisition/list/{iduser}`):
- Itens (`TIPO = 'I'`) e serviços (`TIPO = 'S'`) na mesma lista, diferenciados por cor de marcador.
- Modal de decisão com observação pública e observação interna.
- O app **remonta o payload** a partir do próprio JSON do item, traduzindo campos PT→EN
  (`TRANSACAO`→`transaction`, `REQUISICAO_SEQUENCIA`→`sequence`, `TIPO`→`movimenttype`,
  `EMPRESA_ITEM`→`codecompany`, `id_authorization`→`idauthorization`) e acrescentando `iduser`.

### 3.6 Telas web (`autcompras`, `autcotacao`, `reqcompras`, `autorizador`)

- Nenhuma regra de negócio no Delphi. O form monta a URL, injeta a sessão no **hash** e navega.
- `autcompras` / `autcotacao` recebem `baseUrl, token, userId, companyId, codeCompany, userCode`;
  `reqcompras` recebe só `baseUrl, token, userId`.
- Voltar: os três interceptam `app://menu` e fecham; o `FrmWebSystems` usa o protocolo `delphi://` com payload JSON.

---

## 4. Modelos de dados

### 4.1 Banco local SQLite (`liberacao_remota.db`)

**`DEVICE_INFO`** — linha única, criada por `../Commun/Units/uSqlLocalStructure.pas`:

| Campo | Tipo | Observação |
|---|---|---|
| `DEVICE_STATUS` | INTEGER | `0` não registrado · `1` ativo · `2` bloqueado |
| `REMIND_ME` | INTEGER | lembrar credenciais |
| `DEVICE_NAME` / `DEVICE_ALIAS` | VARCHAR(255) | identificador do aparelho / apelido dado pelo usuário |
| `SERVER_URL_PRIMARY` / `_SECONDARY` / `_PRINT` / `SERVER_URL` | VARCHAR(255) | `SERVER_URL` = a que respondeu ao ping |
| `REGISTER_ID` | INTEGER | id do registro no servidor central |
| `TOKEN_DATABASE` | VARCHAR(255) | identifica a base do tenant |
| `JWT` | VARCHAR(255) | token do usuário |
| `LAST_LOGIN` | DATETIME | |
| `COMPANY_DOCUMENT` / `COMPANY_CODE` / `COMPANY_ID` | VARCHAR(20) / VARCHAR(20) / INTEGER | licenciada |
| `USER_ID` / `USER_CODE` / `USER_NAME` / `USER_CONTACT` | INTEGER / VARCHAR(3) / VARCHAR(255) / VARCHAR(255) | `USER_CODE` é sempre 3 dígitos com zero à esquerda |
| `USER_LOGIN` / `USER_PASSWORD` | VARCHAR(255) | **senha gravada em texto claro** |
| `REGISTER_EXPIRATION` | DATE_TIME | validade da licença demo (typo no DDL) |

**`COMPANYS`** — cache offline: `ID` (PK autoincrement), `COMPANY_ID` INTEGER, `COMPANY_CODE`, `COMPANY_NAME`, `STATUS` INTEGER (`1` = ativa).
**`LOGIN_HISTORY`** — `ID` (PK), `USER_CODE` VARCHAR(3), `USER_LOGIN` VARCHAR(255).
**`SYNC_HISTORY`** — `ID` (PK), `PROCESS` VARCHAR(50) UNIQUE, `LAST_SYNC` DATE. *(criada, mas não usada por este app.)*
**`APOIO_AUTORIZADOR`** (própria do app, `Units/uSQLApp.pas`) — `ORDEM_LISTAGEM_PEDIDOS` VARCHAR(255).
Tabela de **uma coluna e uma linha**, sem chave; o UPDATE é feito sem `WHERE`.

### 4.2 Sessão em memória — `TParameters.Sessao` (singleton, `../Commun/Units/uAppParameters.pas`)

Espelha `DEVICE_INFO` e acrescenta:

- `Online: Boolean` — decide entre API e cache local.
- `FDLocalConnection: TFDConnection` — conexão SQLite.
- `CURRENT_COMPANY_CODE` / `CURRENT_COMPANY_ID` / `CURRENT_COMPANY_NAME` — empresa escolhida no login (≠ empresa licenciada).
- **12 propriedades `MIDDLEWARE_*` e 3 `PARAMETRO_OS_*` que pertencem a outros apps da família e nunca são lidas aqui.**

### 4.3 Entidades trafegadas pela API (nomes de campo = colunas Firebird do ERP)

**Liberação** (`searchpending`, origem `VENDAS_LIBERACAO` + joins):

| Campo | Tipo | Uso no app |
|---|---|---|
| `LIBERACAO_SEQUENCIA` | inteiro (string) | chave; vira `Tag`/`TagString` do item |
| `LIBERACAO_MENSAGEM` | texto multilinha | parseado por posição para motivo/detalhe |
| `LIBERACAO_ORIGEM` | char(1..2) | categoria (P/O/OS/N/F/M/C/E/R/T/CO/V) |
| `LIBERACAO_SOLICITACAO` | char(2..4) | tipo → ícone e permissão |
| `LIBERACAO_TIPO` | char(1) | `I` desconto unitário · `G` desconto geral |
| `LIBERACAO_DESCONTO` | numérico (%) | base da alçada |
| `LIBERACAO_LIBERADA` | char(1) | `0` livre · `1` em análise · `2` aprovada · `3` reprovada · `9` desistência |
| `LIBERACAO_DATA` / `LIBERACAO_HORA` | data / hora (hora cortada em 8 chars) | |
| `LIBERACAO_MAQUINA` | string | estação que pediu |
| `LIBERACAO_RESPOSTA` | texto | resposta do autorizador |
| `EMPRESA_MOVTO` / `EMPRESA_NOME` | string | |
| `EMPRESA_CLIFOR` / `CLIFOR_CODIGO` / `CLIFOR_NOME` | string | cliente |
| `EMPRESA_ITEM` / `ITEM_REDUZIDO` / `ITEM_DESCRICAO` | string | item |
| `VENDEDOR_CODIGO` / `VENDEDOR_NOME`, `USUARIO_CODIGO` / `USUARIO_NOME`, `USUARIO_CODIGO_LIBERADOR` | string | |
| `CONDICAO_CODIGO` / `CONDICAO_DESCRICAO`, `OPERACAO_CODIGO`, `SERVICO_CODIGO` / `SERVICO_DESCRICAO`, `TRANSACAO`, `UUID` | string | |
| `TIPO_REGISTRO`, `BORDERO_SEQUENCIA`, `BORDERO_NUMERO` | string | **só nas linhas sintéticas de borderô** |

**Cliente — análise de crédito** (`customerdataanalytics`): `CC_SITUACAO`, `CLIFOR_CREDITO_LIMITE`,
`PRIMEIRA_DATA` + `VALOR_PRIMEIRA_DATA`, `ULTIMA_DATA` + `VALOR_ULTIMA_DATA`, `MAIOR_VALOR`, `MEDIA_ATRASO`, `MAIOR_ATRASO`.
**Histórico financeiro** (`customerpurchasehistory`): `FINANCEIRO_DATA_EMISSAO`, `FINANCEIRO_VALOR`,
`FINANCEIRO_BAIXADO` (`S`/`N`), `FINANCEIRO_ORIGEM`.

**Borderô MS** (`bordero/searchpending`): `BORDERO_SEQUENCIA`, `BORDERO_NUMERO`, `BORDERO_DATA`,
`BORDERO_SITUACAO` (`O` aguardando · `S` autorizado · `N` não autorizado · `P` parcial),
`BORDERO_VENCTO_INICIAL/FINAL`, `BORDERO_LIMITE_VALOR`, `BORDERO_TIPO_PAGAMENTO`, `BORDERO_TARIFA`, `BORDERO_JUROS`,
`EMPRESA_MOVTO` / `EMPRESA_NOME`, `CONTA_CODIGO` / `CONTA_DESCRICAO`, `TIPOREC_CODIGO` / `TIPOREC_DESCRICAO`,
`USUARIO_CODIGO` / `USUARIO_NOME`, `TOTAL_VALOR_DT`, `UUID`.
**Borderô DT** (`bordero/detail/{seq}`): `ID`, `ID_FINANCIAL`, `BORDERO_SEQUENCIA_DT`, `TRANSACAO`,
`FINANCEIRO_PARCELA`, `FINANCEIRO_PARCELA_NUMERO`, `FINANCEIRO_DATA_VENCIMENTO`, `FINANCEIRO_VALOR_PARCELA`,
`CLIFOR_NOME`, `BORDERO_NUMERO`, `TOTAL_PARCELAS`, `BORDERO_BAIXADO`, `AUTHORIZED`.

**Pedido de compra** (`pendingauthorization`, origem `COMPRAS_MS`): `TRANSACAO`, `ID`, `EMPRESA_MOVTO`/`EMPRESA_NOME`,
`COMPRA_DOCUMENTO`, `COMPRA_SITUACAO` (`P` pendente), `COMPRA_VALOR_TOTAL` (**centavos**),
`COMPRA_DATA_EMISSAO`/`_LANCAMENTO`/`_PAGAMENTO_PREVISTA`, `COMPRA_OBSERVACOES`, `COMPRA_OBSERVACOES_INTERNA`,
`COMPRA_CONDICAO_PAGAMENTO`/`CONDICAO_DESCRICAO`, `CLIFOR_NOME`/`CLIFOR_ID`, `USUARIO_NOME`/`USUARIO_ID`,
`USUARIO_NOME_AUTORIZADOR`, `AUTHORIZED`, `AUTHORIZED_LEVEL` (`'00'`…), `AUTHORIZATION_LEVEL`,
`ID_AUTHORIZATION`/`DESCRIPTION` (grupo), `ID_AUTHORIZATIONSLIMIT`, `CEILING_MONTH_VALUE`, `TIPO_COMPRA_DESC`.
**Detalhe** (`details/{transaction}`) retorna `{ DataMS: {...}, Totals: { cValorProdutos, cValorDescontoItens,
cValorTotalItens, cValorServicos, cValorDescontoServicos, cValorTotalServicos, cValorIPI, cTotalICMS, cValorFrete,
cValorBruto, cValorDescontos, cTotalLiquido, cTotalLiquidoCurrency } }`.
**Itens/serviços** (`products/{transaction}/{I|S}`): `COMPRA_ITEM_DESCRICAO`/`COMPRA_SERVICO_DESCRICAO`,
`COMPRA_QUANTIDADE`, `UNIDADE_UNIDADE`, `COMPRA_CUSTO_UNITARIO`, `COMPRA_DESCONTO_VALOR`, `COMPRA_VALOR_LIQUIDO`,
`COMPRA_VALOR_TOTAL`, `COMPRA_DATA_NECESSIDADE`, `CLASSIFICACAO_DESCRICAO`, `CUSTO_NOME`, observações.
**Alçada mensal**: `TOTAL_VALUE`, `REMAINING_VALUE`, `REMAINING_VALUE_FORMATED`.
**Requisição** (`purchaserequisition/list/{iduser}`): `TRANSACAO`, `REQUISICAO_SEQUENCIA`, `REQUISICAO_NUMERO`,
`TIPO` (`I`/`S`), `DESCRICAO`, `REQUISICAO_QUANTIDADE`, `UNIDADE_UNIDADE`, `REQUISICAO_PRIORIDADE`,
`REQUISICAO_DATA_NECESSIDADE`, `CLASSIFICACAO_DESCRICAO`, `CUSTO_NOME`, `OBSERVACAO`,
`REQUISICAO_OBSERVACAO`, `REQUISICAO_OBSERVACAO_INTERNA`, `EMPRESA_ITEM`, `id_authorization`.

### 4.4 Tabelas de domínio (referência para o rewrite)

**Tipos de solicitação × permissão do usuário** (montado no servidor a partir de `TEO_USUARIOS`):

| Flag em `TEO_USUARIOS` | Códigos liberados | Ícone no app |
|---|---|---|
| *(sempre)* | `SS` | supervisor |
| `USUARIO_AUT_ACESSO_CXA` | `ACX` | caixa |
| `USUARIO_AUT_REIMPRESSAO` | `RIV` | reimpressão |
| `USUARIO_AUT_CANCVENDA` | `CV`, `RC` | cancelar |
| `USUARIO_AUT_DESCONTO` | `DG`, `DIS`, `DE`, `DF`, `MG` | desconto |
| `USUARIO_AUT_LIMITE` | `LCU`, `VCS`, `CI` | limite |
| `USUARIO_AUT_PRECO` | `PMC`, `PMMI`, `PMMA` | preço |
| `USUARIO_AUT_ESTOQUE` | `SQE` | estoque |
| `USUARIO_AUT_BXA_FINANC` | `DP` | baixa |
| `USUARIO_AUT_CND_ESPECI` | `CE`, `CEL`, `FPM` | condição especial |
| `USUARIO_AUT_PEDIDOS` | `DPF`, `LOP`, `LPV` | pedidos |
| `USUARIO_AUT_BXAPARCIAL` | `VP` | baixa |
| `USUARIO_AUT_ESTORNO` | `EST` | estorno |
| `USUARIO_AUTORIZADOR_FINANCEIRO` | `S`→`TV`,`VIS`,`PRA` · `V`→`VIS` · `P`→`PRA` | financeiro/custos |
| `USUARIO_AUTORIZADOR_CUSTOS` | `VCE` | financeiro/custos |
| `USUARIO_AUTORIZADOR_COMPRAS` | `LPC` | compras |
| `USUARIO_AUT_MANUT_PRECO` | `MIP` | manutenção de preço |
| `USUARIO_SUPERVISOR` | `SUP` | *(sem ícone mapeado no app)* |
| `USUARIO_ALTERA_OPERACAO` | `REC` | *(sem ícone mapeado no app)* |
| `USUARIO_AUT_PGT_FINANC` | — | habilita ver borderôs na fila |

**Tabelas ERP tocadas** (Firebird): `VENDAS_LIBERACAO`, `TEO_USUARIOS`, `TEO_USUARIOS_ALCADA`, `TEO_USUARIOS_EMPRESAS`,
`EMPRESAS`, `CLIENTES_FORNECEDORES`, `ITENS`, `VENDEDORES`, `CONDICAO_PAGAMENTO`, `SERVICOS`, `FINANCEIRO_MS`,
`FINANCEIRO_DT`, `FINANCEIRO_BORDERO_MS`, `FINANCEIRO_BORDERO_DT`, `FINANCE_AUTORIZATION`, `CONTAS`,
`TIPO_RECEBIMENTO`, `COMPRAS_MS`, `COMPRAS_TIPOS`, `AUTHORIZATIONS`, `AUTHORIZATIONS_DT`, `AUTHORIZATIONS_USERS`,
`AUTHORIZATIONS_LIMIT`, `AUTHORIZATIONS_MOVTO`, `PARAMETROS_EMPRESA`.

---

## 5. Integrações externas

### 5.1 Servidor central Teorema — `https://orion2.teorema.inf.br`

Autenticação: JWT **fixo, hardcoded** em `../Commun/Units/uInternalConsts.pas`.

| Método | Rota | Uso |
|---|---|---|
| GET | `/v1/application/companyinformation?document=&systemcode=00076` | valida documento e licença |
| GET | `/v1/application/getserverurl?document=` | descobre as URLs do tenant |
| POST | `/v1/application/register` | registra o aparelho (retorna `id`, `expiration`) |
| GET | `/v1/application/lastlogin/{registerid}` | telemetria de último acesso |
| POST | `/v1/application/tokenpush` | registra `{register_id, push_token}` |

### 5.2 Servidor do cliente (tenant) — `TParameters.Sessao.SERVER_URL`

Autenticação: `Authorization: Bearer <JWT do usuário>` (no login, header `tokendatabase`).

| Método | Rota | Chamador |
|---|---|---|
| POST | `/v1/auth/login` | `TFrmLoginBase` |
| GET | `/v1/auth/setup/{documento}` | lista de bases disponíveis (tela de configuração) |
| GET | `/v1/ping` | teste de conexão (primário / secundário / impressão) |
| GET | `/v1/application/companyfromuser/{usercode}` | escolha de empresa |
| GET | `/v1/application/photocompany/{codeCompany}` | logo no cabeçalho |
| GET | `/v1/remoteauthorization/searchpending/{usercode}` | fila de liberações |
| GET | `/v1/remoteauthorization/reserve/{id}/{usercode}` | reservar |
| GET | `/v1/remoteauthorization/release/{id}/{usercode}` | devolver para a fila |
| GET | `/v1/remoteauthorization/customerdataanalytics/{empresa}/{cliente}` | análise de crédito |
| GET | `/v1/remoteauthorization/customerpurchasehistory/{empresa}/{cliente}` | histórico financeiro |
| POST | `/v1/remoteauthorization/authorize/{id}` · `/reject/{id}` | decisão (corpo = texto da resposta) |
| GET | `/v1/bordero/searchpending?usercode=` · `/v1/bordero/detail/{seq}` | borderô |
| POST | `/v1/bordero/decision/{seq}/{usercode}` | decisão do borderô |
| GET | `/v1/purchaseauthorization/pendingauthorization?…` · `/details/{tr}` · `/products/{tr}/{tipo}` · `/limitamountpermonth/{idcompany}/{iduser}` | compras |
| POST | `/v1/purchaseauthorization/authorize` · `/reprove` · `/addnote` | compras |
| GET | `/v1/purchaserequisition/list/{iduser}` | requisições |
| POST | `/v1/purchaserequisition/authorize` · `/reprove` | requisições |
| GET | `/v2/htmlresponse/<sistema>/index.html#config=…` | web systems embutidos |

Cliente HTTP: **RESTRequest4D**. Qualquer status > 399 vira `Exception` com a mensagem do campo `erro` do corpo
(`ExtractServerErrorMessage`); sem JSON válido, a mensagem vira `"Erro ao requisitar servidor <status>"`.

### 5.3 Web systems embutidos

Quatro páginas hospedadas pelo próprio Orion. A sessão vai no **fragmento (`#`) da URL** — `token`, `userId`,
`companyId`, `codeCompany`, `userCode`, `baseUrl`, tudo URL-encoded. Comunicação de volta:

- Forms próprios (`autcompras`, `autcotacao`, `reqcompras`): pseudo-URL `app://menu` fecha a tela.
- `FrmWebSystems`: protocolo `delphi://` com sub-rotas `camera/foto`, `camera/galeriafoto`, `camera/galeria`,
  `camera/video`, `scanner/barcode`, `whatsapp/<texto>`, `share/<texto>`; qualquer outro `delphi://<json>`
  fecha o form com `sJSONExit`. A URL do `autorizador` leva ainda `_t=<unix>` para forçar recarga
  (sem isso o `init()` do HTML não roda de novo e o deep-link é ignorado).

### 5.4 Push notification

- **Android**: FCM via `FMX.PushNotification.Android` + `google-services.json`.
- **iOS**: APNs nativo (`FMX.PushNotification.iOS`) — o repo não tem o Firebase iOS SDK completo, então o token
  devolvido é um device token da Apple, **não** um token FCM (o servidor precisa tratar os dois caminhos).
- Fluxo: `OnServiceConnectionChange` captura o token → `EnviaTokenPushServer` → central Teorema.
  `OnServiceConnectionReceiveNotification` despeja o payload num `TMemo` de debug e chama `GatilhoNotificacao`.

### 5.5 Outras

- **SQLite via FireDAC** (`FireDAC.Phys.SQLite`), arquivo em Documents; no macOS usa `libsqlite3.dylib`.
- **DataSet.Serialize** para converter `TFDQuery` → JSON nas duas consultas locais.
- **Skia** (renderização) e **`InstalarSafeArea`** (compensa o edge-to-edge do Android 15+/targetSdk ≥ 35).

---

## 6. Fluxos de navegação

### 6.1 Inicialização

```
TeoremaAutorizador.dpr
  └─ CreateForm(TFrmLoginBase)  +  CreateForm(TFrmWebSystems)
       │
       ├─ FormShow → CreateLocalConnection (SQLite + CheckLocalStructure)
       ├─ Splash (Sleep 3s) → LoadConfiguration
       │
       ├─ Dispositivo NÃO configurado ──→ Documento → Configuração → (Bancos) →
       │                                   Login → Identificação → Config. pessoal →
       │                                   Licença → Concluído (Sleep 5s)
       │
       └─ Dispositivo configurado ─────→ ping primário → (falha) ping secundário
                                          │                    └─ (falha) → login offline?
                                          └─ Login → Escolha de empresa → TFrmPrincipal
```

### 6.2 Menu → telas

```
TFrmPrincipal
 ├─ Liberações Remotas ........ TFrmLiberacoes        (ShowModal)
 ├─ Pedidos de Compra ......... TFrmAutComprasWeb     (ShowModal, WebView)
 ├─ Autorização de Cotação .... TFrmAutCotacaoWeb     (ShowModal, WebView)
 ├─ Requisição de Compra ...... TFrmReqComprasWeb     (ShowModal, WebView)
 ├─ Autorizador Financeiro .... FrmWebSystems.Open('autorizador')
 ├─ [oculto] Borderô .......... TFrmBordero
 ├─ [oculto] Pedidos .......... TFrmPedidosCompra (iTipoForm=1)
 ├─ [oculto] Requisições ...... TFrmPedidosCompra (iTipoForm=2)
 ├─ sino ...................... TFrmNotificacao
 ├─ usuário ................... TFrmHistoricoUsuarios → troca de usuário → volta ao Login
 └─ sair ...................... TFrmLoginBase (bRelogin = True)
```

### 6.3 Liberações — máquina de estados

```
TabItemNotificacoes (fila)
   │  clique em item comum         clique em item TIPO_REGISTRO=BORDERO
   │        │                                   │
   │   reserve/{id}                    FrmWebSystems.Open('autorizador', seq)
   │        │                                   └─ ao fechar → recarrega a fila
   ▼        ▼
TabItemDetalhes (análise)
   ├─ "mais informações" ─────────▶ TabItemDetalhesCliente ──(voltar)──┐
   ├─ cadeado → revela Autorizar / Recusar                             │
   ├─ atalho Borderô → WebSystems → volta com {situacao, resposta}     │
   ├─ Autorizar → authorize/{id} → TabItemFeedbackAceito ──┐           │
   ├─ Recusar   → reject/{id}    → TabItemFeedbackRecusado ┤           │
   └─ Voltar → release/{id} (devolve para a fila) ─────────┴───────────┴──▶ TabItemNotificacoes
                                                            (Sleep 2s e recarrega)
```

Voltar em `TabItemNotificacoes` fecha o form. O botão físico do Android (`vkHardwareBack`) é interceptado em
todas as telas e delega para `TrataVoltar`, exceto com o teclado virtual aberto.

### 6.4 Borderô nativo e Pedidos de Compra (telas desativadas)

```
TFrmBordero:  TabItemMS → (clique) TabItemDetalhe → swipe/aprovar todos → Finalizar → volta a TabItemMS
              (1 título) → modal simplificado direto na TabItemMS

TFrmPedidosCompra (iTipoForm=1): TabItemListagemMS → TabItemDetalhePedido → TabItemProdutos
                                                   ↘ TabItemObservacoes
                                  modais: Filtros · Observações (confirmação de decisão)
TFrmPedidosCompra (iTipoForm=2): TabItemRequisicao → modal de decisão
```

---

## 7. Falhas de UX/design e complexidade desnecessária

Ordenado por gravidade. Cada item traz o arquivo e o ponto exato.

### 7.1 Críticos — risco de decisão errada ou de dado

**1. A "Sugestão IA" da tela de análise é falsa.**
`uFrmLiberacoes.LayoutCabecalhoIAClick` faz `Sleep(3000)`, esconde o skeleton e mostra `lblResultadoIA` —
que tem o texto **fixo no `.fmx`**: *"…o cliente foi classificado na categoria 'Bom Pagador'."*
Nenhuma chamada de API, nenhum dado do cliente. Todo cliente é "Bom Pagador", inclusive um inadimplente.
Isso está posicionado exatamente ao lado dos botões Autorizar/Recusar de crédito. **Remover ou implementar de verdade.**

**2. A "reserva" de liberação não impede acesso concorrente.**
`RemoteAuthorization.DAO.ReserveAuthorization` deixa passar a situação `'1'` (comentário literal:
`1: ; //continua... (sendo visualizada)`) e sobrescreve `USUARIO_CODIGO_LIBERADOR`. Dois autorizadores podem abrir
a mesma solicitação ao mesmo tempo; o segundo "rouba" a reserva e o `release` do primeiro deixa de funcionar
(só devolve se o liberador for ele). O app **acredita** que há trava e exibe a mensagem
"está sendo visualizado por outro usuário" — que, na prática, nunca aparece (item 3).

**3. Mensagem de erro de concorrência é código morto.**
`ThreadSeparaLiberacaoUsuarioAtualTerminate` compara `sMotivo = 'Erro ao requisitar servidor 400'`, mas o
controller **sempre** devolve `{"erro": "..."}` no 400, e `ExtractServerErrorMessage` retorna essa mensagem.
Resultado: o ramo nunca executa, e "liberação já aprovada" / "acima da sua alçada" caem no ramo genérico.
A comparação deveria ser por **status code**, não por texto de mensagem.

**4. Liberação pode ficar travada indefinidamente.**
`LIBERACAO_LIBERADA = '1'` só volta para `'0'` se o usuário tocar em Voltar. App morto, bateria acabando ou
crash deixam a solicitação marcada como "em análise". Não há TTL nem job de limpeza no servidor.
(Atenuado pelo item 2, que permite outro usuário sobrescrever — mas por acidente, não por design.)

**5. Decisão de negócio disparada no evento de repintura.**
`uFrmBordero.RectSwipePositivoPaint` / `RectSwipeNegativoPaint` aplicam a decisão (aprovar/reprovar título) dentro
do `OnPaint` do retângulo, numa thread com `Sleep(400)`. Qualquer repaint do controle (rotação, scroll, resize)
pode marcar um título. Decisão deve vir de gesto/clique, nunca de pintura.

**6. Parse da mensagem do ERP quebra em iOS/macOS.**
`uFrmLiberacoes.ListaLiberacoesPendentes` extrai motivo/detalhe por índice com `{$IFDEF MSWINDOWS}` (índices 2 e 4)
e `{$IFDEF ANDROID}` (índices 1 e 2) — **não há ramo para iOS nem macOS**. Como `sMotivo`/`sDetalhe` são variáveis
locais do procedimento, em iOS as duas linhas do card saem vazias (ou repetem o valor da iteração anterior).
Já que iOS e macOS acabaram de ser habilitados (commit `2e89f12b`), isso é um bug ativo.
Além disso, o índice fixo estoura `ERangeError` se a mensagem tiver menos linhas do que o esperado.

**7. Chave de negócio extraída de texto de interface.**
`IdentificaBordero` faz `Pos('Bordero', lblDetalhesMensagem.Text)` e pega a **última palavra** do label como
sequência do borderô. Qualquer mudança de redação da mensagem no ERP quebra o atalho silenciosamente.
A sequência já vem no payload (`BORDERO_SEQUENCIA`) — basta usá-la.

**8. Retorno de sucesso interpretado como erro.**
`ProcessaAutorizacaoRetorno` / `ProcessaReprovacaoRetorno`: `if sDados <> '{}' then` → erro.
Qualquer variação de formatação do servidor (espaço, quebra de linha, envelope) transforma sucesso em erro.
E, quando erra, mostra **dois** diálogos empilhados (`Diag.Show` + `ShowMessage` nativo).

**9. Credenciais e segredos expostos.**
- `USER_PASSWORD` gravado **em texto claro** no SQLite (`DEVICE_INFO`) e recarregado em `EdtSenha.Text` no splash.
- Senha enviada em **MD5 sem salt** no login.
- `TokenTeorema` (JWT do servidor central) **hardcoded** em `uInternalConsts.pas` — igual em todas as instalações.
- JWT do usuário passado no **fragmento da URL** do WebView (fica no histórico e no cache do WebView).

### 7.2 UX

**10. Duas gerações de UI para as mesmas funcionalidades.**
Menu com item nativo e item web para "Pedidos de Compra" e "Requisição de Compra"; os nativos foram apenas
escondidos (`Visible = False`), não removidos. Quem abre o `.fmx` no IDE vê 8 itens, o usuário vê 4.

**11. Tela de notificações mostra dado de teste.**
`uFrmNotificacao.AjustaLayout` monta um JSON literal com *"Aqui vai a mensagem de testes que estou testando com a
quebra de linha do listview"* e o exibe. É o que qualquer usuário vê ao tocar no sino.

**12. Campos "FALTA IMPL..." em produção.**
`ExibeDetalhesCliente` lê a chave inexistente `'naotem'` e mostra o default `'FALTA IMPL...'` em
**Saldo de Crédito** e **Saldo Encontro de Contas**.

**13. Esperas artificiais somam ~10 s antes do primeiro uso.**
Splash `Sleep(3000)` + Concluído `Sleep(5000)` + verificação de notificação `Sleep(1000)`; e, em uso,
`Sleep(2000)` obrigatório na tela de feedback após cada decisão, mais `Sleep(500)` de propósito nos
carregamentos de cliente/histórico "para o skeleton aparecer".

**14. Laço infinito de pedido de permissão.**
`ExigeNotificacaoHabilitada`: negou → modal → solicita de novo → chama a si mesma. Não há como sair a não ser
conceder. E o caso `negadapermanentemente` está **vazio** (todo o tratamento comentado): o usuário nesse estado
nunca é orientado a abrir as configurações.

**15. Busca implementada com um hack de sobreposição.**
O `TSearchBox` nativo da `TListView` é neutralizado (`Opacity := 0` em Liberações/Borderô, `Visible := False` em
Pedidos) e um `TEdit` paralelo espelha o texto a cada tecla. Com `Opacity = 0` o controle continua ocupando
espaço e capturando toque. E são **duas** estratégias diferentes para o mesmo problema no mesmo app.

**16. Passo extra sem valor: o "cadeado".**
Na tela de análise é preciso tocar num cadeado só para revelar Autorizar/Recusar. Não há confirmação depois disso —
o cadeado não protege nada, só adiciona um toque.

**17. Layout com números mágicos.**
`Rectangle6.Height := 200 + ((nLinhas - 6) * 21)`, `Layout16.Height := 200 / 317`, offsets calculados à mão em
`ListViewDadosMSUpdateObjects` (`ListViewDadosMS.Width / 4 / 2 - 15`…). Mensagens com mais de 9 linhas continuam
truncadas, e o cálculo assume um tamanho de fonte/DPI específico.

**18. Estado de negócio dentro do widget.**
`TagString` guarda o JSON inteiro do registro, `Tag` guarda seleção, `TagFloat` guarda a decisão (0/1/2).
Não existe modelo: o mesmo JSON é reparseado (`ParseBodyObject`) em cada operação, e a fonte da verdade da UI é
o próprio controle visual.

### 7.3 Código

**19. Dois padrões concorrentes de chamada assíncrona.**
`uFrmPedidosCompra` usa `TDataFetchHelper.FetchAndProcess` (callback + loading + erro em um lugar);
`uFrmLiberacoes` e `uFrmBordero` repetem, ~15 vezes, o par manual
`TThread.CreateAnonymousThread` + campo `sResultadoXxx` + método `ThreadXxxTerminate` quase idêntico.

**20. Instanciação desnecessária.**
`TLiberacoes` só tem `class function`, mas `uFrmPedidosCompra` faz `TLiberacoes.Create` / `.Free` em **10 lugares**.

**21. Código duplicado por copiar-e-colar.**
- `AutorizaRequisicao` e `ReprovaRequisicao` são idênticas exceto por um par no JSON e o endpoint.
- `uFrmAutCompasWeb`, `uFrmAutCotacaoWeb` e `uFrmReqCompasWeb` são o mesmo form três vezes (~60 linhas cada),
  apesar de `uFrmWebSystems` já existir para exatamente isso.
- A regra de situação final do borderô (`S`/`N`/`P`) está escrita **três vezes**: no app (`RectFinalizarClick`),
  no servidor (`Bordero.DAO.DecisionDT`) e no web system.
- `EnviaAutorizacao`/`EnviaReprovacao` e `ListaProdutos`(I/S) seguem o mesmo padrão.

**22. `.fmx` gigantes com bitmaps embutidos.**
`uFrmLoginBase.fmx` 3,1 MB · `uFrmPedidosCompra.fmx` 787 KB · `uFrmLiberacoes.fmx` 504 KB · `uFrmBordero.fmx` 333 KB.
Imagens em base64 dentro do form, guardadas em abas-depósito (`TabItemIcones`, `TabItemImagens`).
Pior: fundos de item de lista são gerados em runtime com `Rectangle.MakeScreenshot` a cada item renderizado.
Isso torna diff e merge de `.fmx` praticamente impossíveis.

**23. Formulários criados e nunca destruídos.**
O padrão `FrmX := Nil; Application.CreateForm(TFrmX, FrmX); FrmX.ShowModal(...)` repete-se em todos os cliques do
menu. Cada abertura cria um form novo que fica pendurado na `Application`. `ReportMemoryLeaksOnShutdown := True`
está ligado, mas os vazamentos não são reportados porque a `Application` é a dona.
`FormClose` libera apenas o `TFancyDialog`.

**24. `TrataVoltar` sem `Exit` após `Close`.**
Em `uFrmLiberacoes` e `uFrmBordero`, o ramo `if ActiveTab = TabItemNotificacoes then Close;` não sai do método e
os `if`s seguintes continuam sendo avaliados. Hoje é inofensivo, mas é uma armadilha para a próxima alteração.

**25. SQL local frágil.**
`CarregaFiltrosListagemPedidos` seleciona `count(...) as teste` sem `GROUP BY` e desserializa como objeto;
`SalvaFiltrosListagemPedidos` faz `UPDATE ... SET ...` **sem `WHERE`** (funciona só porque a tabela tem 1 linha e
1 coluna). A "tabela" é, na verdade, um par chave-valor que caberia em `TPreferences`/`localStorage`.

**26. Sessão global inchada.**
`TParameters` é um singleton com ~40 propriedades, das quais 15 (`MIDDLEWARE_*`, `PARAMETRO_OS_*`) pertencem a
outros apps da família. Toda unidade lê e escreve nele; não há passagem explícita de dependência.

**27. Detalhes menores.**
- Typo nos nomes de unidade: `uFrmAutCompasWeb` / `uFrmReqCompasWeb` ("Compas" em vez de "Compras"), enquanto a
  classe dentro delas se chama `TFrmAutComprasWeb` / `TFrmReqComprasWeb`.
- Nomes de componentes gerados pelo IDE em massa (`Label57`, `Rectangle30`, `Layout37`) convivendo com nomes
  semânticos — ~250 componentes só em `uFrmLiberacoes`.
- `TabItemAnexos` em `uFrmBordero` está vazia.
- `MemoDebugPush` (memo de depuração de push) faz parte do form base de produção.
- `Permission.pas`, `Permissions.pas` e `u99Permissions.pas` coexistem em `Commun/Units` sem serem usados aqui.

---

## 8. Resumo para o rewrite

O que **precisa** ser preservado, porque é regra de negócio real:

1. Fluxo de identidade em duas camadas (servidor central Teorema → servidor do tenant) com registro de dispositivo,
   licença, expiração de demo e bloqueio de aparelho.
2. Fallback primário → secundário → offline (empresas em cache).
3. Filtro de tipos de solicitação por flags de `TEO_USUARIOS` e o filtro de alçada de desconto (`TEO_USUARIOS_ALCADA` tipo `'2'`).
4. Ciclo de vida da liberação: `0` livre → `1` em análise → `2` aprovada / `3` reprovada, com reserva e devolução.
5. Borderô: decisão título a título, agregação em `S`/`N`/`P`, histórico em `FINANCE_AUTORIZATION`.
6. Compras: modo grupo vs. modo usuário, níveis (`AUTHORIZED_LEVEL`), alçada por transação e alçada mensal.
7. Push notification acordando a tela correta.

O que **não** deve ser levado adiante:

1. A "IA" simulada e os campos `FALTA IMPL...`.
2. As telas nativas de borderô e compras já substituídas por web (decidir de uma vez: nativo ou web, não os dois).
3. O parse posicional/textual de `LIBERACAO_MENSAGEM` — pedir ao servidor os campos estruturados que ele já tem.
4. Estado de negócio em `Tag`/`TagString`/`TagFloat` e o singleton `TParameters`.
5. Esperas artificiais, laço de permissão e o hack do `TSearchBox`.
6. Duplicação da regra de situação final do borderô entre app, servidor e web.
7. Senha em claro no armazenamento local, MD5 sem salt e token no fragmento da URL.

Pontos a resolver **no servidor** antes ou junto do rewrite:

- Reserva real da liberação (rejeitar situação `'1'` de outro usuário) + TTL de expiração da reserva.
- Padronizar respostas de erro (status code + código de erro estável, não texto).
- Decidir o caminho de push do iOS (APNs) versus Android (FCM).
