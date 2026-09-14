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
Esse arquivo é **cópia fiel** da análise do monorepo e está no `.prettierignore` para se manter
byte a byte idêntico: **não edite nem reformate** — correção vai no monorepo e desce por cópia.

A ordem de ataque — blocos, fases e o que corrigir em cada tela — está em
[`docs/plano-migracao.md`](docs/plano-migracao.md). O **status** de cada tela continua sendo o
índice da §6 deste documento; o plano é o roteiro, não o placar.

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

Scripts: `lint` · `lint:fix` · `format` · `format:check` · `typecheck` · `test` · `test:watch` ·
`doctor` · `prebuild`.

### Testes

O runner é o **`node --test` embutido no Node** — nenhum Jest, nenhum Vitest, nenhum bundler de
teste. A infraestrutura já existia: `tools/ts-alias-hook.mjs` resolve o alias `@/` e lê os `.ts` de
`src/` direto, e é o mesmo hook que o `probe-orion` usa. Instalar um segundo jeito de rodar código
do app fora do bundle contrariaria o §5.8.

```bash
npm test          # todos os *.test.ts de src/
npm run test:watch
# um recorte — os dois `--import` são obrigatórios
node --import ./tools/ts-alias-hook.mjs --import ./tools/test-setup.mjs \
  --test "src/features/auth/**/*.test.ts"
```

- **Exige Node ≥ 22.18** (o `engines` do `package.json`): o runner depende do type-stripping
  nativo, e o hook, de `module.registerHooks`. O piso é o que a documentação do Node diz,
  **não verificado**: a suíte só rodou em 24.x até aqui. É por isso que `ApiError` não usa
  _parameter properties_ — o strip-only recusa a sintaxe, e o comentário no arquivo diz para não
  encolher de volta.
- **Os tipos do Node ficam fora do app.** `tsconfig.json` exclui `**/*.test.ts` e
  `src/shared/lib/testing/**`; o `tsconfig.test.json` é quem tem `types: ["node"]`, e por isso
  `npm run typecheck` roda os dois. Sem essa separação, `Buffer.from(...)` numa tela passaria no
  `tsc` e quebraria no aparelho.
- Teste novo mora **ao lado** do que ele testa (`liberacao.schema.ts` → `liberacao.schema.test.ts`),
  nunca numa pasta `__tests__`.

#### Testar hook

`tools/test-setup.mjs` é o que torna hook testável fora do aparelho, e faz três coisas: preenche as
`EXPO_PUBLIC_*` com valores falsos (o `env.ts` faz `throw` no import sem elas), redireciona
`react-native-mmkv`, `expo-router` e `react-native` para os stubs de `src/shared/lib/testing/stubs/`
— é o `moduleNameMapper` do Jest à mão — e registra um DOM (happy-dom).

O harness fica em **`src/shared/lib/testing/`**, e o ESLint barra importá-lo de fora de um
`*.test.ts` — pelo alias **e** pelos relativos curtos, porque quem mora em `shared/lib/` alcançaria
o harness com `./testing/…`. Ele monta hook, troca adapter de axios e stuba módulo nativo: nada
disso pode entrar no bundle.

```ts
afterEach(encerrarTeste); // obrigatório — desmonta, desinstala o servidor, zera a sessão

comUsuarioLogado();
const servidor = instalarTenantFalso(SEMPRE_OK);
const { result } = renderizarHook(() => useDecidirLiberacao());
```

- **O servidor falso é troca de `adapter` do axios**, não mock do módulo de API: a requisição
  percorre a função de `api/`, o interceptor e o `toApiError`, então o que chega ao hook é um
  `ApiError` de verdade. Mockar `liberacoes.api` testaria o mock.
- **Nunca restaure o adapter no próprio caso.** Quem restaura é o `encerrarTeste()`, _depois_ de
  desmontar: restaurar antes faz a devolução do `useReservaLiberacao` sair pelo axios real, e a
  resolução de DNS segura o processo do runner de pé.
- **Renderiza com `react-dom`, não com o renderer do React Native.** Vale porque hook de escrita não
  monta componente. **Tela não se testa por aqui** — no dia em que for preciso, o caminho é
  jest-expo e é ficha própria.
- `respostaSegurada()` segura uma resposta no ar para provar quem espera por ela (é assim que se
  testa o §7.1.4). Soltar é obrigatório: requisição pendente vaza para o caso seguinte.

**O portão de qualquer alteração são estes três**, rodados antes de commitar:

```bash
npm run typecheck && npm run lint && npm test
```

O `pre-commit` cobre menos do que isso (o `lint-staged` só olha os arquivos staged); o `pre-push`
roda `typecheck` + `test`, mas não o `lint` — rode os três à mão sobre o projeto inteiro.

### Probe de contrato contra um Orion real

`tools/probe-orion.mjs` é o mais perto que o projeto tem de um teste de integração, e o único
jeito de derrubar a ressalva da §6 ("nenhum ✅ confirmado com dado real"). Ele **replica o
fluxo HTTP do app importando os schemas de `src/`** — não uma cópia deles — então um desvio de
contrato do Orion estoura no mesmo Zod em que estouraria na tela:

```bash
node --import ./tools/ts-alias-hook.mjs tools/probe-orion.mjs \
  --documento=00000000000000 --usuario=FULANO --senha=... [--reservar]
```

- Lê a `.env.local` para o token do central; percorre Bloco A (licença → endereços → ping →
  bases → login → empresas) e Bloco C (fila → cliente), e grava os payloads brutos em
  `.probe-orion/` — pasta **gitignorada**, porque é dado real de cliente.
- **Somente leitura por padrão.** `--reservar` exercita `reserve`/`release`; autorizar e
  reprovar ele **nunca** dispara — decisão é dinheiro e não se testa por engano.
- Sai com código 1 se algum schema recusar payload. Não cobre renderização: bug de árvore
  React (como o `queryState` sempre-verdadeiro da §4.6) só aparece com o app no aparelho.
- O `--import ./tools/ts-alias-hook.mjs` é obrigatório: é ele que resolve o alias `@/` e deixa
  o Node ler os `.ts` do app.

### Pré-requisitos de runtime

Duas coisas derrubam o app antes de qualquer tela aparecer. Não são bugs — são a ordem do plano.

1. **Sem `.env.local` completo o app não sobe.** `src/shared/config/env.ts` valida as quatro
   variáveis com Zod já no import e faz `throw` se faltar alguma — o erro aparece no boot, não
   na tela. O Metro só substitui `process.env.EXPO_PUBLIC_X` em acesso literal, e é por isso
   que o objeto do `env.ts` é montado à mão, sem loop nem índice dinâmico.
