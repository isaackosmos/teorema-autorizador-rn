---
description: Fecha a sessão escrevendo o diário do dia em docs/diario/
allowed-tools: Bash(git log:*), Bash(git diff:*), Bash(git status:*), Read, Write, Glob
---

# Diário de hoje

Escreva (ou acrescente a) `docs/diario/AAAA-MM-DD.md`, com a data de hoje.

Isto **não** é um documento de decisão. Os `docs/decisao-*.md` são pesados por bom motivo e só
nascem quando a decisão trava um bloco. O diário é o rascunho: existe para que a decisão pequena
de hoje não seja redescoberta como novidade daqui a três semanas, e para alimentar o brief de
amanhã.

## Fonte

`git log --oneline` desde o último diário, `git diff --stat` e o que aconteceu nesta sessão.
Se a sessão foi curta ou não produziu commit, o diário é curto. Não encha.

## Forma

```md
# AAAA-MM-DD

## Fichas

- **C2** — o que entrou, uma linha. Status resultante no §6.

## Decisões

- O que foi decidido e **por quê**. A razão é a única parte que o diff não guarda.
- Inclui o que foi decidido **não** fazer, e o que ficaria diferente se a premissa mudasse.

## Achados

- O que você descobriu sem procurar: divergência entre plano e código, contrato do Orion
  diferente do esperado, armadilha que custou tempo. Se custou mais de meia hora, entra aqui.

## Amanhã

- O primeiro movimento óbvio. Uma ou duas linhas.
```

## Regras

- Seções vazias somem, não viram "nada a relatar".
- Se uma decisão do diário cresceu a ponto de merecer `docs/decisao-*.md` ou uma linha na §9 do
  `CLAUDE.md`, **diga isso explicitamente** no fim — o diário não é o lugar definitivo dela.
- Não repita o que o commit já diz. Se a linha do diário é o assunto do commit reescrito, apague.
