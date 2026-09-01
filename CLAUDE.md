# Teorema Autorizador — app React Native

Reescrita em React Native do app Delphi/FMX **Teorema Autorizador**.

O código legado **não** faz parte deste repositório: ele vive no monorepo `Source Rio`
(Bitbucket, `teoremadelphi/teorema-source-rio`), em
`Projects/App/Aplicativos Horse/Teorema Autorizador`, junto do código compartilhado em `../Commun`.
Este repo é autocontido e só depende do monorepo para consulta.

O inventário completo do app legado — telas, regras de negócio, endpoints, modelos de dados e
falhas conhecidas — está versionado aqui em
[`docs/analise-app-original.md`](docs/analise-app-original.md).
**Leia a análise antes de migrar qualquer tela**: ela diz o que preservar e o que não repetir.

O app é um **cliente fino**. Nenhuma regra de negócio de verdade roda aqui: alçada, nível de
autorização, reserva e situação de borderô são decididas no Orion Server. O app monta a
requisição, traduz o payload e apresenta.

---

## 1. Stack

| Camada              | Escolha                                                                     | Observação                                                 |
| ------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Runtime             | Expo SDK 57 · React Native 0.86 · React 19.2                                | New Architecture ligada                                    |
| Linguagem           | TypeScript 6 (`strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`) |                                                            |
| Navegação           | Expo Router (file-based)                                                    | `typedRoutes` ligado                                       |
| Estilo              | NativeWind 4 + Tailwind CSS 3                                               | Tailwind **3.x** — o NativeWind 4 não suporta o Tailwind 4 |
| Estado de UI/sessão | Zustand 5 (+ `persist`)                                                     | Só estado do **cliente**                                   |
| Estado de servidor  | TanStack Query 5                                                            | Cache, refetch, invalidação                                |
| HTTP                | Axios 1                                                                     | Duas instâncias: central e tenant                          |
| Formulários         | React Hook Form 7 + Zod 4 (`@hookform/resolvers`)                           | Zod também valida payload de API                           |
| Armazenamento       | `react-native-mmkv` 4 (Nitro)                                               | Síncrono; substitui o SQLite local                         |
| Qualidade           | ESLint 9 (flat) + Prettier 3 + lint-staged + Husky 9                        |                                                            |

### Build nativo obrigatório

`react-native-mmkv` v4 usa Nitro Modules e `react-native-reanimated` 4 usa
`react-native-worklets`: **este app não roda no Expo Go**. Use dev client.

```bash
npm install
cp .env.example .env.local     # preencha EXPO_PUBLIC_CENTRAL_API_TOKEN
npm run prebuild               # gera android/ e ios/
npm run android                # ou: npm run ios
npm start                      # dev server (dev client)
```

Scripts: `lint` · `lint:fix` · `format` · `format:check` · `typecheck` · `doctor` · `prebuild`.

### Hooks de Git

O `npm install` roda `prepare` → `husky`, que ativa os hooks sozinho. Não há passo manual.

| Hook         | Roda                | Por quê                                                          |
| ------------ | ------------------- | ---------------------------------------------------------------- |
| `pre-commit` | `lint-staged`       | ESLint com `--fix` e Prettier **só nos arquivos staged**         |
| `pre-push`   | `npm run typecheck` | Barra `tsc` quebrado antes de subir; rápido demais para virar CI |

Para pular em uma emergência: `git commit --no-verify`. Use com parcimônia — o hook existe
justamente porque o projeto ainda não tem CI.

---

## 2. Estrutura de pastas

