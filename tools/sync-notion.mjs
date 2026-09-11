#!/usr/bin/env node
/**
 * Sincroniza o placar do repositório com o espaço do Notion.
 *
 *   node tools/sync-notion.mjs [--dry-run] [--sem-brief]
 *
 * Direção única: **o repositório manda**. O `CLAUDE.md` §6 é lido, o Notion é escrito.
 * Nada volta do Notion para o repo — se os dois discordarem, o Notion está velho, e
 * este script conserta o Notion.
 *
 * O que escreve:
 *   1. as linhas da database "Telas e infraestrutura" (status, observação, rota, bloqueio);
 *   2. os dois contadores do topo da página do projeto ("N de 17", "N abertos");
 *   3. a data do callout "Atualizado a partir do repositório em DD/MM/AAAA";
 *   4. o Status das tarefas que têm a relação "Linha do placar" preenchida;
 *   5. a página do dia no Morning Brief, com os commits do push.
 *
 * O que **não** escreve: prosa. Todo texto explicativo da página é humano e fica onde está.
 */

import { readFile } from 'node:fs/promises';
import { appendFileSync } from 'node:fs';
import { lerPlacar } from './lib/placar.mjs';
import { commitsDoPush, arquivosDoPush } from './lib/git.mjs';
import * as n from './lib/notion.mjs';

const ARGS = new Set(process.argv.slice(2));
const DRY = ARGS.has('--dry-run');
const SEM_BRIEF = ARGS.has('--sem-brief');

const config = JSON.parse(await readFile(new URL('./notion-sync.config.json', import.meta.url), 'utf8'));
const claudeMd = await readFile(new URL('../CLAUDE.md', import.meta.url), 'utf8');

const relatorio = [];
const anotar = (linha) => {
  relatorio.push(linha);
  console.log(linha);
};

/* ---------------------------------------------------------------- 1. placar */

const { telas, infra, naoMapeados } = lerPlacar(claudeMd, config);
if (naoMapeados.length) {
  anotar(
    `⚠️ Linhas de infraestrutura da §6 sem destino no Notion (adicione em mapaInfra): ${naoMapeados.join(' · ')}`,
  );
}

const doRepo = new Map();
for (const t of telas) {
  doRepo.set(t.chave, {
    Tela: n.titulo(t.nome),
    Num: n.numero(t.num),
    Bloco: n.select(t.bloco),
    Status: n.select(t.status),
    Rota: n.texto(t.rota),
    'Origem no Delphi': n.texto(t.origem),
    Observação: n.texto(t.observacao),
    'Confirmada com Orion real': n.checkbox(t.confirmadaOrion),
    _status: t.status,
    _rotulo: `tela ${t.num} — ${t.nome}`,
  });
}
for (const i of infra) {
  doRepo.set(i.chave, {
    Tela: n.titulo(i.nome),
    Status: n.select(i.status),
    Observação: n.texto(i.observacao),
    'Confirmada com Orion real': n.checkbox(i.confirmadaOrion),
    _status: i.status,
    _rotulo: i.nome,
  });
}

/* ------------------------------------------------- 2. linhas da database Telas */

const linhas = await n.consultarDatabase(config.databases.telas);
const porChave = new Map(linhas.map((l) => [n.lerTexto(l.properties.Chave), l]));

const hoje = new Date().toISOString().slice(0, 10);
const fecharam = [];
const semLinha = [];
let escritas = 0;

for (const [chave, desejado] of doRepo) {
  const linha = porChave.get(chave);
  if (!linha) {
    semLinha.push(chave);
    continue;
  }

  const atual = linha.properties;
  const statusAntigo = n.lerSelect(atual.Status);
  const mudou =
    statusAntigo !== desejado._status ||
    n.lerTexto(atual.Observação) !== n.textoDe(desejado.Observação.rich_text) ||
    n.lerTexto(atual.Tela) !== n.textoDe(desejado.Tela.title) ||
    (desejado.Rota && n.lerTexto(atual.Rota) !== n.textoDe(desejado.Rota.rich_text)) ||
    n.lerCheckbox(atual['Confirmada com Orion real']) !==
      desejado['Confirmada com Orion real'].checkbox;

  if (!mudou) continue;

  if (statusAntigo !== '✅ concluído' && desejado._status === '✅ concluído') {
    fecharam.push(desejado._rotulo);
  }

  const { _status, _rotulo, ...props } = desejado;
  props['Sincronizado em'] = n.data(hoje);

  anotar(`↻ ${_rotulo}: ${statusAntigo ?? '—'} → ${_status}`);
  if (!DRY) await n.atualizarPagina(linha.id, props);
  escritas += 1;
}

