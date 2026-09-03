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

Scripts: `lint` · `lint:fix` · `format` · `format:check` · `typecheck` · `doctor` · `prebuild`.

**Não há runner de teste instalado** — nem Jest, nem Vitest, nem `@testing-library`. Não existe
comando para rodar "um teste"; os únicos portões automáticos são o `typecheck` e o `lint-staged`
dos hooks abaixo, e o projeto não tem CI. Ao instalar o primeiro runner, atualize esta seção e a
linha "Testes automatizados" da §6.

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
│   ├── analise-app-original.md # inventário do legado — NÃO reformatar (.prettierignore)
│   ├── plano-migracao.md       # blocos A–F, ordem de ataque, critério de pronto
│   └── decisao-hash-senha.md   # bloqueio B1: senha em texto puro sobre TLS
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
- Import sempre pelo alias `@/` (`@/features/liberacoes/...`), nunca `../../../`. O
  `no-restricted-imports` do ESLint barra exatamente `../../../*` e `../../features/*` — o resto
  (`../../shared/foo`, por exemplo) passa pelo linter, mas continua proibido por convenção.

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

| #   | Tela                           | Rota                  | Origem no app Delphi                              | Status                                                                              |
| --- | ------------------------------ | --------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | Splash / roteamento inicial    | `src/app/index.tsx`   | `TFrmLoginBase` (aba Splash)                      | ✅                                                                                  |
| 2   | Documento da empresa           | `(auth)/documento`    | `TFrmLoginBase` (aba Documento)                   | ✅ CNPJ/CPF validado no schema; grava a empresa licenciada e as três URLs do tenant |
| 3   | Configuração de servidor       | `(auth)/configuracao` | `TFrmLoginBase` (abas Configuração/Bancos)        | ✅ endereços editáveis na tela, ping primário → secundário e escolha da base        |
| 4   | Login                          | `(auth)/login`        | `TFrmLoginBase` (aba Login)                       | 🟨 UI, formulário e envio da senha prontos; falta o servidor (§7.1)                 |
| 5   | Registro do aparelho e licença | `(auth)/configuracao` | `TFrmLoginBase` (abas Identificação/Licença/Erro) | ✅ registro no central, validade da licença e um estado só de erro de licença       |
| 6   | Escolha de empresa             | `(auth)/empresa`      | `TFrmLoginBase` (aba Escolha de empresa)          | ⬜                                                                                  |
| 7   | Histórico de usuários          | —                     | `TFrmHistoricoUsuarios`                           | ⬜                                                                                  |

### Área autenticada

| #   | Tela                                          | Rota                            | Origem no app Delphi                        | Status                                                                                   |
| --- | --------------------------------------------- | ------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 8   | Menu principal                                | `(app)/menu`                    | `TFrmPrincipal` + `TFrmPrincipalBase`       | ✅ cabeçalho (usuário, empresa, logo em cache), badge de notificações e aviso de offline |
| 9   | Fila de liberações                            | `(app)/liberacoes`              | `TFrmLiberacoes` › `TabItemNotificacoes`    | ✅ busca sobre a lista carregada, ícone por tipo, pull-to-refresh                        |
| 10  | Análise da liberação                          | `(app)/liberacoes/[id]`         | `TFrmLiberacoes` › `TabItemDetalhes`        | ⬜                                                                                       |
| 11  | Dados do cliente                              | `(app)/liberacoes/[id]/cliente` | `TFrmLiberacoes` › `TabItemDetalhesCliente` | ⬜                                                                                       |
| 12  | Feedback da decisão                           | (parte de #10)                  | `TabItemFeedbackAceito` / `Recusado`        | ⬜                                                                                       |
| 13  | Notificações                                  | `(app)/notificacoes`            | `TFrmNotificacao`                           | ⬜                                                                                       |
| 14  | Web system — Pedidos de Compra                | `sistema=autcompras`            | `TFrmAutComprasWeb`                         | ⬜                                                                                       |
| 15  | Web system — Autorização de Cotação           | `sistema=autcotacao`            | `TFrmAutCotacaoWeb`                         | ⬜                                                                                       |
| 16  | Web system — Requisição de Compra             | `sistema=reqcompras`            | `TFrmReqComprasWeb`                         | ⬜                                                                                       |
| 17  | Web system — Autorizador Financeiro / Borderô | `sistema=autorizador`           | `TFrmWebSystems`                            | ⬜                                                                                       |

As telas 14–17 **não** são quatro rotas: todas são a mesma rota parametrizada
`(app)/web/[sistema]`, variando só o parâmetro da coluna Rota. O app Delphi tinha três forms
idênticos para isso (`analise §7.3.21`) — não recrie o arquivo por sistema.

### Fora de escopo (decisão pendente — ver §7.2)

| Tela                                           | Origem                            | Situação                                                         |
| ---------------------------------------------- | --------------------------------- | ---------------------------------------------------------------- |
| Borderô nativo                                 | `TFrmBordero`                     | Já estava `Visible = False` no menu; substituída pelo web system |
| Pedidos de compra nativo                       | `TFrmPedidosCompra` `iTipoForm=1` | Já estava `Visible = False`; substituída pelo web system         |
| Requisição de compra nativa                    | `TFrmPedidosCompra` `iTipoForm=2` | Já estava `Visible = False`; substituída pelo web system         |
| Gravador de vídeo / leitor de código de barras | `uFrmGravadorVideo`, `UnitLeitor` | Inertes neste app                                                |

### Infraestrutura transversal

| Item                                                             | Status                                                                                                                                               |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clientes HTTP (central + tenant) com `ApiError`                  | ✅                                                                                                                                                   |
| Sessão persistida em MMKV (aparelho, usuário, empresa)           | ✅                                                                                                                                                   |
| Query client com política de retry por status                    | ✅                                                                                                                                                   |
| Componentes base (`Screen`, `Button`, `TextField`, `QueryState`) | ✅                                                                                                                                                   |
| Tokens de tema light/dark                                        | ✅                                                                                                                                                   |
| Fallback primário → secundário → offline                         | 🟨 (o teste primário → secundário existe no onboarding e elege `serverUrlActive`; falta refazê-lo em runtime quando o endereço ativo cai — plano F1) |
| Push notification (FCM / APNs) e roteamento por notificação      | ⬜                                                                                                                                                   |
| Cache offline de empresas                                        | ⬜                                                                                                                                                   |
| Testes automatizados                                             | ⬜ (nenhum runner instalado — §1)                                                                                                                    |

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