```
teorema-autorizador-rn/
├── docs/
│   └── analise-app-original.md # inventário do app Delphi legado (fonte da migração)
│
├── src/
│   ├── app/                    # ROTAS (Expo Router). Só composição — sem regra.
│   │   ├── _layout.tsx         #   providers globais
│   │   ├── index.tsx           #   decide o destino inicial pela sessão
│   │   ├── (auth)/             #   onboarding: documento, configuração, login, empresa
│   │   └── (app)/              #   área autenticada: menu, liberações, web systems
│   │
│   ├── features/               # UMA PASTA POR DOMÍNIO. É aqui que mora a feature.
│   │   └── <feature>/
│   │       ├── api/            #   funções de endpoint + query keys
│   │       ├── schemas/        #   Zod: entrada de formulário e payload da API
│   │       ├── hooks/          #   useQuery / useMutation da feature
│   │       ├── components/     #   componentes só desta feature
│   │       ├── stores/         #   estado de cliente só desta feature (raro)
│   │       └── lib/            #   utilitários só desta feature
│   │
│   ├── shared/                 # REUTILIZÁVEL POR TODAS AS FEATURES
│   │   ├── components/ui/      #   Button, Screen, TextField, QueryState…
│   │   ├── config/             #   env, queryClient
│   │   ├── lib/http/           #   clientes Axios + ApiError
│   │   ├── lib/storage/        #   MMKV + adaptador do Zustand
│   │   ├── lib/format/         #   moeda, data, cn
│   │   ├── stores/             #   sessão (aparelho + usuário + empresa)
│   │   ├── hooks/              #   hooks genéricos
│   │   └── types/              #   tipos compartilhados
│   │
│   └── styles/global.css       # tokens de cor (light/dark) do Tailwind
│
├── app.json · babel.config.js · metro.config.js · tailwind.config.js
├── eslint.config.js · .prettierrc · .lintstagedrc.json · .husky/
├── CLAUDE.md · .env.example
└── package.json
```

### Regras de dependência entre camadas

```
app/  →  features/  →  shared/
      ↘             ↗
```

- `shared/` **nunca** importa de `features/` nem de `app/`.
- Uma feature **não** importa de outra feature. Se duas precisam da mesma coisa, ela sobe para `shared/`.
- `app/` só compõe: importa hooks e componentes, não declara regra nem chama `axios`.
- Import sempre pelo alias `@/` (`@/features/liberacoes/...`), nunca `../../../`. O ESLint bloqueia.

---

## 3. Convenções de nomenclatura

| O quê                | Convenção                                                         | Exemplo                                          |
| -------------------- | ----------------------------------------------------------------- | ------------------------------------------------ |
| Arquivos e pastas    | `kebab-case`                                                      | `liberacao-card.tsx`, `use-decidir-liberacao.ts` |
| Rotas                | `kebab-case`, grupos entre parênteses                             | `src/app/(app)/liberacoes/[id]/cliente.tsx`      |
| Componentes React    | `PascalCase`                                                      | `LiberacaoCard`, `QueryState`                    |
| Hooks                | `useAlgumaCoisa`                                                  | `useLiberacoesPendentes`                         |
| Funções e variáveis  | `camelCase`                                                       | `listarPendentes`, `serverUrlActive`             |
| Tipos e interfaces   | `PascalCase`, **sem** prefixo `I`/`T`                             | `Liberacao`, `Device`                            |
| Constantes de módulo | `SCREAMING_SNAKE_CASE`                                            | `ORIGEM_LABEL`                                   |
| Sufixos de arquivo   | `.api.ts` · `.keys.ts` · `.schema.ts` · `.store.ts` · `.types.ts` | `liberacoes.api.ts`                              |

### Idioma

- **Domínio em português**, porque é a linguagem do ERP: `liberacao`, `bordero`, `alcada`,
  `autorizar`, `reprovar`, `empresa`, `clifor`. Não traduza — o time e o backend falam assim.
- **Infraestrutura em inglês**: `client`, `storage`, `session`, `queryClient`, `env`.
- Comentários e mensagens ao usuário em português.
- **Nome de coluna do Firebird não vaza da camada de schema.** `LIBERACAO_SEQUENCIA` só aparece
  dentro de `schemas/*.schema.ts`; da borda para dentro é `liberacao.id`.

---

## 4. Padrões de código

Cada padrão abaixo tem uma implementação de referência já no repositório. Copie dela.

### 4.1 Serviço de API — `features/<feature>/api/<feature>.api.ts`

Referência: `src/features/liberacoes/api/liberacoes.api.ts`

