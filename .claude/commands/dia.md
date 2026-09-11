---
description: Levanta as tarefas de hoje e cruza com o plano, o status e o histórico
allowed-tools: Bash(git log:*), Bash(git status:*), Read, Glob, Grep
---

# Tarefas de hoje

Levantamento. **Não escreva código nesta execução** — nem um arquivo, nem uma linha.
O objetivo é sair daqui sabendo o que atacar e por quê.

## 1. De onde vem a lista

Nesta ordem de precedência:

1. O brief de hoje no banco **Morning Handoff** do Notion
   (`collection://7e8fc362-1ee8-4579-96a8-4eb01e2348fe`).
2. Se não houver brief de hoje: as tarefas de Prioridade **Agora** não travadas no banco
   **Tarefas da migração** (`collection://e3231165-a6da-4cc1-8d51-c88b978d4e67`).
3. Se o Isaac disser no que vai trabalhar, isso ganha dos dois.

Se o MCP do Notion não estiver disponível, diga isso em uma linha e peça a lista — não
invente tarefa e não deduza a partir do git.

## 2. Com o que cruzar

Para cada tarefa, junte:

- **A ficha correspondente** em `docs/plano-migracao.md` §3 (A1…F4). Se a tarefa não casar com
  ficha nenhuma, diga isso explicitamente — é sinal de que ou o Notion ou o plano está
  desatualizado, e isso importa mais que a tarefa em si.
- **O status real** em `CLAUDE.md` §6 (⬜ / 🟨 / ✅). O Notion pode mentir; o §6 é o placar.
- **Bloqueio ativo**: `plano-migracao.md` §6. Se a ficha depende de um 🔒 aberto, diga o que
  dá para entregar mesmo assim e o que fica isolado num arquivo só (a regra da §2 do plano).
- **Dívida relacionada**: `CLAUDE.md` §9. Se a ficha encosta numa linha D#, é agora ou nunca.
- `git log --oneline -15` e `git status` — o que já foi commitado e o que ficou sujo na árvore.
  Trabalho não commitado de ontem muda o plano de hoje.

## 3. O que entregar

Uma tabela curta: tarefa · ficha · status §6 · bloqueio · arquivos que ela toca.

Depois, **no máximo três linhas** de leitura: qual é o caminho crítico hoje, o que dá para
fazer em paralelo, e qualquer divergência que você encontrou entre Notion, plano e §6.

Termine perguntando qual ficha atacar primeiro. Não escolha por ele.
