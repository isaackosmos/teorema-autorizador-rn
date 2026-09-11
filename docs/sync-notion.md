# Sync do placar com o Notion

O `CLAUDE.md` §6 é a fonte de verdade. O Notion e o `docs/status.html` são espelhos
escritos por script a cada push. Nada volta do Notion para o repositório: se os dois
discordarem, o repositório está certo e o Notion está velho — e o próximo push conserta.

## Instalar (uma vez)

1. **Integração no Notion.** Em notion.so/my-integrations, crie uma integração interna e
   copie o token (`ntn_…`).
2. **Dar acesso à página.** Na página _Teorema Autorizador — Migração para React Native_,
   menu `···` › Conexões › adicione a integração. As databases filhas herdam o acesso.
3. **Segredo no GitHub.** Settings › Secrets and variables › Actions › `NOTION_TOKEN`.
4. **Ligar as tabelas dos toggles.** Dentro de cada toggle de bloco (A a F), apague a tabela
   estática e digite `/linked`, escolha _Telas e infraestrutura_ e filtre por `Bloco`. É a
   única etapa manual, e é uma vez só.
5. **Testar sem escrever:** `NOTION_TOKEN=ntn_… node tools/sync-notion.mjs --dry-run`.

## O contrato que o script assume

- **§6 é tabela Markdown regular.** Coluna `#` numérica, coluna `Status` começando com
  `✅`, `🟨` ou `⬜`. Se a forma mudar, o sync **falha** em vez de escrever dado errado.
- **17 telas.** Cresceu o índice? Ajuste `BLOCO_POR_TELA` em `tools/lib/placar.mjs` e crie a
  linha correspondente na database, com a `Chave` `tela-N`. O script nunca cria linha sozinho.
- **Linha nova de infraestrutura** precisa de uma entrada em `mapaInfra`, no
  `tools/notion-sync.config.json` — casada por prefixo, sem acento.
- **`[orion-ok]`** na coluna Status da §6 marca a tela como exercitada contra um Orion real.
  É o marcador que move o contador do topo da página. Enquanto ninguém escrever isso, o
  placar continua honesto em `0 de 17`.
- **Tarefas** só têm o Status mexido se a relação **Linha do placar** estiver preenchida.
  Tarefa sem relação fica 100% na sua mão.

## O que o script escreve

| Alvo                              | O quê                                                |
| --------------------------------- | ---------------------------------------------------- |
| Database _Telas e infraestrutura_ | status, observação, rota, origem, checkbox do Orion  |
| Contadores do topo da página      | `N de 17` e `N abertos`, achados por padrão no texto |
| Callout do topo                   | a data de "Atualizado a partir do repositório em …"  |
| Database _Tarefas da migração_    | Status das tarefas ligadas a uma linha do placar     |
| Database _Morning Brief_          | a página do dia, com os commits do push              |
| `docs/status.html`                | o placar inteiro, comitado de volta com `[skip ci]`  |

Prosa não é tocada: todo o texto explicativo da página é humano e fica onde está.

## O que ele não faz

- Não apaga linha nem página. Remoção é decisão sua, feita na mão.
- Não escreve nos _Bloqueios externos_ — só lê para contar os abertos e achar o mais quente.
  Abrir e fechar bloqueio é conversa com o time, não consequência de um commit.
- Não gera prosa por IA. O Morning Brief sai do `git log` e do placar, sem modelo no meio.