Uma função por endpoint. Sem React, sem estado, sem `try/catch` que engole erro.
Recebe e devolve tipos de domínio; a tradução do payload fica no schema.

```ts
import { liberacaoListSchema } from '@/features/liberacoes/schemas/liberacao.schema';
import { tenantApi } from '@/shared/lib/http/client';

export async function listarPendentes(userCode: string) {
  const { data } = await tenantApi.get(`/v1/remoteauthorization/searchpending/${userCode}`);
  return liberacaoListSchema.parse(data);
}
```

- `tenantApi` para o servidor do cliente, `centralApi` para o `orion2` (licença/registro/push).
- A `baseURL` do tenant é resolvida a cada requisição a partir da sessão — não fixe.
- Todo erro já chega como `ApiError` (`status`, `message`, `payload`).
  **Decida sempre por `status`, nunca comparando a mensagem** — foi assim que o app Delphi
  criou código morto (`analise §7.1.3`).

### 4.2 Schema de payload — `features/<feature>/schemas/<x>.schema.ts`

Referência: `src/features/liberacoes/schemas/liberacao.schema.ts`

Todo payload do Orion passa por um Zod que **valida e traduz** `SCREAMING_SNAKE` → camelCase.

```ts
export const liberacaoSchema = z
  .object({ LIBERACAO_SEQUENCIA: z.coerce.string(), CLIFOR_NOME: optionalText })
  .transform((raw) => ({ id: raw.LIBERACAO_SEQUENCIA, cliente: { nome: raw.CLIFOR_NOME } }));

export type Liberacao = z.output<typeof liberacaoSchema>;
```

O tipo do domínio é **derivado** do schema (`z.output`), nunca escrito duas vezes.

### 4.3 Query keys — `features/<feature>/api/<feature>.keys.ts`

Hierárquicas, para invalidar por prefixo:

```ts
export const liberacoesKeys = {
  all: ['liberacoes'] as const,
  pendentes: (userCode: string) => [...liberacoesKeys.all, 'pendentes', userCode] as const,
};
```

Nunca escreva um array de key literal dentro de um hook ou de uma tela.

### 4.4 Hook de leitura — `features/<feature>/hooks/use-<coisa>.ts`

Referência: `src/features/liberacoes/hooks/use-liberacoes-pendentes.ts`

```ts
export function useLiberacoesPendentes() {
  const user = useCurrentUser();

  return useQuery({
    queryKey: liberacoesKeys.pendentes(user?.code ?? ''),
    queryFn: () => listarPendentes(user!.code),
    enabled: user !== null,
  });
}
```

O hook liga API + sessão + cache. Devolve o resultado do TanStack Query **sem embrulhar**:
a tela precisa de `isLoading`, `error`, `refetch`, `isRefetching`.

### 4.5 Hook de escrita — `useMutation` + invalidação

Referência: `src/features/liberacoes/hooks/use-decidir-liberacao.ts`

```ts
export function useDecidirLiberacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, decisao, resposta }: DecidirVariables) =>
      decisao === 'autorizar' ? autorizar(id, resposta) : reprovar(id, resposta),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: liberacoesKeys.all }),
  });
}
```

Rotas com a mesma forma compartilham uma mutation — não duplique o bloco por verbo.
**Sucesso é status 2xx.** Não inspecione o corpo procurando `'{}'` (`analise §7.1.8`).

### 4.6 Tela — `src/app/**/*.tsx`

Referências: `src/app/(app)/liberacoes/index.tsx` (lista) e `src/app/(auth)/login.tsx` (formulário).

Uma tela pode: chamar hooks, tratar os estados de query, navegar e renderizar. **Não pode**:
chamar `axios`, guardar dado de servidor em `useState`, nem validar formulário à mão.

```tsx
export default function LiberacoesScreen() {
  const { data, isLoading, error, refetch, isRefetching } = useLiberacoesPendentes();

  const estado = (
    <QueryState
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      isEmpty={data?.length === 0}
      emptyMessage="Nenhuma liberação pendente."
    />
  );
  if (estado) return <Screen>{estado}</Screen>;

  return (
    <Screen>
      <FlatList data={data} keyExtractor={(item) => item.id} /* … */ />
    </Screen>
  );
}
```

