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

Enquanto isso, **o portão de qualquer alteração é este par**, rodado antes de commitar:

```bash
npm run typecheck && npm run lint
```

O `pre-commit` cobre menos do que isso (o `lint-staged` só olha os arquivos staged) e o
`pre-push` só roda o `typecheck` — rode os dois à mão sobre o projeto inteiro.

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
│   │   ├── components/ui/      #   Screen, Button, TextField, QueryState,
│   │   │                       #   AppHeader, OfflineBanner, SearchField
│   │   ├── config/             #   env, queryClient
│   │   ├── lib/http/           #   clientes Axios + ApiError
│   │   ├── lib/storage/        #   MMKV + adaptador do Zustand
│   │   ├── lib/format/         #   moeda, data, cn
│   │   ├── lib/schema/         #   peças de Zod dos payloads do Orion
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

**O prefixo do path não decide o cliente.** `/v1/application/*` existe nos **dois** servidores
com rotas diferentes: quem decide é de quem é o dado — licença e aparelho são do central,
qualquer coisa que dependa da base do cliente é do tenant. Superfície em uso hoje:

| Cliente      | Rotas                                                                                                                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `centralApi` | `/v1/application/companyinformation` · `/v1/application/getserverurl` · `/v1/application/register`                                                                                                                      |
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

Tudo mora numa instância única de MMKV (`shared/lib/storage/mmkv.ts`). Chave de `persist` é o
nome do store em kebab-case; chave escrita à mão é `dominio:identificador`. O inventário
completo — é ele que responde "por que esse dado sobreviveu ao logout":

| Chave                 | Quem escreve                                       | Conteúdo                                     |
| --------------------- | -------------------------------------------------- | -------------------------------------------- |
| `session`             | `shared/stores/session.store.ts`                   | aparelho, usuário, empresa (sem `online`)    |
| `historico-usuarios`  | `features/auth/stores/historico-usuarios.store.ts` | até 5 logins + data do último acesso         |
| `empresas:<userCode>` | `features/empresa/lib/empresas-cache.ts`           | lista de empresas do usuário (cache offline) |

### 4.9 Estilo com NativeWind

Só `className`, nunca `StyleSheet.create` nem objeto de estilo inline — a única exceção no
projeto é `style={{ flex: 1 }}` no `GestureHandlerRootView`, que exige estilo real.

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

| #   | Tela                           | Rota                      | Origem no app Delphi                              | Status                                                                                                                            |
| --- | ------------------------------ | ------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Splash / roteamento inicial    | `src/app/index.tsx`       | `TFrmLoginBase` (aba Splash)                      | ✅                                                                                                                                |
| 2   | Documento da empresa           | `(auth)/documento`        | `TFrmLoginBase` (aba Documento)                   | ✅ CNPJ/CPF validado no schema; grava a empresa licenciada e as três URLs do tenant                                               |
| 3   | Configuração de servidor       | `(auth)/configuracao`     | `TFrmLoginBase` (abas Configuração/Bancos)        | ✅ endereços editáveis na tela, ping primário → secundário e escolha da base                                                      |
| 4   | Login                          | `(auth)/login`            | `TFrmLoginBase` (aba Login)                       | 🟨 app pronto: senha em texto puro sobre TLS (§7.1); **nunca exercitado contra servidor** — falta o Orion aceitar o contrato novo |
| 5   | Registro do aparelho e licença | `(auth)/configuracao`     | `TFrmLoginBase` (abas Identificação/Licença/Erro) | ✅ registro no central, validade da licença e um estado só de erro de licença                                                     |
| 6   | Escolha de empresa             | `(auth)/empresa`          | `TFrmLoginBase` (aba Escolha de empresa)          | ✅ lista em query com cache em MMKV; empresa única entra sozinha e vai para o menu                                                |
| 7   | Histórico de usuários          | seletor em `(auth)/login` | `TFrmHistoricoUsuarios`                           | ✅ chips dos últimos logins no formulário; MMKV guarda só o username e a data do último acesso                                    |

### Área autenticada

