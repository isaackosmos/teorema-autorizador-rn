---
description: Carrega o contexto completo de uma ficha e monta o plano de ataque
argument-hint: '[id da ficha, ex: C2, E1, A4]'
---

# Ficha $1

Uma sessão, uma ficha. Carregue o contexto, monte o plano, **espere a aprovação**.

## 1. Contexto obrigatório

Leia, nesta ordem, e não pule nenhum:

1. **A ficha `$1`** em `docs/plano-migracao.md` §3 — inteira. As três seções importam:
   **Preservar** (regra real do produto), **Corrigir** (o que não se repete do original, com a
   referência da análise) e **Pronto quando** (o aceite).
2. **`CLAUDE.md` §5** — as convenções de código. É o que separa código que compila de código
   que entra neste repositório.
3. **`CLAUDE.md` §2** — camadas e regras de dependência. `shared/` não importa de `features/`;
   uma feature não importa de outra; `app/` só compõe.
4. **`CLAUDE.md` §6**, a linha desta tela — o status atual e o que a nota de rodapé diz.
5. **`CLAUDE.md` §8** — a lista do que **não** migrar. Se a ficha toca uma dessas telas,
   confirme que você não vai reproduzir o defeito.
6. **`CLAUDE.md` §9** — a ficha encosta em alguma dívida D#? Se encosta, decidir agora se paga
   ou se anota. Não deixe implícito.
7. Se a ficha referencia `docs/analise-app-original.md §X`, leia **essa seção**. Não o arquivo
   inteiro — ele é um inventário enorme e o resto não ajuda.
8. Se a ficha está travada por 🔒, leia o `docs/decisao-*.md` correspondente.

Depois disso, leia o código que já existe na vizinhança: a feature irmã mais parecida é o
melhor guia de estilo que este repositório tem. Prefira imitar `features/liberacoes` a inventar.

## 2. O plano

Entregue, antes de tocar em qualquer arquivo:

- **Arquivos a criar ou alterar**, com o caminho completo e uma linha do que cada um faz.
  Respeite a estrutura da §2: `api/` · `schemas/` · `hooks/` · `components/` · `lib/`.
- **Os schemas Zod primeiro** — que payload do Orion entra, que tipo de domínio sai. Nome de
  coluna Firebird não escapa de `schemas/`.
- **Como cada erro é decidido por `ApiError.status`** — quais status, que mensagem.
- **O que fica para `shared/`**, se algo ficar, e por quê.
- **O que esta ficha _não_ vai fazer**, e onde isso vai parar (dívida §9, outra ficha, bloqueio).

## 3. Regras da sessão

- Não invente regra de negócio. O app é **cliente fino**: alçada, nível de autorização, reserva e
  situação de borderô são do Orion. Se a ficha parece exigir uma decisão no dispositivo, pare e
  pergunte — provavelmente é bloqueio de servidor disfarçado.
- Nenhum `setTimeout` de espera artificial (§5.10).
- Onde uma regra veio do Delphi, o comentário cita a origem: `docs/analise §X`.
- Estilo só por `className`, com token semântico.

Ao terminar de implementar, **não commite por conta própria**. Chame `/fechar-ficha $1`.