Toda tela é embrulhada em `<Screen>` (safe area + fundo do tema) e trata os três estados
com `<QueryState>`.

### 4.7 Formulário — React Hook Form + Zod

Referência: `src/app/(auth)/login.tsx` + `src/features/auth/schemas/login.schema.ts`

```tsx
const { control, handleSubmit } = useForm<LoginInput>({
  resolver: zodResolver(loginSchema),
  defaultValues: { username: '', password: '' },
});

<TextField control={control} name="username" label="Usuário" />;
<Button
  title="Entrar"
  loading={isPending}
  onPress={handleSubmit((v) => entrar(loginSchema.parse(v)))}
/>;
```

A regra de validação mora **só** no schema. `TextField` já exibe a mensagem de erro do resolver;
nenhuma tela monta mensagem de validação à mão.

### 4.8 Estado com Zustand

Referência: `src/shared/stores/session.store.ts`

Zustand guarda **estado do cliente** (sessão, preferência, filtro de UI). Dado que veio do
servidor é do TanStack Query — nunca copie a resposta de uma query para dentro de um store.

- Selecione fatias, não o store inteiro: `useSessionStore((s) => s.user)`.
- Fora de componente (interceptor, serviço), use `getSession()`.
- `persist` + MMKV: use `partialize` para não gravar estado de runtime.
- **Nunca persista senha.**

### 4.9 Estilo com NativeWind

Só `className`, nunca `StyleSheet.create` nem objeto de estilo inline — a única exceção no
projeto é `style={{ flex: 1 }}` no `GestureHandlerRootView`, que exige estilo real.

- Use os **tokens semânticos** do `tailwind.config.js` (`bg-surface`, `text-muted`,
  `text-aprovado`, `bg-primary`), nunca a cor crua (`bg-blue-500`).
- Cor nova entra como variável em `src/styles/global.css`, nos dois temas.
- Classes condicionais via `cn()` de `@/shared/lib/format/cn`.
- Nada de número mágico de layout: o app Delphi calculava altura com
  `200 + ((nLinhas - 6) * 21)` (`analise §7.2.17`). Use flexbox.

---

## 5. Regras de Clean Code

Valem para todo código novo. O ESLint avisa nas quatro primeiras; as demais são de revisão.

1. **Funções pequenas** — até ~60 linhas úteis (`max-lines-per-function`). Componente grande
   vira composição de componentes menores, não um arquivo de 400 linhas.
2. **Poucos parâmetros** — no máximo 3 (`max-params`). Passando disso, use um objeto nomeado.
3. **Complexidade baixa** — no máximo 10 caminhos (`complexity`). `if` aninhado vira early return.
4. **Sem `console.log`** — `console.warn`/`console.error` liberados.
5. **Responsabilidade única** — cada arquivo faz uma coisa: API busca, schema traduz, hook
   orquestra, componente apresenta. Se você precisa de "e" para descrever o arquivo, separe.
6. **Nomes descritivos e do domínio** — `liberacoesPendentes`, não `data2`/`lista`/`temp`.
   Booleano começa com `is`/`has`/`can`. Nada de `Label57`, `Rectangle30` (`analise §7.3.27`).
7. **Não duplique** — a terceira repetição vira função. No app Delphi a regra de situação do
   borderô estava escrita em três lugares e `AutorizaRequisicao`/`ReprovaRequisicao` eram o
   mesmo código (`analise §7.3.21`).
8. **Um jeito só de fazer cada coisa** — o app original tinha dois padrões de chamada
   assíncrona e duas estratégias de busca convivendo (`analise §7.3.19`, `§7.2.15`).
   Se você precisa de um padrão novo, troque o antigo e atualize este documento.
9. **Sem estado de negócio dentro do widget** — nada de guardar JSON ou decisão no componente.
   A fonte da verdade é o store ou o cache da query (`analise §7.2.18`).
