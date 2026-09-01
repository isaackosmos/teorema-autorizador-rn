# Teorema Autorizador — React Native

Reescrita em React Native (Expo) do app Delphi/FMX **Teorema Autorizador**: fila de liberações
remotas do ERP Teorema, autorização de compras, cotações e borderô.

## Stack

Expo SDK 57 · React Native 0.86 · TypeScript · Expo Router · NativeWind · Zustand ·
TanStack Query · Axios · React Hook Form + Zod · MMKV

## Rodando

Este app usa módulos nativos (`react-native-mmkv` via Nitro, Reanimated 4 via worklets),
então **não roda no Expo Go** — é preciso um dev client.

```bash
npm install
cp .env.example .env.local     # preencha EXPO_PUBLIC_CENTRAL_API_TOKEN
npm run prebuild               # gera android/ e ios/
npm run android                # ou: npm run ios
```

| Script                            | O que faz               |
| --------------------------------- | ----------------------- |
| `npm start`                       | Dev server (dev client) |
| `npm run lint` · `lint:fix`       | ESLint                  |
| `npm run format` · `format:check` | Prettier                |
| `npm run typecheck`               | `tsc --noEmit`          |
| `npm run doctor`                  | `expo-doctor`           |

Os hooks de Git são instalados pelo `npm install` (Husky): `pre-commit` roda `lint-staged`,
`pre-push` roda `typecheck`.

## Documentação

- **[`CLAUDE.md`](CLAUDE.md)** — estrutura de pastas, convenções, padrões de código, regras de
  Clean Code, índice das telas a migrar e decisões em aberto. **Leia antes de contribuir.**
- **[`docs/analise-app-original.md`](docs/analise-app-original.md)** — inventário do app Delphi
  legado: telas, regras de negócio, endpoints, modelos de dados e falhas conhecidas.

## Estado

Migração em andamento. O índice de telas com status fica na seção 6 do `CLAUDE.md`.

> O login ainda não funciona: o contrato de senha com o servidor (MD5 sem salt) está em
> aberto — ver `CLAUDE.md`, seção 7.