| #   | Tela                                          | Rota                            | Origem no app Delphi                        | Status                                                                                   |
| --- | --------------------------------------------- | ------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 8   | Menu principal                                | `(app)/menu`                    | `TFrmPrincipal` + `TFrmPrincipalBase`       | ✅ cabeçalho (usuário, empresa, logo em cache), badge de notificações e aviso de offline |
| 9   | Fila de liberações                            | `(app)/liberacoes`              | `TFrmLiberacoes` › `TabItemNotificacoes`    | ✅¹ busca sobre a lista carregada, ícone por tipo, pull-to-refresh                       |
| 10  | Análise da liberação                          | `(app)/liberacoes/[id]`         | `TFrmLiberacoes` › `TabItemDetalhes`        | ✅¹ reserva ao abrir, devolução ao sair sem decidir, decisão com texto de resposta       |
| 11  | Dados do cliente                              | `(app)/liberacoes/[id]/cliente` | `TFrmLiberacoes` › `TabItemDetalhesCliente` | ✅¹ crédito e títulos em duas queries com schema; campo sem valor não vira linha         |
| 12  | Feedback da decisão                           | (parte de #10)                  | `TabItemFeedbackAceito` / `Recusado`        | ✅¹ um componente para as duas decisões, sem espera artificial antes de voltar           |
| 13  | Notificações                                  | `(app)/notificacoes`            | `TFrmNotificacao`                           | ⬜                                                                                       |
| 14  | Web system — Pedidos de Compra                | `sistema=autcompras`            | `TFrmAutComprasWeb`                         | ⬜                                                                                       |
| 15  | Web system — Autorização de Cotação           | `sistema=autcotacao`            | `TFrmAutCotacaoWeb`                         | ⬜                                                                                       |
| 16  | Web system — Requisição de Compra             | `sistema=reqcompras`            | `TFrmReqComprasWeb`                         | ⬜                                                                                       |
| 17  | Web system — Autorizador Financeiro / Borderô | `sistema=autorizador`           | `TFrmWebSystems`                            | ⬜                                                                                       |

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

### Fora de escopo (decisão pendente — ver §7.2)

| Tela                                           | Origem                            | Situação                                                         |
| ---------------------------------------------- | --------------------------------- | ---------------------------------------------------------------- |
| Borderô nativo                                 | `TFrmBordero`                     | Já estava `Visible = False` no menu; substituída pelo web system |
| Pedidos de compra nativo                       | `TFrmPedidosCompra` `iTipoForm=1` | Já estava `Visible = False`; substituída pelo web system         |
| Requisição de compra nativa                    | `TFrmPedidosCompra` `iTipoForm=2` | Já estava `Visible = False`; substituída pelo web system         |
| Gravador de vídeo / leitor de código de barras | `uFrmGravadorVideo`, `UnitLeitor` | Inertes neste app                                                |

### Infraestrutura transversal

| Item                                                                     | Status                                                                                                                                                                                                          |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clientes HTTP (central + tenant) com `ApiError`                          | ✅                                                                                                                                                                                                              |
| Sessão persistida em MMKV (aparelho, usuário, empresa)                   | ✅                                                                                                                                                                                                              |
| Query client com política de retry por status                            | ✅                                                                                                                                                                                                              |
| Componentes base (`Screen`, `Button`, `TextField`, `QueryState`)         | ✅                                                                                                                                                                                                              |
| Chrome da área autenticada (`AppHeader`, `OfflineBanner`, `SearchField`) | ✅ o `OfflineBanner` já lê `session.online` sozinho — não repita o aviso na tela                                                                                                                                |
| Tokens de tema light/dark                                                | ✅                                                                                                                                                                                                              |
| Fallback primário → secundário → offline                                 | 🟨 (o teste primário → secundário existe no onboarding e elege `serverUrlActive`; falta refazê-lo em runtime quando o endereço ativo cai — plano F1)                                                            |
| Push notification (FCM / APNs) e roteamento por notificação              | ⬜                                                                                                                                                                                                              |
| Cache offline de empresas                                                | 🟨 (a lista do usuário já é gravada e relida do MMKV pela tela 6; falta o login offline em si — plano F2)                                                                                                       |
| Relato de erro / observabilidade                                         | ⬜ (nenhum coletor instalado; o canal é o `console.warn` do §5.4 — o primeiro fallback silencioso a virar relato é o de `LIBERACAO_LIBERADA` em `liberacao.schema.ts`, e é o ponto a trocar ao instalar Sentry) |
| Testes automatizados                                                     | ⬜ (nenhum runner instalado — §1)                                                                                                                                                                               |

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
   histórico e no cache. Definir o novo mecanismo antes de implementar as telas web. Opções
   levantadas, com recomendação e comparação, em
   [`docs/decisao-webview-sessao.md`](docs/decisao-webview-sessao.md) — **a decisão do time ainda
   não foi tomada**.
   **O D7 (revisão do Bloco C) tinha duas metades, e a do app foi fechada.** A ida da análise
   para a rota web não passa mais pela URL: `analise-liberacao.tsx` publica sistema, sequência e
   resposta em `bordero-abertura.store.ts`, validados por `borderoAberturaSchema`, e o
   `router.push` leva **só** `sistema` — o texto livre do usuário deixou de existir como
   parâmetro de rota (§4.11). **Continua em aberto** a outra metade: como sessão _e_ contexto
   chegam ao HTML dentro da WebView, que é justamente o objeto desta decisão — a recomendação
   do documento é um payload único por `postMessage`, sem nada na URL. Enquanto o contêiner é
   placeholder, os dois canais existem com uma ponta só — `consumir` da ida sem chamador,
   `publicar` da volta sem produtor: é a ordem do plano, não código morto.
5. **Reserva da liberação.** O servidor aceita reservar algo que já está `'1'` com outro
   usuário, e não há TTL: a trava é fictícia (`analise §7.1.2`, `§7.1.4`). O app não corrige
   isso sozinho.
6. **Padronização de erro no servidor.** Precisamos de código de erro estável, não texto.
7. **Push: FCM no Android e APNs no iOS.** O servidor precisa tratar os dois caminhos. Opções,
   biblioteca recomendada e a configuração exigida em cada plataforma em
   [`docs/decisao-push.md`](docs/decisao-push.md) — **a decisão do time ainda não foi tomada**.
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

| #   | Onde                                                                                                                      | O quê                                                                                                                                                                                                                                                                                                   | Quando pagar                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| D4  | `use-analise-credito.ts` · `use-historico-compras.ts`                                                                     | A guarda é `enabled: empresa !== null && cliente !== null`, mas o comentário promete "sem empresa ou sem cliente não roda": **string vazia passa** e viraria `customerdataanalytics//` → 404. Não acontece hoje porque `DadosCliente` recebe `string` não-nulável e a rota pré-valida — o que deixa o ` | null` da assinatura morto.                                                                                       | Ao aparecer um segundo consumidor: ou cai o ` | null`, ou guarda por truthiness. |
| D5  | `use-decidir-liberacao.ts`                                                                                                | Invalida `liberacoesKeys.all`, que por prefixo cobre também `credito(…)` e `historico(…)`: decidir uma liberação refaz a análise de crédito de todo cliente em cache. É o que a ficha C2 pede literalmente, mas é largo.                                                                                | Ao a fila ganhar mais sub-chaves — criar um prefixo de fila e invalidar só ele.                                  |
| D6  | `dados-cliente.tsx` · `campos-cliente.ts` · `cliente-titulo-card.tsx` · `liberacao-resumo.tsx` · `use-analise-credito.ts` | Nome de coluna Firebird **em comentário** fora de `schemas/`. Nenhum código depende deles: é o §5.8 do plano (citar a origem da regra) cruzando com o §5.3 (o nome não sai de `schemas/`). A letra do §5.3 está violada, o espírito não.                                                                | Precisa de uma decisão do time, não de um patch. Até lá, não crie **código** que leia coluna fora de `schemas/`. |