10. **Sem espera artificial** — nunca `setTimeout` para "dar tempo do skeleton aparecer".
    O app original gastava ~10 s em `Sleep` antes do primeiro uso (`analise §7.2.13`).
11. **Erro é tipado** — `ApiError` com `status`. Nunca decida por texto de mensagem.
12. **Tipos derivados, não repetidos** — `z.output<typeof schema>`. Nada de `any`; para entrada
    desconhecida use `unknown` e valide.
13. **Comentário explica o porquê**, não o quê. Ao migrar uma regra do Delphi, cite a origem
    (`docs/analise §X`) para quem vier depois entender a decisão.

---

## 6. Índice de telas a migrar

Legenda: ⬜ pendente · 🟨 em andamento · ✅ concluído

### Onboarding e sessão

| #   | Tela                           | Rota                  | Origem no app Delphi                              | Status                                                   |
| --- | ------------------------------ | --------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| 1   | Splash / roteamento inicial    | `src/app/index.tsx`   | `TFrmLoginBase` (aba Splash)                      | ✅                                                       |
| 2   | Documento da empresa           | `(auth)/documento`    | `TFrmLoginBase` (aba Documento)                   | ⬜                                                       |
| 3   | Configuração de servidor       | `(auth)/configuracao` | `TFrmLoginBase` (abas Configuração/Bancos)        | ⬜                                                       |
| 4   | Login                          | `(auth)/login`        | `TFrmLoginBase` (aba Login)                       | 🟨 UI e formulário prontos; falta o hash da senha (§7.1) |
| 5   | Registro do aparelho e licença | `(auth)/configuracao` | `TFrmLoginBase` (abas Identificação/Licença/Erro) | ⬜                                                       |
| 6   | Escolha de empresa             | `(auth)/empresa`      | `TFrmLoginBase` (aba Escolha de empresa)          | ⬜                                                       |
| 7   | Histórico de usuários          | —                     | `TFrmHistoricoUsuarios`                           | ⬜                                                       |

### Área autenticada