2. **Nenhuma chamada ao tenant funciona enquanto o aparelho não tiver servidor resolvido.** O
   interceptor de request do `tenantApi` lança
   `ApiError(0, 'Servidor do cliente ainda não foi resolvido.')` quando `device.serverUrlActive`
   é `null` **e** a requisição não traz `baseURL` própria — a exceção é o teste de conexão do
   onboarding, que é justamente quem descobre o endereço. O onboarding (telas 2 → 3/5) resolve
   isso pelo app: documento, ping no primário/secundário e escolha da base. Para exercitar uma
   tela isolada sem passar pelo onboarding, popule a sessão à mão:
   `useSessionStore.getState().setDevice({ … })`.

Com a `baseURL` resolvida, o mesmo interceptor injeta `Authorization: Bearer <jwt>` (quando há
usuário logado) e o header `tokendatabase` do aparelho. O `centralApi` não depende de nada
disso: nasce com `baseURL` e token fixos, vindos do `.env`.

### Hooks de Git

O `npm install` roda `prepare` → `husky`, que ativa os hooks sozinho. Não há passo manual.

| Hook         | Roda                 | Por quê                                                                           |
| ------------ | -------------------- | --------------------------------------------------------------------------------- |
| `pre-commit` | `lint-staged`        | ESLint com `--fix` e Prettier **só nos arquivos staged**                          |
| `pre-push`   | `typecheck` + `test` | Barra `tsc` quebrado e teste vermelho antes de subir; rápido demais para virar CI |

Para pular em uma emergência: `git commit --no-verify`. Use com parcimônia — o hook existe
justamente porque o projeto ainda não tem CI.

---

## 2. Estrutura de pastas

```
teorema-autorizador-rn/
├── docs/
│   ├── analise-app-original.md # inventário do legado — NÃO reformatar (.prettierignore)
│   ├── plano-migracao.md       # blocos A–F, ordem de ataque, critério de pronto
│   ├── decisao-hash-senha.md   # bloqueio B1: senha em texto puro sobre TLS
│   ├── decisao-webview-sessao.md # decidido: handshake postMessage; contrato em §13
│   └── decisao-push.md         # bloqueio B7: quem entrega o push (FCM/APNs)
│
├── tools/                      # scripts de fora do bundle (Node puro, não entram no app)
│   ├── probe-orion.mjs         #   replay HTTP do fluxo contra um Orion real (§1)
│   ├── ts-alias-hook.mjs       #   resolve `@/` e lê os .ts de src/ no Node
│   └── test-setup.mjs          #   env falsa, stubs de módulo nativo e DOM (§1)
│
├── src/
│   ├── app/                    # ROTAS (Expo Router). Só composição — sem regra.
│   │   ├── _layout.tsx         #   providers globais
│   │   ├── index.tsx           #   decide o destino inicial pela sessão
│   │   ├── +not-found.tsx      #   rota desconhecida
│   │   ├── (auth)/             #   onboarding: documento, configuração, login, empresa
│   │   └── (app)/              #   área autenticada: menu, liberações, notificações
│   │       └── web/[sistema]   #   contêiner ÚNICO dos web systems (uma rota, não quatro)
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
│   │   ├── components/ui/      #   Screen, Button, TextField, QueryState,
│   │   │                       #   AppHeader, OfflineBanner, SearchField
│   │   ├── config/             #   env, queryClient
│   │   ├── lib/http/           #   clientes Axios + ApiError
│   │   ├── lib/storage/        #   MMKV + adaptador do Zustand
│   │   ├── lib/format/         #   moeda, data, cn
│   │   ├── lib/schema/         #   peças de Zod dos payloads do Orion
│   │   ├── lib/image/          #   blob → data URI (logo da empresa)
│   │   ├── lib/testing/        #   harness de teste + stubs — NÃO importar do app
│   │   ├── stores/             #   sessão (aparelho + usuário + empresa)
│   │   ├── hooks/              #   hooks genéricos (pasta vazia hoje — é o destino deles)
│   │   └── types/              #   tipos compartilhados
│   │
│   └── styles/global.css       # tokens de cor (light/dark) do Tailwind
│
├── app.json · babel.config.js · metro.config.js · tailwind.config.js
├── eslint.config.js · .prettierrc · .lintstagedrc.json · .husky/ · tsconfig.test.json
├── CLAUDE.md · .env.example
└── package.json
```

Features hoje: `auth` · `empresa` · `liberacoes` · `notificacoes` (só as query keys e o badge
do cabeçalho — a lista é do Bloco E) · `push` · `web-systems`. Cada uma cria só as subpastas de
que precisa.

### Regras de dependência entre camadas

```
app/  →  features/  →  shared/
      ↘             ↗
```

- `shared/` **nunca** importa de `features/` nem de `app/`.
- Uma feature **não** importa de outra feature. Se duas precisam da mesma coisa, ela sobe para `shared/`.
- `app/` só compõe: importa hooks e componentes, não declara regra nem chama `axios`.
- Import sempre pelo alias `@/` (`@/features/liberacoes/...`), nunca `../../../`. O
  `no-restricted-imports` do ESLint barra exatamente `../../../*` e `../../features/*` — o resto
  (`../../shared/foo`, por exemplo) passa pelo linter, mas continua proibido por convenção.

---

## 3. Convenções de nomenclatura

| O quê                | Convenção                                                                      | Exemplo                                          |
| -------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------ |
| Arquivos e pastas    | `kebab-case`                                                                   | `liberacao-card.tsx`, `use-decidir-liberacao.ts` |
| Rotas                | `kebab-case`, grupos entre parênteses                                          | `src/app/(app)/liberacoes/[id]/cliente.tsx`      |
| Componentes React    | `PascalCase`                                                                   | `LiberacaoCard`, `QueryState`                    |
| Hooks                | `useAlgumaCoisa`                                                               | `useLiberacoesPendentes`                         |
| Funções e variáveis  | `camelCase`                                                                    | `listarPendentes`, `serverUrlActive`             |
| Tipos e interfaces   | `PascalCase`, **sem** prefixo `I`/`T`                                          | `Liberacao`, `Device`                            |
| Constantes de módulo | `SCREAMING_SNAKE_CASE`                                                         | `ORIGEM_LABEL`                                   |
| Sufixos de arquivo   | `.api.ts` · `.keys.ts` · `.schema.ts` · `.store.ts` · `.types.ts` · `.test.ts` | `liberacoes.api.ts`, `liberacao.schema.test.ts`  |

