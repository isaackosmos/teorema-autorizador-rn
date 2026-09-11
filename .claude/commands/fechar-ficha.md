---
description: Roda os portões, confere o critério de pronto, atualiza o §6 e commita com trailer
argument-hint: '[id da ficha, ex: C2, E1]'
---

# Fechar a ficha $1

Em ordem. Se um passo falhar, **pare nele** — não siga para o commit consertando de qualquer jeito.

## 1. Portões

```bash
npm run typecheck && npm run lint
```

Os dois, sobre o projeto inteiro. O `pre-commit` só olha os arquivos staged e o `pre-push` só roda
o `typecheck` — nenhum dos dois substitui isto.

Se houver runner de teste instalado, rode a suíte também.

## 2. Revisão

Chame o subagente **revisor** (`@revisor`) com o diff desta ficha. Ele tem contexto próprio e o
critério de pronto na cabeça; você está contaminado pelo que acabou de escrever.

Traga o veredito dele para cá. **Desvio apontado se resolve antes do commit**, não vira dívida por
conveniência — dívida é decisão consciente registrada na §9, não achado ignorado.

## 3. Critério de pronto — item por item

Percorra a §5 do `docs/plano-migracao.md` e responda cada um com evidência (arquivo e linha), não
com "sim":

1. Rota em `src/app/` só **compõe** — zero `axios`, zero regra.
2. Feature com `api/` + `schemas/` + `hooks/`; tipo de domínio derivado de `z.output`.
3. Payload traduzido no schema; nome de coluna Firebird não sai de `schemas/`.
4. Todo erro decidido por `ApiError.status`.
5. Formulário = React Hook Form + Zod; validação só no schema.
6. Estilo só por `className`, com token semântico.
7. `lint` e `typecheck` limpos.
8. Regra vinda do Delphi com comentário citando `docs/analise §X`.
9. Linha do `CLAUDE.md §6` atualizada **no mesmo commit**.

## 4. Atualizar o placar

Edite a linha desta tela no `CLAUDE.md` §6:

- **✅** só quando todos os nove passam.
- **🟨** quando o app fez a parte dele e o que falta é de fora (servidor, HTML de terceiro,
  decisão do time). Nesse caso, **escreva a nota de rodapé** dizendo exatamente o que falta e de
  quem é — do jeito que as notas ¹ e ² já fazem.
- Se a ficha resolveu ou criou dívida, atualize a §9 junto.
- Se derrubou um 🔒, atualize a §7 do `CLAUDE.md` e a §6 do plano, com a data.

Vale a ressalva de sempre: se não foi verificado contra Orion real, o ✅ é "conforme o critério",
não "confirmado com dado real". Não escreva o que não foi verificado.

## 5. Commit

Mensagem no formato do `CLAUDE.md §10`. Assunto no imperativo, em português, até 72 caracteres.
Corpo explicando **por que**, não o que o diff já mostra. E os trailers, que é o que a automação lê:

```
<tipo>(<escopo>): <assunto>

<corpo: a decisão e a razão dela>

Ficha: $1
Notion-ID: <id da página da tarefa no banco Tarefas da migração>
Status: <pronto | parcial>
```

- `Status: pronto` só se o §6 virou ✅. Se virou 🟨, é `parcial`.
- O `Notion-ID` vem da tarefa correspondente no banco
  `collection://e3231165-a6da-4cc1-8d51-c88b978d4e67`. Se não houver tarefa correspondente,
  **omita o trailer** — trailer com id inventado quebra a automação de forma silenciosa, que é a
  pior forma de quebrar.
- Nunca `--no-verify`.

## 6. Reportar

Três linhas para o Isaac: o que entrou, como ficou o §6, e o que ficou pendente (dívida nova,
bloqueio, ficha seguinte). Nada além disso — o diff está no commit.
