#!/usr/bin/env node
/**
 * Gera `docs/status.html` a partir do `CLAUDE.md` §6 e do log do git.
 *
 *   node tools/gerar-status-html.mjs [--saida=docs/status.html]
 *
 * Página estática, sem dependência e sem rede: dá para abrir do disco, publicar no
 * GitHub Pages ou anexar num e-mail. É a versão visual do placar — a que o artifact
 * do chat não consegue ser, porque artifact não é endereçável por script.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { lerPlacar } from './lib/placar.mjs';
import { commitsDoPush, shaAtual } from './lib/git.mjs';

const arg = process.argv.slice(2).find((a) => a.startsWith('--saida='));
const saida = new URL(`../${arg ? arg.slice('--saida='.length) : 'docs/status.html'}`, import.meta.url);

const config = JSON.parse(await readFile(new URL('./notion-sync.config.json', import.meta.url), 'utf8'));
const claudeMd = await readFile(new URL('../CLAUDE.md', import.meta.url), 'utf8');
const { telas, infra } = lerPlacar(claudeMd, config);

const commits = commitsDoPush();
const sha = shaAtual();
const agora = new Date();

const NOME_BLOCO = {
  A: 'Identidade e onboarding',
  B: 'Chrome do app e sessão viva',
  C: 'Liberações',
  D: 'Web systems',
  E: 'Notificações e push',
  F: 'Resiliência e qualidade',
};

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const classe = (status) =>
  status.startsWith('✅') ? 'pronto' : status.startsWith('🟨') ? 'andando' : 'parado';
const rotulo = (status) => status.replace(/^[^\s]+\s/, '');

const confirmadas = telas.filter((t) => t.confirmadaOrion).length;
const concluidas = telas.filter((t) => t.status.startsWith('✅')).length;

const porBloco = new Map();
for (const t of telas) {
  if (!porBloco.has(t.bloco)) porBloco.set(t.bloco, []);
  porBloco.get(t.bloco).push(t);
}
const ordem = ['A', 'B', 'C', 'D', 'E'];
const blocosOrdenados = [...porBloco.entries()].sort(
  ([a], [b]) => ordem.indexOf(a) - ordem.indexOf(b),
);

const barra = (itens) => {
  const conta = (p) => itens.filter((i) => classe(i.status) === p).length;
  const total = itens.length || 1;
  return ['pronto', 'andando', 'parado']
    .map((p) => {
      const n = conta(p);
      return n ? `<span class="fatia ${p}" style="flex:${n}" title="${n} ${p}"></span>` : '';
    })
    .join('');
};

const linhaTela = (t) => `
        <tr>
          <td class="num">${t.num}</td>
          <td>
            <div class="nome">${esc(t.nome)}</div>
            ${t.observacao ? `<div class="obs">${esc(t.observacao)}</div>` : ''}
          </td>
          <td><code>${esc(t.rota)}</code></td>
          <td><span class="selo ${classe(t.status)}">${esc(rotulo(t.status))}</span></td>
          <td class="orion">${t.confirmadaOrion ? 'sim' : '—'}</td>
        </tr>`;

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Placar da migração — Teorema Autorizador</title>
<style>
  :root {
    --fundo: #131a24;
    --superficie: #1a2331;
    --linha: #273244;
    --tinta: #e7edf4;
    --calada: #8b9bb0;
    --pronto: #48b98a;
    --andando: #d9a544;
    --parado: #5d6b7e;
    --alerta: #d9605a;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --fundo: #f6f7f9; --superficie: #ffffff; --linha: #dfe4ea;
      --tinta: #1a2331; --calada: #5d6b7e;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 3rem 1.5rem 5rem;
    background: var(--fundo); color: var(--tinta);
    font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif;
  }
  main { max-width: 68rem; margin: 0 auto; }
  h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 .25rem; letter-spacing: -.01em; }
  .sub { color: var(--calada); margin: 0 0 3rem; font-size: .95rem; }
  .placar { display: flex; align-items: baseline; gap: .75rem; margin: 0 0 .5rem; }
  .placar b { font-size: 3.5rem; font-weight: 650; line-height: 1; font-variant-numeric: tabular-nums; }
  .placar span { color: var(--calada); }
  .ressalva {
    border-left: 3px solid var(--alerta); padding: .75rem 0 .75rem 1rem;
    margin: 1.5rem 0 3rem; color: var(--calada); max-width: 60ch;
  }
  section { margin-bottom: 2.5rem; }
  .cabeca { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; margin-bottom: .5rem; }
  h2 { font-size: 1rem; font-weight: 600; margin: 0; }
  h2 em { font-style: normal; color: var(--calada); font-weight: 400; }
  .trilha { display: flex; gap: 2px; height: 4px; margin-bottom: 1rem; }
  .fatia { border-radius: 2px; }
  .fatia.pronto { background: var(--pronto); }
  .fatia.andando { background: var(--andando); }
  .fatia.parado { background: var(--parado); }
  table { width: 100%; border-collapse: collapse; background: var(--superficie); border: 1px solid var(--linha); border-radius: 6px; overflow: hidden; }
  th, td { text-align: left; padding: .7rem .9rem; border-bottom: 1px solid var(--linha); vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  th { font-size: .78rem; font-weight: 500; color: var(--calada); }
  .num, .orion { font-variant-numeric: tabular-nums; color: var(--calada); width: 3rem; }
  .nome { font-weight: 500; }
  .obs { color: var(--calada); font-size: .85rem; margin-top: .15rem; max-width: 46ch; }
  code { font: .82rem/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--calada); }
  .selo { font-size: .78rem; padding: .15rem .5rem; border-radius: 4px; white-space: nowrap; }
  .selo.pronto { background: color-mix(in srgb, var(--pronto) 18%, transparent); color: var(--pronto); }
  .selo.andando { background: color-mix(in srgb, var(--andando) 18%, transparent); color: var(--andando); }
  .selo.parado { background: color-mix(in srgb, var(--parado) 22%, transparent); color: var(--calada); }
  ul.commits { list-style: none; padding: 0; margin: 0; }
  ul.commits li { padding: .4rem 0; border-bottom: 1px solid var(--linha); font-size: .9rem; }
  ul.commits code { margin-right: .6rem; }
  footer { color: var(--calada); font-size: .82rem; border-top: 1px solid var(--linha); padding-top: 1rem; margin-top: 3rem; }
</style>
</head>
<body>
<main>
  <h1>Placar da migração</h1>
  <p class="sub">Teorema Autorizador — Delphi/FMX para React Native</p>

  <div class="placar">
    <b>${confirmadas}</b><span>de ${telas.length} telas confirmadas contra um Orion real</span>
  </div>
  <div class="placar" style="margin-bottom:0">
    <b style="font-size:1.6rem">${concluidas}</b><span>concluídas no código, verificadas por <code>lint</code> e <code>typecheck</code></span>
  </div>

  <p class="ressalva">
    O número que importa é o primeiro. Sem o login aceitar o contrato novo não há JWT, e sem JWT
    nenhuma tela de tenant recebeu payload de verdade. Quando o login cair, reverificar os blocos
    A, B e C com dado real é a primeira coisa a fazer.
  </p>

${blocosOrdenados
  .map(
    ([bloco, itens]) => `  <section>
    <div class="cabeca">
      <h2>Bloco ${bloco} <em>${esc(NOME_BLOCO[bloco] ?? '')}</em></h2>
      <span class="sub" style="margin:0">${itens.filter((i) => i.status.startsWith('✅')).length}/${itens.length}</span>
    </div>
    <div class="trilha">${barra(itens)}</div>
    <table>
      <thead><tr><th>#</th><th>Tela</th><th>Rota</th><th>Situação</th><th>Orion</th></tr></thead>
      <tbody>${itens.sort((a, b) => a.num - b.num).map(linhaTela).join('')}
      </tbody>
    </table>
  </section>`,
  )
  .join('\n')}

  <section>
    <div class="cabeca">
      <h2>Infraestrutura transversal</h2>
      <span class="sub" style="margin:0">${infra.filter((i) => i.status.startsWith('✅')).length}/${infra.length}</span>
    </div>
    <div class="trilha">${barra(infra)}</div>
    <table>
      <thead><tr><th>Item</th><th>Situação</th></tr></thead>
      <tbody>${infra
        .map(
          (i) => `
        <tr>
          <td>
            <div class="nome">${esc(i.nome)}</div>
            ${i.observacao ? `<div class="obs">${esc(i.observacao)}</div>` : ''}
          </td>
          <td><span class="selo ${classe(i.status)}">${esc(rotulo(i.status))}</span></td>
        </tr>`,
        )
        .join('')}
      </tbody>
    </table>
  </section>

${
  commits.length
    ? `  <section>
    <div class="cabeca"><h2>Último push</h2><span class="sub" style="margin:0">${commits.length} commit(s)</span></div>
    <ul class="commits">${commits
      .slice(0, 20)
      .map(
        (c) =>
          `\n      <li><code>${esc(c.curto)}</code>${esc(c.assunto)}</li>`,
      )
      .join('')}
    </ul>
  </section>`
    : ''
}

  <footer>
    Gerado de <code>CLAUDE.md</code> §6 em ${agora.toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })}${sha ? ` · <code>${esc(sha.slice(0, 7))}</code>` : ''}.
    A fonte de verdade é o repositório: se esta página discordar do <code>CLAUDE.md</code>, ela está velha.
  </footer>
</main>
</body>
</html>
`;

await mkdir(dirname(saida.pathname), { recursive: true });
await writeFile(saida, html, 'utf8');
console.log(`docs/status.html gerado — ${confirmadas}/${telas.length} confirmadas, ${concluidas} concluídas no código.`);