### TypeScript

Três padrões estão em todo arquivo do `src/` e vêm das flags do `tsconfig.json`:

- **`import type` em bloco próprio, no fim dos imports.** `verbatimModuleSyntax` exige a forma
  explícita, e a ordem do projeto é: pacotes externos → `@/…` → `import type`. Referência:
  `src/app/(app)/liberacoes/index.tsx`, `src/shared/components/ui/screen.tsx`.
- **Enum é const-objeto + type do mesmo nome**, nunca `enum` do TypeScript:

  ```ts
  export const DeviceStatus = { NaoRegistrado: 0, Ativo: 1, Bloqueado: 2 } as const;
  export type DeviceStatus = (typeof DeviceStatus)[keyof typeof DeviceStatus];
  ```

  Referências: `src/shared/types/session.types.ts`, `SituacaoLiberacao` em
  `liberacao.schema.ts`. É por causa desse padrão que `@typescript-eslint/no-redeclare` está
  desligado no `eslint.config.js` — não reative.

- **`noUncheckedIndexedAccess` ligado:** acesso por índice devolve `T | undefined`. Todo lookup
  em `Record` precisa de fallback — `ORIGEM_LABEL[origem] ?? ''`, nunca `!`.

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

**O prefixo do path não decide o cliente.** `/v1/application/*` existe nos **dois** servidores
com rotas diferentes: quem decide é de quem é o dado — licença e aparelho são do central,
qualquer coisa que dependa da base do cliente é do tenant. Superfície em uso hoje:

| Cliente      | Rotas                                                                                                                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `centralApi` | `/v1/application/companyinformation` · `/v1/application/getserverurl` · `/v1/application/register` · `/v1/application/tokenpush`                                                                                        |
| `tenantApi`  | `/v1/ping` · `/v1/auth/login` · `/v1/auth/setup/:documento` · `/v1/application/companyfromuser/:userCode` · `/v1/application/photocompany/:companyCode` · `/v1/remoteauthorization/*` (fila, reserva, decisão, cliente) |

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

Helper de Zod usado por uma feature só fica local ao arquivo de schema. Ao aparecer o
**terceiro** uso, ele sobe para `src/shared/lib/schema/` — não vire uma quarta cópia. Foi o
caminho do `optionalText`: nasceu duplicado em `auth.schema.ts` e `liberacao.schema.ts` e o
terceiro uso (`cliente.schema.ts`) o levou para `shared/lib/schema/orion.ts`.

### 4.3 Query keys — `features/<feature>/api/<feature>.keys.ts`

Hierárquicas, para invalidar por prefixo:

```ts
/** Raiz da feature. Fora deste arquivo ninguém monta array de key à mão. */
const RAIZ = ['liberacoes'] as const;

export const liberacoesKeys = {
  all: RAIZ,
  fila: [...RAIZ, 'pendentes'] as const,
  pendentes: (userCode: string) => [...liberacoesKeys.fila, userCode] as const,
  credito: (empresa: string, cliente: string) =>
    [...liberacoesKeys.all, 'credito', empresa, cliente] as const,
};
```

Nunca escreva um array de key literal dentro de um hook ou de uma tela.

**Crie o prefixo intermediário antes de precisar dele.** `all` cobre _todas_ as sub-keys:
invalidar por ele depois de uma decisão refaz também a análise de crédito e o histórico de
compras de todo cliente em cache. `fila` existe para que quem só quer atualizar a lista — o
roteamento de push — invalide estreito (§9, dívida D5).

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

Duas variantes já existem no repo e valem como referência:

- **Hook com ciclo de vida** (`use-reserva-liberacao.ts`): dispara ao montar e desfaz no
  unmount. Guarde a promessa da ida e **espere-a resolver antes de desfazer** — sair antes da
  resposta chegar deixaria a liberação presa (`analise §7.1.4`). Enquanto o efeito não roda o
  status é `idle`, e `idle` também trava a ação: decidir aí seria decidir sem reservar.