if (semLinha.length) {
  anotar(
    `⚠️ Sem linha no Notion para: ${semLinha.join(' · ')}. Crie a linha com essa Chave — o sync não cria linha sozinho de propósito.`,
  );
}
if (escritas === 0) anotar('Nenhuma linha mudou desde o último sync.');

/* ------------------------------------------------------- 3. bloqueios abertos */

const bloqueios = await n.consultarDatabase(config.databases.bloqueios);
const abertos = bloqueios.filter((b) => n.lerSelect(b.properties['Situação']) !== 'Decidido');
const maisQuente = [...abertos].sort(
  (a, b) =>
    (n.lerNumero(a.properties['Prioridade de ataque']) ?? 99) -
    (n.lerNumero(b.properties['Prioridade de ataque']) ?? 99),
)[0];
const codigoMaisQuente = maisQuente ? n.lerSelect(maisQuente.properties['Código']) : null;

/* ----------------------------------- 4. contadores e data na página do projeto */

const totalTelas = telas.length;
const confirmadas = telas.filter((t) => t.confirmadaOrion).length;

const blocos = await n.percorrerBlocos(config.paginaProjeto);
let contadoresEscritos = 0;

for (const bloco of blocos) {
  // Contador "N de 17" e "N abertos" — heading_2 dentro das colunas do topo.
  if (bloco.type === 'heading_2') {
    const texto = n.textoDe(bloco.heading_2.rich_text);
    let novo = null;
    if (/^\d+\s+de\s+\d+$/.test(texto)) novo = `${confirmadas} de ${totalTelas}`;
    else if (/^\d+\s+abertos?$/.test(texto)) novo = `${abertos.length} ${abertos.length === 1 ? 'aberto' : 'abertos'}`;
    if (novo && novo !== texto) {
      anotar(`↻ contador: "${texto}" → "${novo}"`);
      if (!DRY) {
        await n.substituirBloco(bloco.id, {
          heading_2: {
            rich_text: [
              {
                type: 'text',
                text: { content: novo },
                annotations: bloco.heading_2.rich_text[0]?.annotations,
              },
            ],
            color: bloco.heading_2.color,
          },
        });
      }
      contadoresEscritos += 1;
    }
  }

  // Data do callout do topo. Troca só o pedaço da data, preservando o resto do rich_text.
  if (bloco.type === 'callout') {
    const rt = bloco.callout.rich_text ?? [];
    const padrao = /Atualizado a partir do repositório em \d{2}\/\d{2}\/\d{4}/;
    const alvo = rt.findIndex((t) => padrao.test(t.plain_text ?? ''));
    if (alvo >= 0) {
      const [ano, mes, dia] = hoje.split('-');
      const novoTrecho = `Atualizado a partir do repositório em ${dia}/${mes}/${ano}`;
      if (!padrao.exec(rt[alvo].plain_text)[0].endsWith(`${dia}/${mes}/${ano}`)) {
        anotar(`↻ data do callout → ${dia}/${mes}/${ano}`);
        if (!DRY) {
          await n.substituirBloco(bloco.id, {
            callout: {
              rich_text: rt.map((t, i) =>
                i === alvo
                  ? {
                      type: 'text',
                      text: { content: t.plain_text.replace(padrao, novoTrecho) },
                      annotations: t.annotations,
                    }
                  : { type: 'text', text: { content: t.plain_text ?? '' }, annotations: t.annotations },
              ),
              icon: bloco.callout.icon,
              color: bloco.callout.color,
            },
          });
        }
        contadoresEscritos += 1;
      }
    }
  }
}

/* ------------------------------- 5. tarefas ligadas a uma linha do placar */

/**
 * As duas databases não são a mesma coisa: uma tarefa é unidade de trabalho (várias
 * por tela, com "Pronto quando" e Fase), a linha do placar é o status da tela. O que
 * as liga é a relação "Linha do placar" — e o sync só mexe no Status de tarefa que
 * **tem** essa relação preenchida. Tarefa sem relação continua 100% na sua mão.
 */
const statusPorPagina = new Map();
for (const [chave, desejado] of doRepo) {
  const linha = porChave.get(chave);
  if (linha) statusPorPagina.set(linha.id, { status: desejado._status, rotulo: desejado._rotulo });
}

const traduzirStatus = (statusPlacar, temBloqueio) => {
  if (statusPlacar === '✅ concluído') return 'Concluída';
  if (statusPlacar === '🟨 em andamento') return temBloqueio ? 'Travada' : 'Em andamento';
  return 'Pendente';
};

const tarefas = await n.consultarDatabase(config.databases.tarefas);
let tarefasEscritas = 0;