| #   | Tela                                          | Rota                            | Origem no app Delphi                        | Status                                                      |
| --- | --------------------------------------------- | ------------------------------- | ------------------------------------------- | ----------------------------------------------------------- |
| 8   | Menu principal                                | `(app)/menu`                    | `TFrmPrincipal` + `TFrmPrincipalBase`       | 🟨 itens e navegação prontos; falta cabeçalho, logo e badge |
| 9   | Fila de liberações                            | `(app)/liberacoes`              | `TFrmLiberacoes` › `TabItemNotificacoes`    | 🟨 lista funcional; falta busca e ícone por tipo            |
| 10  | Análise da liberação                          | `(app)/liberacoes/[id]`         | `TFrmLiberacoes` › `TabItemDetalhes`        | ⬜                                                          |
| 11  | Dados do cliente                              | `(app)/liberacoes/[id]/cliente` | `TFrmLiberacoes` › `TabItemDetalhesCliente` | ⬜                                                          |
| 12  | Feedback da decisão                           | (parte de #10)                  | `TabItemFeedbackAceito` / `Recusado`        | ⬜                                                          |
| 13  | Notificações                                  | `(app)/notificacoes`            | `TFrmNotificacao`                           | ⬜                                                          |
| 14  | Web system — Pedidos de Compra                | `(app)/web/autcompras`          | `TFrmAutComprasWeb`                         | ⬜                                                          |
| 15  | Web system — Autorização de Cotação           | `(app)/web/autcotacao`          | `TFrmAutCotacaoWeb`                         | ⬜                                                          |
| 16  | Web system — Requisição de Compra             | `(app)/web/reqcompras`          | `TFrmReqComprasWeb`                         | ⬜                                                          |
| 17  | Web system — Autorizador Financeiro / Borderô | `(app)/web/autorizador`         | `TFrmWebSystems`                            | ⬜                                                          |

### Fora de escopo (decisão pendente — ver §7.2)

| Tela                                           | Origem                            | Situação                                                         |
| ---------------------------------------------- | --------------------------------- | ---------------------------------------------------------------- |
| Borderô nativo                                 | `TFrmBordero`                     | Já estava `Visible = False` no menu; substituída pelo web system |
| Pedidos de compra nativo                       | `TFrmPedidosCompra` `iTipoForm=1` | Já estava `Visible = False`; substituída pelo web system         |
| Requisição de compra nativa                    | `TFrmPedidosCompra` `iTipoForm=2` | Já estava `Visible = False`; substituída pelo web system         |
| Gravador de vídeo / leitor de código de barras | `uFrmGravadorVideo`, `UnitLeitor` | Inertes neste app                                                |

### Infraestrutura transversal

| Item                                                             | Status                             |
| ---------------------------------------------------------------- | ---------------------------------- |
| Clientes HTTP (central + tenant) com `ApiError`                  | ✅                                 |
| Sessão persistida em MMKV (aparelho, usuário, empresa)           | ✅                                 |
| Query client com política de retry por status                    | ✅                                 |
| Componentes base (`Screen`, `Button`, `TextField`, `QueryState`) | ✅                                 |
| Tokens de tema light/dark                                        | ✅                                 |
| Fallback primário → secundário → offline                         | ⬜                                 |
| Push notification (FCM / APNs) e roteamento por notificação      | ⬜                                 |
| Cache offline de empresas                                        | ⬜                                 |
| Testes automatizados                                             | ⬜ (o app original não tem nenhum) |

---

## 7. Decisões em aberto

Precisam de resposta do time antes de fechar as telas correspondentes.

1. **Hash da senha no login.** O Orion espera MD5 puro, sem salt. `preparePassword()` em
   `src/features/auth/lib/password.ts` está **sem implementação, lançando erro de propósito** —
   migrar o app reproduzindo o MD5 só carregaria a falha adiante. Decidir entre trocar o
   contrato no servidor (recomendado) ou manter MD5 no curto prazo. **O login não funciona até
   isso ser resolvido.**
2. **Nativo ou web para compras e borderô.** Hoje há duas gerações de UI para a mesma coisa.
   O índice acima assume **web**; se a decisão for nativo, as telas 14–17 mudam de natureza.
3. **`react-native-webview`** ainda não foi instalado — é a próxima dependência, necessária
   para as telas 14–17.
4. **Sessão na WebView.** O app original passa o JWT no fragmento da URL, onde ele fica no
   histórico e no cache. Definir o novo mecanismo antes de implementar as telas web.
5. **Reserva da liberação.** O servidor aceita reservar algo que já está `'1'` com outro
   usuário, e não há TTL: a trava é fictícia (`analise §7.1.2`, `§7.1.4`). O app não corrige
   isso sozinho.
6. **Padronização de erro no servidor.** Precisamos de código de erro estável, não texto.
7. **Push: FCM no Android e APNs no iOS.** O servidor precisa tratar os dois caminhos.
8. **`br.inf.teorema.autorizador4`** foi mantido como identificador em Android e iOS, para o
   app novo substituir o antigo na loja. Enquanto os dois coexistirem em desenvolvimento, use
   um identificador de variante para não sobrescrever a instalação legada.

---

## 8. O que não migrar

Confirmado na análise, não reproduza:

- A **"Sugestão IA"** da tela de análise: texto fixo no `.fmx`, todo cliente é "Bom Pagador",
  ao lado dos botões de decisão de crédito (`analise §7.1.1`).
- Os campos **`FALTA IMPL...`** em Saldo de Crédito e Saldo Encontro de Contas (`§7.2.12`).
- O **JSON de teste** da tela de notificações (`§7.2.11`).
- O **parse posicional** de `LIBERACAO_MENSAGEM` e a extração da sequência do borderô a partir
  do texto do label (`§7.1.6`, `§7.1.7`) — os campos estruturados já vêm no payload.
- O **cadeado** antes dos botões Autorizar/Recusar: um toque a mais que não protege nada (`§7.2.16`).
- As **esperas artificiais** e o **laço infinito de pedido de permissão** (`§7.2.13`, `§7.2.14`).
- **Senha em texto claro** no armazenamento local (`§7.1.9`).