- **Query que só observa o cache** (`use-notificacoes-nao-lidas.ts`): `queryFn: skipToken`
  desliga o fetch enquanto o endpoint não existe no servidor. É assim que se deixa um número
  pendente — cache vazio, nunca um zero decorativo nem dado inventado (`analise §7.2.11`).

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

  const estado = queryState({
    isLoading,
    error,
    onRetry: refetch,
    isEmpty: data?.length === 0,
    emptyMessage: 'Nenhuma liberação pendente.',
  });
  if (estado) return <Screen>{estado}</Screen>;

  return (
    <Screen>
      <FlatList data={data} keyExtractor={(item) => item.id} /* … */ />
    </Screen>
  );
}
```

Toda tela é embrulhada em `<Screen>` (safe area + fundo do tema) e trata os três estados
pelo módulo `shared/components/ui/query-state`, que exporta **duas formas da mesma coisa**:

- **`queryState(props)`** — função, devolve `ReactElement | null`. É a que a tela usa para
  decidir se sai antes. Chamar em JSX (`const estado = <QueryState … />`) **não funciona**:
  o resultado é um elemento React, ou seja um objeto sempre truthy, e o `if (estado)` passa a
  valer sempre — a tela devolve um `<Screen>` vazio, sem erro nem log. Foi o que aconteceu em
  seis telas antes da revisão do Bloco C.
- **`<QueryState>`** — o componente, para quando o estado é _filho_ de outro elemento e não
  porta de saída: `ListEmptyComponent` de uma `FlatList`, por exemplo.

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
- O `merge` padrão do `persist` é **raso**: quando o estado tem objeto aninhado, passe um `merge`
  que complete com o valor vazio (`session.store.ts`) ou revalide o disco por schema
  (`historico-usuarios.store.ts`). Disco é entrada não confiável, igual à rede.
- **Nunca persista senha.**
- **Nem todo store vai para o disco, e isso é decisão — deixe o porquê escrito no arquivo.**
  Não persista o que o sistema operacional já é dono (`estado-push.store.ts`: a permissão de
  notificação muda fora do app, e restaurar do disco seria repetir uma resposta velha como se
  fosse a atual) nem payload de consumo único (`bordero-abertura` / `bordero-retorno`, §4.11).

Tudo mora numa instância única de MMKV (`shared/lib/storage/mmkv.ts`). Chave de `persist` é o
nome do store em kebab-case; chave escrita à mão é `dominio:identificador`. O inventário
completo — é ele que responde "por que esse dado sobreviveu ao logout":

| Chave                 | Quem escreve                                       | Conteúdo                                     |
| --------------------- | -------------------------------------------------- | -------------------------------------------- |
| `session`             | `shared/stores/session.store.ts`                   | aparelho, usuário, empresa (sem `online`)    |
| `historico-usuarios`  | `features/auth/stores/historico-usuarios.store.ts` | até 5 logins + data do último acesso         |
| `empresas:<userCode>` | `features/empresa/lib/empresas-cache.ts`           | lista de empresas do usuário (cache offline) |

### 4.9 Estilo com NativeWind

Só `className`, nunca `StyleSheet.create` nem objeto de estilo inline. As duas exceções do
projeto são `style={{ flex: 1 }}` no `GestureHandlerRootView` e na `WebView` de
`web-system-view.tsx`: componente de terceiro não passa pelo NativeWind e exige estilo real.

- Use os **tokens semânticos** do `tailwind.config.js` (`bg-surface`, `text-muted`,
  `text-aprovado`, `bg-primary`), nunca a cor crua (`bg-blue-500`).
- Cor nova entra como variável em `src/styles/global.css`, nos dois temas.
- Classes condicionais via `cn()` de `@/shared/lib/format/cn`.
- Nada de número mágico de layout: o app Delphi calculava altura com
  `200 + ((nLinhas - 6) * 21)` (`analise §7.2.17`). Use flexbox.

### 4.10 Cache offline — MMKV como `initialData` da query

Referência: `src/features/empresa/lib/empresas-cache.ts` + `use-empresas-do-usuario.ts`

É a **única** exceção ao "nunca copie a resposta de uma query" da §4.8, e existe por um motivo
só: quando nem o primário nem o secundário respondem, a tela precisa mostrar a última lista
conhecida (`analise §3.1`).

- A cópia em disco alimenta o `initialData` da query. A fonte da verdade em memória continua
  sendo o cache do TanStack Query — o dado **não** vira estado de um store.
- A releitura passa por Zod antes de virar `initialData`, e `JSON.parse` vai dentro de
  `try/catch`: o disco pode estar velho ou corrompido.
- Chave por usuário (`empresas:<userCode>`), nunca uma global — o aparelho é compartilhado.

### 4.11 Dado entre rotas — store efêmero consumido uma vez

Referências: `src/features/liberacoes/stores/bordero-retorno.store.ts` (volta) e
`bordero-abertura.store.ts` (ida).

O Expo Router não devolve valor para a tela que navegou, e **parâmetro de rota é URL**: entra no
histórico e não é lugar de dado de ninguém. Nos dois sentidos o payload vai por um store **não
persistido**, consumido uma única vez pelo dono:

- quem produz chama `publicar(payload)` com o payload já validado por schema;
- quem espera chama `consumir(chave)`, que só devolve se a chave for a que ele mesmo abriu e
  limpa o store na leitura — assim o payload não é aplicado duas vezes. A chave é o que
  identifica o dono em cada sentido: na volta a `sequencia` do borderô, na ida o `sistema` da
  rota web;
- na URL fica só o parâmetro da rota (`sistema`, `id`). Nada de concatenar dado em URL
  (`delphi://<json>` do original, `analise §7.1.9`), nem texto livre do usuário como parâmetro,
  nem variável de módulo guardando o retorno.

O par de stores do borderô é o modelo: um por sentido, o mesmo formato nos dois. Se um sentido
novo aparecer, ele copia esse par — não inventa um terceiro jeito (§5.8).

### 4.12 Duas features que precisam conversar — composição na rota

Referências: `src/app/(app)/_layout.tsx` (`PushDaAreaAutenticada`) +
`src/features/liberacoes/hooks/use-invalidar-fila.ts`

Feature não importa feature (§2) — e hoje nenhuma importa. Quando uma precisa disparar algo na
outra, **quem liga as duas é a rota**:

- quem **recebe** expõe um hook-callback como contrato público
  (`useInvalidarFila(): () => void`), sem saber quem chama nem que tela está montada;
- quem **dispara** recebe esse callback por parâmetro
  (`useRoteamentoPush({ atualizarPorTipo })`), sem importar nada da outra feature;
- o `_layout` da área junta os dois num componente que devolve `null`. Ele existe separado do
  layout para que os hooks rodem **depois** das guardas de sessão: registrar aparelho e navegar
  por notificação são coisas de quem já está dentro.

O callback exposto invalida o prefixo **estreito** da feature (§4.3), nunca a raiz: quem está de
fora não deve conseguir derrubar mais cache do que pediu.

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

| #   | Tela                           | Rota                      | Origem no app Delphi                              | Status                                                                                                                                                                                                          |
| --- | ------------------------------ | ------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Splash / roteamento inicial    | `src/app/index.tsx`       | `TFrmLoginBase` (aba Splash)                      | ✅                                                                                                                                                                                                              |
| 2   | Documento da empresa           | `(auth)/documento`        | `TFrmLoginBase` (aba Documento)                   | ✅ CNPJ/CPF validado no schema; grava a empresa licenciada e as três URLs do tenant                                                                                                                             |
| 3   | Configuração de servidor       | `(auth)/configuracao`     | `TFrmLoginBase` (abas Configuração/Bancos)        | ✅ endereços editáveis na tela, ping primário → secundário e escolha da base                                                                                                                                    |
| 4   | Login                          | `(auth)/login`            | `TFrmLoginBase` (aba Login)                       | 🟨 senha em texto puro sobre TLS (§7.1) e erro decidido por `ApiError.status` num módulo só (`auth/lib/erro-login.ts`, dívida D8); **nunca exercitado contra servidor** — falta o Orion aceitar o contrato novo |
| 5   | Registro do aparelho e licença | `(auth)/configuracao`     | `TFrmLoginBase` (abas Identificação/Licença/Erro) | ✅ registro no central, validade da licença e um estado só de erro de licença                                                                                                                                   |
| 6   | Escolha de empresa             | `(auth)/empresa`          | `TFrmLoginBase` (aba Escolha de empresa)          | ✅ lista em query com cache em MMKV; empresa única entra sozinha e vai para o menu                                                                                                                              |
| 7   | Histórico de usuários          | seletor em `(auth)/login` | `TFrmHistoricoUsuarios`                           | ✅ chips dos últimos logins no formulário; MMKV guarda só o username e a data do último acesso                                                                                                                  |

### Área autenticada