for (const tarefa of tarefas) {
  const ligacao = tarefa.properties['Linha do placar']?.relation ?? [];
  if (ligacao.length === 0) continue;

  const placar = statusPorPagina.get(ligacao[0].id);
  if (!placar) continue;

  const temBloqueio = (tarefa.properties.Bloqueio?.relation ?? []).length > 0;
  const alvo = traduzirStatus(placar.status, temBloqueio);
  const atualStatus = n.lerSelect(tarefa.properties.Status);
  if (atualStatus === alvo) continue;

  const props = { Status: n.select(alvo) };
  if (alvo === 'Concluída' && !tarefa.properties['Concluída em']?.date) {
    props['Concluída em'] = n.data(hoje);
  }

  anotar(`↻ tarefa "${n.lerTexto(tarefa.properties.Tarefa)}": ${atualStatus ?? '—'} → ${alvo}`);
  if (!DRY) await n.atualizarPagina(tarefa.id, props);
  tarefasEscritas += 1;
}

if (tarefasEscritas === 0) anotar('Nenhuma tarefa ligada ao placar mudou de status.');

/* ------------------------------------------------------- 6. Morning Brief do dia */

const commits = commitsDoPush();
const arquivos = arquivosDoPush();

if (!SEM_BRIEF) {
  const jaExiste = (
    await n.consultarDatabase(config.databases.morningBrief, {
      property: 'Data',
      date: { equals: hoje },
    })
  )[0];

  const proximo =
    telas.find((t) => t.status === '🟨 em andamento') ??
    telas.find((t) => t.status === '⬜ pendente') ??
    infra.find((i) => i.status !== '✅ concluído');
  const foco = proximo ? `${proximo.nome} — ${proximo.observacao || 'sem observação na §6'}`.slice(0, 200) : 'Placar limpo';

  const opcoesDeBloqueio = ['B1', 'B2', 'B3', 'B4', 'B5', 'B7', 'Nenhum'];
  const props = {
    Dia: n.titulo(new Date(`${hoje}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })),
    Data: n.data(hoje),
    'Fechou ontem': n.numero(fecharam.length),
    'Foco de hoje': n.texto(foco),
    'Divergência com o repositório': n.checkbox(semLinha.length > 0 || naoMapeados.length > 0),
    ...(opcoesDeBloqueio.includes(codigoMaisQuente ?? '')
      ? { 'Bloqueio mais quente': n.select(codigoMaisQuente) }
      : {}),
  };

  const paragrafo = (conteudo) => ({
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: [{ type: 'text', text: { content: conteudo.slice(0, 1900) } }] },
  });
  const item = (conteudo) => ({
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: { rich_text: [{ type: 'text', text: { content: conteudo.slice(0, 1900) } }] },
  });

  const corpo = [
    paragrafo(
      fecharam.length
        ? `Fechou: ${fecharam.join(' · ')}.`
        : 'Nenhuma linha do placar passou para concluído neste push.',
    ),
    ...(commits.length
      ? [paragrafo(`${commits.length} commit(s) neste push:`), ...commits.slice(0, 25).map((c) => item(`${c.curto} ${c.assunto}`))]
      : [paragrafo('Sem commits no intervalo — sync rodado à mão.')]),
    ...(arquivos.length
      ? [paragrafo(`Áreas tocadas: ${[...new Set(arquivos.map((a) => a.split('/').slice(0, 2).join('/')))].slice(0, 12).join(' · ')}`)]
      : []),
    paragrafo(`Foco de hoje: ${foco}`),
  ];

  if (jaExiste) {
    anotar(`↻ Morning Brief de ${hoje} já existe — atualizando propriedades e anexando o push.`);
    if (!DRY) {
      await n.atualizarPagina(jaExiste.id, props);
      await n.anexarBlocos(jaExiste.id, corpo);
    }
  } else {
    anotar(`+ Morning Brief de ${hoje}`);
    if (!DRY) {
      await n.criarPagina({
        parent: { database_id: config.databases.morningBrief },
        properties: props,
        children: corpo,
      });
    }
  }
}

/* ----------------------------------------------------------------- 7. relatório */

anotar(
  `\nPlacar: ${confirmadas}/${totalTelas} telas confirmadas com Orion real · ` +
    `${telas.filter((t) => t.status === '✅ concluído').length} concluídas no código · ` +
    `${abertos.length} bloqueio(s) aberto(s)${codigoMaisQuente ? ` (mais quente: ${codigoMaisQuente})` : ''}`,
);
if (DRY) anotar('\n--dry-run: nada foi escrito no Notion.');

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### Sync do Notion\n\n${relatorio.map((l) => `- ${l}`).join('\n')}\n`,
  );
}