| #   | Tela                                          | Rota                            | Origem no app Delphi                        | Status                                                                                   |
| --- | --------------------------------------------- | ------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 8   | Menu principal                                | `(app)/menu`                    | `TFrmPrincipal` + `TFrmPrincipalBase`       | ✅ cabeçalho (usuário, empresa, logo em cache), badge de notificações e aviso de offline |
| 9   | Fila de liberações                            | `(app)/liberacoes`              | `TFrmLiberacoes` › `TabItemNotificacoes`    | ✅¹ busca sobre a lista carregada, ícone por tipo, pull-to-refresh                       |
| 10  | Análise da liberação                          | `(app)/liberacoes/[id]`         | `TFrmLiberacoes` › `TabItemDetalhes`        | ✅¹ reserva ao abrir, devolução ao sair sem decidir, decisão com texto de resposta       |
| 11  | Dados do cliente                              | `(app)/liberacoes/[id]/cliente` | `TFrmLiberacoes` › `TabItemDetalhesCliente` | ✅¹ crédito e títulos em duas queries com schema; campo sem valor não vira linha         |
| 12  | Feedback da decisão                           | (parte de #10)                  | `TabItemFeedbackAceito` / `Recusado`        | ✅¹ um componente para as duas decisões, sem espera artificial antes de voltar           |
| 13  | Notificações                                  | `(app)/notificacoes`            | `TFrmNotificacao`                           | ⬜                                                                                       |
| 14  | Web system — Pedidos de Compra                | `sistema=autcompras`            | `TFrmAutComprasWeb`                         | 🟨² handshake A′ implementado; falta o HTML expor `__teoremaInit`                        |
| 15  | Web system — Autorização de Cotação           | `sistema=autcotacao`            | `TFrmAutCotacaoWeb`                         | 🟨² idem — mesma rota, mesmo contrato                                                    |
| 16  | Web system — Requisição de Compra             | `sistema=reqcompras`            | `TFrmReqComprasWeb`                         | 🟨² idem, com o recorte reduzido de sessão                                               |
| 17  | Web system — Autorizador Financeiro / Borderô | `sistema=autorizador`           | `TFrmWebSystems`                            | 🟨² idem + contexto do borderô e retorno para a análise                                  |

² **Bloco D entregue do lado do app em 10/09/2026**, seguindo a decisão B6 (opção A′,
[`docs/decisao-webview-sessao.md §13`](docs/decisao-webview-sessao.md)). Uma rota para os quatro
sistemas (`(app)/web/[sistema]`), `react-native-webview` instalado, sessão e contexto entregues
por handshake `postMessage` — **nada na URL**. Fica 🟨, e não ✅, porque o critério de pronto
depende de coisa que não é do app: **o HTML precisa expor `window.__teoremaInit` e mandar
`sessao:solicitar`** (pauta em §13.5 do documento). Enquanto isso, a tela abre, carrega a página
e mostra "a página não pediu a sessão" depois de 5 s. Verificado por `lint` + `typecheck`, nunca
contra servidor real — vale a mesma ressalva dos outros blocos.

¹ **Bloco C (telas 9–12) fechado na revisão de 04/09/2026**, contra o critério de pronto do
plano §5. Rotas só compõem, as quatro APIs têm schema Zod, erro é decidido por
`ApiError.status`, estilo só por `className` com token semântico, `lint` e `typecheck` limpos.
A revisão corrigiu três desvios: o `if (estado)` que era sempre verdadeiro e escondia o
conteúdo de seis telas atrás de um `<Screen>` vazio (§4.6), o cast de `LIBERACAO_LIBERADA` no
lugar de validação, e o erro da decisão não tipado como `ApiError`. As dívidas aceitas estão
no §9.

**Ressalva — vale para os Blocos A, B e C, não só para o C:** toda a verificação até aqui foi
**por leitura de código e pelos portões estáticos (`lint` + `typecheck`), sem uma única execução
contra servidor real.** O login segue travado no 🔒 B1 (§7.1): o app já manda a senha em texto
puro, como decidido, mas o `/v1/auth/login` ainda compara `MD5(Decrypt(USUARIO_SENHA))`. Sem
login não há JWT, e sem JWT nenhuma tela de tenant recebeu payload do Orion — então **nenhum ✅
deste índice foi confirmado com dado real**, incluindo os do onboarding.

**Ao 🔒 B1 cair, reverifique os três blocos com dado real antes de confiar no ✅** — é a primeira
coisa a fazer, antes de abrir o Bloco D:

- **Bloco A (telas 1–7)** — documento → configuração → registro → login → empresa de ponta a
  ponta. O que só aparece com servidor real: a resposta de `companyinformation` que vem
  **200 com `{}`** e é traduzida para `ApiError` 404 na borda (§4.1), o `TOKEN` → `jwt` do
  `auth.schema.ts`, o `registerid` omitido no primeiro login, e o fallback primário → secundário.
- **Bloco B (tela 8)** — cabeçalho com usuário, empresa e logo em cache, e o badge de
  notificações, que hoje é `skipToken` e nunca buscou nada (§4.4).
- **Bloco C (telas 9–12)** — o caminho fila → análise → cliente → decisão. Em particular o
  `.catch()` de situação em `liberacao.schema.ts`, que só se manifesta com payload real, e a
  devolução da reserva no unmount.

As telas 14–17 **não** são quatro rotas: todas são a mesma rota parametrizada
`(app)/web/[sistema]`, variando só o parâmetro da coluna Rota. O app Delphi tinha três forms
idênticos para isso (`analise §7.3.21`) — não recrie o arquivo por sistema.

**As telas 13–17 já existem como placeholder** — `(app)/notificacoes.tsx` e
`(app)/web/[sistema].tsx`, cada uma com o que migrar, o que **não** repetir do Delphi e de onde
vem o contexto no comentário de cabeçalho do próprio arquivo. Comece lendo esse comentário; não
crie arquivo novo ao lado.

### Fora de escopo (decisão pendente — ver §7.2)

| Tela                                           | Origem                            | Situação                                                         |
| ---------------------------------------------- | --------------------------------- | ---------------------------------------------------------------- |
| Borderô nativo                                 | `TFrmBordero`                     | Já estava `Visible = False` no menu; substituída pelo web system |
| Pedidos de compra nativo                       | `TFrmPedidosCompra` `iTipoForm=1` | Já estava `Visible = False`; substituída pelo web system         |
| Requisição de compra nativa                    | `TFrmPedidosCompra` `iTipoForm=2` | Já estava `Visible = False`; substituída pelo web system         |
| Gravador de vídeo / leitor de código de barras | `uFrmGravadorVideo`, `UnitLeitor` | Inertes neste app                                                |

### Infraestrutura transversal

| Item                                                                     | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Clientes HTTP (central + tenant) com `ApiError`                          | ✅                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Sessão persistida em MMKV (aparelho, usuário, empresa)                   | ✅                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Query client com política de retry por status                            | ✅                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Componentes base (`Screen`, `Button`, `TextField`, `QueryState`)         | ✅                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Chrome da área autenticada (`AppHeader`, `OfflineBanner`, `SearchField`) | ✅ o `OfflineBanner` já lê `session.online` sozinho — não repita o aviso na tela                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Tokens de tema light/dark                                                | ✅                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Fallback primário → secundário → offline                                 | 🟨 (o teste primário → secundário existe no onboarding e elege `serverUrlActive`; falta refazê-lo em runtime quando o endereço ativo cai — plano F1)                                                                                                                                                                                                                                                                                                                                                                     |
| Push notification (FCM / APNs) e roteamento por notificação              | 🟨 (a ficha E1 está escrita em `features/push/` — permissão, canal, token, `tokenpush`, roteamento por payload e guarda de emulador. Falta o lado de fora do app: `google-services.json`, credencial APNs e o envio no Orion — 🔒 B7 §7.7)                                                                                                                                                                                                                                                                               |
| Cache offline de empresas                                                | 🟨 (a lista do usuário já é gravada e relida do MMKV pela tela 6; falta o login offline em si — plano F2)                                                                                                                                                                                                                                                                                                                                                                                                                |
| Relato de erro / observabilidade                                         | ⬜ (nenhum coletor instalado; o canal é o `console.warn` do §5.4 — o primeiro fallback silencioso a virar relato é o de `LIBERACAO_LIBERADA` em `liberacao.schema.ts`, e é o ponto a trocar ao instalar Sentry)                                                                                                                                                                                                                                                                                                          |
| Testes automatizados                                                     | 🟨 (`node --test` — §1. **221 casos.** Fora do React (F4): `liberacao`, `cliente`, `bordero-retorno`, `auth` e `mensagem-web`, o mapa de erro do login, `toApiError`, o guarda de origem da WebView, documento e data. Hooks de escrita (F4b): decidir, reservar/devolver, registrar aparelho e login — invalidação, ciclo de vida e erro tipado. **Ainda sem teste:** os schemas `login`, `erro-login`, `bordero-abertura`, `empresa` e `push`; os hooks de leitura; e **toda tela**, que precisaria do renderer do RN) |

---

## 7. Decisões em aberto

Precisam de resposta do time antes de fechar as telas correspondentes.

1. **Hash da senha no login — decidido do lado do app, pendente no servidor.** A escolha foi a
   **senha em texto puro sobre TLS, com Argon2id/bcrypt 100% no Orion**;
   `preparePassword()` já está implementado como passthrough. **Falta o servidor:** hoje o
   `/v1/auth/login` ainda compara `MD5(Decrypt(USUARIO_SENHA))`, então o login real só passa a
   funcionar quando o novo contrato subir. Migração sugerida, riscos e critérios em
   [`docs/decisao-hash-senha.md`](docs/decisao-hash-senha.md).
2. **Nativo ou web para compras e borderô.** Hoje há duas gerações de UI para a mesma coisa.
   O índice acima assume **web**, e desde 10/09/2026 essa suposição virou código: o contêiner
   `(app)/web/[sistema]` e a feature `web-systems` existem. Continua sendo decisão do time —
   mas agora escolher nativo significa **descartar** o Bloco D, não só mudá-lo de natureza.
3. **`react-native-webview` — resolvido.** Instalado em 10/09/2026 na versão que o Expo SDK 57
   fixa (`13.16.1`, de `expo/bundledNativeModules.json`). Como é módulo nativo, **exige
   `npm run prebuild` e um dev client novo**: atualizar o bundle JS não basta.
4. **Sessão na WebView — DECIDIDA em 10/09/2026; não é mais bloqueio.** Escolhida a opção **A′**:
   **handshake por `postMessage`**. A página manda `sessao:solicitar` quando está pronta e o app
   responde com **um** payload injetado (`window.__teoremaInit`) contendo sessão _e_ contexto do
   borderô. **Nada trafega em URL** — nem token, nem `sequencia`, nem `resposta`: acaba o fragmento
   do original (`analise §5.3`, §7.1.9) e, com ele, o `_t=<unix>`. A mesma ponte cobre os dois
   sentidos: `bordero:retorno` (publica em `useBorderoRetornoStore` e fecha) e `navegacao:fechar`
   substituem `app://menu` e `delphi://`. O **contrato de mensagem completo** — envelope `v`/`tipo`,
   as quatro mensagens, o recorte de `sessao` por sistema, a regra de injeção com duplo
   `JSON.stringify` e as regras de recepção — está em
   [`docs/decisao-webview-sessao.md §13`](docs/decisao-webview-sessao.md). **Implemente por ele; não
   reabra a discussão.** O **ticket de uso único** (opção C) fica como alvo para quando houver frente
   aberta no Orion — migração de transporte, sem mudar o contrato de dados.
   **Com isso o D7 fecha por inteiro.** A metade do app já estava feita (a análise publica em
   `bordero-abertura.store.ts`, validado por `borderoAberturaSchema`, e o `router.push` leva **só**
   `sistema` — §4.11); a outra metade, a travessia app → HTML, é o `contexto` do payload de
   handshake, alimentado por `consumir(sistema)` **no mount** da rota web e guardado em `useRef`,
   porque o store limpa na leitura e cada reload da página refaz o handshake.
   **Implementada em 10/09/2026** (§6, telas 14–17): `features/web-systems/` tem o catálogo dos
   quatro sistemas, o recorte de sessão por sistema, o schema das mensagens e o hook do
   handshake; a rota liga as duas features, como manda o §4.12.
   **O que ainda falta não é decisão nem código do app:** combinar com quem mantém o HTML a
   pauta de §13.5 (expor `__teoremaInit`, mandar `sessao:solicitar`, parar de ler
   `location.hash`, não persistir o token na página). Sem isso a tela abre e avisa que a página
   não pediu a sessão.
5. **Reserva da liberação.** O servidor aceita reservar algo que já está `'1'` com outro
   usuário, e não há TTL: a trava é fictícia (`analise §7.1.2`, `§7.1.4`). O app não corrige
   isso sozinho.
6. **Padronização de erro no servidor.** Precisamos de código de erro estável, não texto.
7. **Push: FCM no Android e APNs no iOS.** O servidor precisa tratar os dois caminhos. Opções,
   biblioteca recomendada e a configuração exigida em cada plataforma em
   [`docs/decisao-push.md`](docs/decisao-push.md) — **a decisão do time ainda não foi tomada**.
   **A ficha E1 foi implementada assumindo a opção 1 do documento** (token nativo via
   `expo-notifications`, Orion enviando direto para FCM e APNs): `features/push/` faz permissão,
   canal, token, `tokenpush`, roteamento por payload e guarda de emulador, e o
   `app.json` registra o plugin. **Isso não fecha o B7** — ele é sobre _quem entrega_, e a resposta
   ainda é do time. Se a escolha virar a opção 2 (Firebase nas duas plataformas) ou a 3 (Expo Push
   Service), o que muda é `registro-push.ts` e o schema do `tokenpush`; o resto da feature fica.
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

---

## 9. Dívida técnica anotada

Desvios conhecidos, revisados e **aceitos por ora**: nenhum deles quebra o critério de pronto do
plano §5 ao ponto de travar um bloco, e todos têm dono claro. Estão aqui para não serem
redescobertos como novidade — e para não virarem padrão copiado em bloco novo.

| #   | Onde                                                                                                                                                                  | O quê                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Quando pagar                                                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D4  | `use-analise-credito.ts` · `use-historico-compras.ts`                                                                                                                 | A guarda é `enabled: empresa !== null && cliente !== null`, mas o comentário promete "sem empresa ou sem cliente não roda": **string vazia passa** e viraria `customerdataanalytics//` → 404. Não acontece hoje porque `DadosCliente` recebe `string` não-nulável e a rota pré-valida — o que deixa o `                                                                                                                                                                                                                                                                                                                              | null` da assinatura morto.                                                                                                                                                                                      | Ao aparecer um segundo consumidor: ou cai o ` | null`, ou guarda por truthiness. |
| D5  | `use-decidir-liberacao.ts`                                                                                                                                            | Invalida `liberacoesKeys.all`, que por prefixo cobre também `credito(…)` e `historico(…)`: decidir uma liberação refaz a análise de crédito de todo cliente em cache. É o que a ficha C2 pede literalmente, mas é largo. **O prefixo já existe** (`liberacoesKeys.fila`, criado na E1) e o push invalida só ele; falta trocar aqui.                                                                                                                                                                                                                                                                                                  | Numa revisão da C2 — a troca é de uma linha, mas muda o que o usuário vê depois de decidir, e isso merece ser decidido de propósito.                                                                            |
| D6  | `dados-cliente.tsx` · `campos-cliente.ts` · `cliente-titulo-card.tsx` · `liberacao-resumo.tsx` · `use-analise-credito.ts` · `documento.test.ts` · `use-login.test.ts` | Nome de coluna Firebird fora de `schemas/`. Em quase todos é **comentário**, e nenhum código depende deles: é o §5.8 do plano (citar a origem da regra) cruzando com o §5.3 (o nome não sai de `schemas/`). A letra do §5.3 está violada, o espírito não. **A exceção é `use-login.test.ts`** (F4b): ali os nomes estão em código, numa fixture, porque o servidor falso devolve o payload **cru** e o teste existe para provar que o schema o traduz. Esconder os nomes atrás de um helper não os tiraria do repositório e deixaria o teste ilegível.                                                                               | Precisa de uma decisão do time, não de um patch. Até lá, não crie **código** que leia coluna fora de `schemas/` — a fixture de teste é a única exceção, e só porque o que ela representa é o payload cru.       |
| D7  | `web-system-view.tsx`                                                                                                                                                 | A WebView roda com `incognito` e `cacheEnabled={false}` (docs/decisao-webview-sessao §9): zero resíduo entre usuários no aparelho compartilhado, ao custo de o HTML não ter armazenamento que sobreviva à tela — o que o contrato já proíbe para o token, mas vale para o resto. Some com isso o `usesCleartextTraffic`: **tenant em `http://` não abre na WebView em release no Android**, e hoje nada garante que o endereço digitado no onboarding seja `https`.                                                                                                                                                                  | Ao primeiro web system reclamar de armazenamento, ou ao primeiro tenant sem TLS: as duas respostas são do time, não do app.                                                                                     |
| D8  | `features/auth/lib/erro-login.ts`                                                                                                                                     | Para separar o **aparelho sem registro** (`{"erro":"cadastro"}`, docs/analise §3.1) de uma credencial inválida, o módulo lê o **texto** do campo `erro` — literalmente o §5.11 e o defeito da `analise §7.1.3`. Atenuantes: a decisão por `status` vem antes, o texto só desempata 400/401, o corpo passa por Zod normalizado (`erro-login.schema.ts`) em vez de cast, e o genérico é o caminho normal. É a exceção que a própria ficha A4 autoriza, confinada a uma função — `error.payload` não é lido em nenhum outro ponto do `src/`.                                                                                            | Quando o 🔒 B4 entregar código de erro estável: cai `motivoDoCorpo` e o mapa decide só por status. Até lá, não copie o padrão.                                                                                  |
| D9  | `shared/lib/http/errors.ts` · `features/auth/lib/erro-login.ts`                                                                                                       | `ApiError.isNetworkError` é `status === 0`, e o interceptor de request de `client.ts` usa o **mesmo** 0 para "servidor do cliente ainda não resolvido" — condição que o comentário do próprio `client.ts` diz não ser erro de rede. No login isso vira "Verifique a conexão" em vez de mandar refazer a configuração. Defeito herdado do `shared/`, não criado pela A4, e hoje quase inalcançável: `index.tsx` exige aparelho ativo antes de chegar ao login. Separar exigiria mudar a semântica de `isNetworkError` para todos os consumidores, o que é maior que a ficha.                                                          | Ao surgir o segundo consumidor de `isNetworkError`, ou no F1 (fallback em runtime): dar um status próprio ao "sem endereço" na borda.                                                                           |
| D10 | `features/auth/lib/erro-login.ts` · `use-login.ts`                                                                                                                    | `erro=cadastro` (docs/analise §3.1) diz que o `registerid` não existe mais no central, mas **nada no app derruba `device.status`/`registerId`**: o usuário tenta de novo com o mesmo registro morto, e ir a `(auth)/configuracao` o devolve ao login (`resolverEtapa` → `'login'` sem usuário). `resetDevice` existe em `session.store.ts` exatamente para isso e nunca foi chamado. Por isso a mensagem **não** manda refazer a configuração — prometer um caminho que não resolve é pior que não oferecê-lo. Fora do escopo da A4, que mapeia erro e não muda estado do aparelho.                                                  | Na primeira ficha que tocar o ciclo de registro: `onError` do `useLogin` faz `setDevice({ status: NaoRegistrado, registerId: null })`, como `use-registro-expirado.ts` já faz para a validade vencida.          |
| D11 | `liberacoes/schemas/cliente.schema.ts` (`optionalNumber`)                                                                                                             | Texto **não vazio** que não converte para número vira `null` **sem relato**: `'250,00'` num campo de dinheiro some da tela de crédito em silêncio. O caso simétrico em `liberacao.schema.ts` (`LIBERACAO_LIBERADA`) já chama `reportarSituacaoInesperada` — a regra do §6 ("Relato de erro") é a mesma e aqui não é aplicada. Qual separador decimal o Orion usa em `FINANCEIRO_VALOR` **nunca foi visto com dado real**, e a análise registra que `COMPRA_VALOR_TOTAL` vem em centavos: formato numérico ali não é uniforme. A F4 fixou o comportamento atual em teste (`cliente.schema.test.ts`), com o nome dizendo que é dívida. | Ao 🔒 B1 cair, na reverificação do Bloco C com payload real: confirmar o separador e então ou converter, ou passar a relatar. Mudar agora seria alterar uma tela de dinheiro contra um payload que ninguém viu. |

---

## 10. Convenção de commit

O commit não é só histórico: é **a entrada da automação** que atualiza o Notion e o brief. Um
commit fora do formato não quebra nada visivelmente — ele só não aparece no Notion, o que é pior,
porque ninguém percebe.

### Forma

```
<tipo>(<escopo>): <assunto>

<corpo — por que, não o que>

Ficha: <A1…F4>
Notion-ID: <id da página da tarefa>
Status: <pronto | parcial>
```

- **tipo**: `feat` · `fix` · `refactor` · `docs` · `chore` · `test`
- **escopo**: a feature (`auth`, `liberacoes`, `push`, `web-systems`, `empresa`, `notificacoes`)
  ou a camada (`shared`, `app`, `tools`)
- **assunto**: imperativo, português, até 72 caracteres, sem ponto final
- **corpo**: a decisão e a razão dela. O diff já mostra o que mudou; ele não mostra por quê.
  Commit trivial pode não ter corpo — commit que fecha ficha sempre tem.

### Os trailers

São _git trailers_ de verdade (chave, dois-pontos, espaço, valor, no último parágrafo, sem linha
em branco entre eles). Isso é o que torna a leitura confiável:

```bash
git log --format='%H%x09%(trailers:key=Ficha,valueonly,separator=,)%x09%(trailers:key=Status,valueonly)'
```

| Trailer     | Quando entra                        | Regra                                                                         |
| ----------- | ----------------------------------- | ----------------------------------------------------------------------------- |
| `Ficha`     | Todo commit que toca uma ficha      | Um id só. Commit que mexe em duas fichas é commit que devia ser dois.         |
| `Notion-ID` | Quando existe tarefa correspondente | **Omitir** se não existir. Id inventado quebra a automação em silêncio.       |
| `Status`    | Junto com `Ficha`                   | `pronto` só se o §6 virou ✅. Se virou 🟨 (falta coisa de fora), é `parcial`. |

### Regras

1. **A linha do §6 é atualizada no mesmo commit** que fecha a tela. É o item 9 do critério de
   pronto do plano, e é o que impede o placar de descolar do código.
2. Um commit, uma ficha. Se você não consegue escrever um `Ficha:` só, o commit está grande demais.
3. `--no-verify` só em emergência de verdade, e o próximo commit conserta o que foi pulado.
4. Dívida nova entra na §9 **no commit que a cria**, não "depois".

### Exemplo

```
feat(push): invalidar a fila por tipo em vez de liberacoesKeys.all

Com push, quem dispara a invalidação passa a ser o servidor, não o usuário.
liberacoesKeys.all é prefixo de credito() e historico(), então cada
notificação recebida refazia a análise de crédito de todo cliente em cache —
a dívida D5 deixaria de ser dívida e viraria defeito.

A ligação mora em app/(app)/_layout.tsx: features/push não importa
liberacoesKeys, que seria feature importando feature (§2).

Ficha: E1
Notion-ID: 2f1a3b4c5d6e7f8091a2b3c4d5e6f708
Status: parcial
```

---

## 11. Fluxo de trabalho com Claude Code

O repositório é a fonte da verdade do **código**; o `CLAUDE.md §6` é a do **status**; o Notion é a
do **que fazer hoje**. Nenhum dos três manda nos outros dois — e é por isso que o cruzamento é o
primeiro passo do dia, não uma conferência eventual.

### O ciclo

| Momento         | Comando         | O que acontece                                                            |
| --------------- | --------------- | ------------------------------------------------------------------------- |
| Começo do dia   | `/dia`          | Cruza Notion × plano × §6 × `git log`. Não escreve código.                |
| Por ficha       | `/ficha <id>`   | Carrega ficha, §5, §2, §8, §9 e a análise citada. Planeja. Espera o aval. |
| Antes do commit | `/fechar-ficha` | Portões, `@revisor`, critério §5 item a item, §6 atualizado, commit.      |
| Fim do dia      | `/diario`       | `docs/diario/AAAA-MM-DD.md`: decisões, achados, primeiro passo de amanhã. |

**Uma sessão, uma ficha.** `/clear` entre fichas. Contexto de ficha anterior faz o modelo repetir
padrão que não vale ali — e este projeto tem seis features com convenções parecidas mas não iguais.

### Modo plano

`/ficha` planeja antes de escrever. Aprove o plano lendo os **schemas** e a **lista de arquivos**:
é onde os erros caros aparecem. Plano que não diz que payload entra e que tipo sai não é plano.

### Portões

`npm run typecheck && npm run lint && npm test`, projeto inteiro, antes de todo commit. O
`pre-commit` só vê os arquivos staged; o `pre-push` roda `typecheck` + `test`, mas não o `lint`. O
hook de `PostToolUse` passa o ESLint no arquivo recém-editado — é feedback imediato, não portão.

**Ter runner não muda o que ✅ significa: continua sendo "atende ao critério", não "funciona".**
A suíte da F4 cobre tradução de payload e decisão de erro — nada que dependa de React, de
aparelho ou de servidor. A ressalva da §6 ("nenhum ✅ confirmado com dado real") segue inteira, e
quem a derruba é o probe do §1 com o 🔒 B1 fechado, não o `npm test`.

### O revisor

`@revisor` é subagente com contexto próprio. Ele não escreveu o código e não tem apego a ele. Rode
antes de todo commit que feche ficha — a revisão de 04/09/2026 pegou três desvios manualmente, e os
três eram do tipo que o autor não vê.
