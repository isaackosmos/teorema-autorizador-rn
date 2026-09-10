/**
 * Replay HTTP do fluxo completo do app contra um Orion real, usando os
 * **schemas de `src/`** — os mesmos que as telas usam.
 *
 * Para que serve: confirmar (ou derrubar) os ✅ do CLAUDE.md §6 que até hoje só
 * foram verificados por leitura de código e pelos portões estáticos. Um desvio
 * de contrato do Orion estoura aqui no mesmo Zod em que estouraria no app.
 *
 * O que ele NÃO cobre: renderização. A regressão das telas em branco (o
 * `queryState` sempre-verdadeiro do §4.6) é bug de árvore React e só se
 * confirma com o app rodando no aparelho — este probe não a toca.
 *
 *   node --import ./tools/ts-alias-hook.mjs tools/probe-orion.mjs \
 *     --documento=00000000000000 --usuario=FULANO --senha=... [--reservar]
 *
 * Sem `--reservar` o probe é somente-leitura. Ele **nunca** autoriza nem
 * reprova: decisão é dinheiro e não se dispara por engano.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

import {
  loginResponseSchema,
  enderecosServidorSchema,
  empresaLicenciadaSchema,
  baseDadosListSchema,
} from '@/features/auth/schemas/auth.schema';
import { empresaListSchema } from '@/features/empresa/schemas/empresa.schema';
import {
  liberacaoSchema,
  liberacaoListSchema,
  SituacaoLiberacao,
} from '@/features/liberacoes/schemas/liberacao.schema';
import {
  analiseCreditoSchema,
  historicoComprasSchema,
} from '@/features/liberacoes/schemas/cliente.schema';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SAIDA = path.join(RAIZ, '.probe-orion');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [chave, ...valor] = a.replace(/^--/, '').split('=');
    return [chave, valor.length ? valor.join('=') : true];
  }),
);

function lerEnv() {
  const env = {};
  for (const linha of readFileSync(path.join(RAIZ, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(linha.trim());
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = lerEnv();
let houveDivergencia = false;

function anotar(passo, status, detalhe) {
  const marca = { ok: 'OK      ', divergiu: 'DIVERGIU', pulado: 'PULADO  ' }[status];
  console.log(`${marca} ${passo}${detalhe ? ` — ${detalhe}` : ''}`);
  if (status === 'divergiu') houveDivergencia = true;
}

function salvarBruto(nome, dado) {
  mkdirSync(SAIDA, { recursive: true });
  writeFileSync(path.join(SAIDA, `${nome}.json`), JSON.stringify(dado, null, 2), 'utf8');
}

async function pedir(url, { metodo = 'GET', corpo, headers = {}, timeout = 30000 } = {}) {
  const resposta = await fetch(url, {
    method: metodo,
    headers: {
      ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(timeout),
  });
  const texto = await resposta.text();
  let json = null;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    json = null;
  }
  return { status: resposta.status, json, texto };
}

/**
 * Os dois endpoints do central respondem **200 com `{}`** quando o documento
 * não tem licença — `getserverurl` inclusive, que nem filtra por `systemcode`.
 * A borda traduz os dois para `ApiError` 404 (§4.1, analise §7.1.3), então o
 * probe precisa relatar os dois do mesmo jeito.
 */
const SEM_REGISTRO_NO_CENTRAL =
  'sem licença/endereço para o documento — a borda traduz para ApiError 404 (§4.1)';

function recorte(corpo, limite = 300) {
  if (corpo === null || corpo === undefined) return '(sem corpo)';
  const texto = typeof corpo === 'string' ? corpo : JSON.stringify(corpo);
  return texto.length > limite ? `${texto.slice(0, limite)}…` : texto;
}

/** `{}` ou corpo ausente. Array vazio **não** conta: lista sem itens é dado. */
function corpoVazio(json) {
  if (json === null || json === undefined) return true;
  return typeof json === 'object' && !Array.isArray(json) && Object.keys(json).length === 0;
}

/**
 * Status fora de 2xx nunca chega ao Zod: o corpo ali é envelope de erro, não
 * payload. Sem esta guarda, um `{erro: …}` do servidor é relatado como
 * "payload recusado pelo schema", que lê como desvio de contrato do Orion
 * quando na verdade é falha de autenticação ou de configuração.
 */
function respostaUtilizavel(passo, resposta) {
  if (resposta.status >= 200 && resposta.status < 300) return true;
  anotar(
    passo,
    'divergiu',
    `HTTP ${resposta.status} — corpo cru: ${recorte(resposta.json ?? resposta.texto)}`,
  );
  return false;
}

/** Roda um schema real e reporta o desvio no formato do próprio Zod. */
function validar(passo, schema, dado, resumo) {
  const r = schema.safeParse(dado);
  if (r.success) {
    anotar(passo, 'ok', resumo?.(r.data));
    return r.data;
  }
  anotar(
    passo,
    'divergiu',
    `payload recusado pelo schema do app: ${JSON.stringify(r.error.issues.slice(0, 6))}`,
  );
  return null;
}

/**
 * Etapa completa: status → corpo vazio → schema. Só o que sobrevive às duas
 * guardas é payload de verdade, e só aí uma reclamação do Zod significa
 * divergência de contrato.
 *
 * `vazioEsperado` liga o caso do corpo vazio **conhecido** e é opt-in de
 * propósito: em `auth/setup` e `companyfromuser` a resposta é lista, e lista
 * sem itens tem de passar pelo schema como qualquer outra.
 */
function validarResposta(passo, schema, resposta, { resumo, vazioEsperado } = {}) {
  if (!respostaUtilizavel(passo, resposta)) return null;

  if (vazioEsperado && corpoVazio(resposta.json)) {
    anotar(passo, 'ok', `${resposta.status} com {} — ${vazioEsperado}`);
    return null;
  }

  return validar(passo, schema, resposta.json, resumo);
}

/** Captura os `console.warn` do fallback de situação — o ponto D2. */
function comWarnsCapturados(fn) {
  const original = console.warn;
  const warns = [];
  console.warn = (...a) => warns.push(a.join(' '));
  try {
    return { resultado: fn(), warns };
  } finally {
    console.warn = original;
  }
}

/** Onboarding: licença, endereços, ping, bases, login, empresas. */
async function blocoA(digitos, usuario, senha) {
  const central = env.EXPO_PUBLIC_CENTRAL_API_URL;
  const auth = { Authorization: `Bearer ${env.EXPO_PUBLIC_CENTRAL_API_TOKEN}` };

  const info = await pedir(
    `${central}/v1/application/companyinformation` +
      `?document=${encodeURIComponent(digitos)}` +
      `&systemcode=${encodeURIComponent(env.EXPO_PUBLIC_SYSTEM_CODE)}`,
    { headers: auth },
  );
  salvarBruto('companyinformation', { status: info.status, corpo: info.json ?? info.texto });

  if (info.status === 401) {
    anotar(
      'A · companyinformation',
      'divergiu',
      '401 — EXPO_PUBLIC_CENTRAL_API_TOKEN inválido no .env.local. O fluxo para aqui.',
    );
    return null;
  }
  validarResposta('A · companyinformation', empresaLicenciadaSchema, info, {
    resumo: (d) => `empresa licenciada ${d.code}/${d.id}`,
    vazioEsperado: SEM_REGISTRO_NO_CENTRAL,
  });

  const urls = await pedir(
    `${central}/v1/application/getserverurl?document=${encodeURIComponent(digitos)}`,
    { headers: auth },
  );
  salvarBruto('getserverurl', { status: urls.status, corpo: urls.json ?? urls.texto });
  const enderecos = validarResposta('A · getserverurl', enderecosServidorSchema, urls, {
    resumo: (d) =>
      `primário ${d.primary}${d.secondary ? ` · secundário ${d.secondary}` : ' · sem secundário'}`,
    vazioEsperado: SEM_REGISTRO_NO_CENTRAL,
  });
  if (!enderecos) {
    anotar(
      'A · fluxo do tenant',
      'pulado',
      'sem endereço de servidor: ping, auth/setup, login, companyfromuser e todo o Bloco C não executam',
    );
    return null;
  }

  const base = await escolherBase(enderecos);
  if (!base) return null;

  const setup = await pedir(`${base}/v1/auth/setup/${digitos}`);
  salvarBruto('setup', { status: setup.status, corpo: setup.json ?? setup.texto });
  const bases = validarResposta('A · auth/setup (bancos)', baseDadosListSchema, setup, {
    resumo: (d) => `${d.length} base(s)`,
  });
  const tokenDatabase = bases?.[0]?.token ?? null;

  // O primeiro login omite `registerid` de propósito (analise §3.1).
  const entrada = await pedir(`${base}/v1/auth/login`, {
    metodo: 'POST',
    corpo: { username: usuario, password: senha },
    headers: tokenDatabase ? { tokendatabase: tokenDatabase } : {},
  });
  salvarBruto('login', { status: entrada.status, corpo: entrada.json ?? entrada.texto });
  const sessao = validarResposta('A · login (TOKEN → jwt)', loginResponseSchema, entrada, {
    resumo: (d) => `usuário ${d.code} (${d.name || 'sem nome'}), deviceStatus ${d.deviceStatus}`,
  });
  if (!sessao) {
    anotar('A · sessão', 'pulado', 'sem JWT: companyfromuser e todo o Bloco C não executam');
    return null;
  }

  const comSessao = {
    Authorization: `Bearer ${sessao.jwt}`,
    ...(tokenDatabase ? { tokendatabase: tokenDatabase } : {}),
  };

  const emp = await pedir(`${base}/v1/application/companyfromuser/${sessao.code}`, {
    headers: comSessao,
  });
  salvarBruto('companyfromuser', { status: emp.status, corpo: emp.json ?? emp.texto });
  validarResposta('A · companyfromuser', empresaListSchema, emp, {
    resumo: (d) => `${d.length} empresa(s)`,
  });

  return { base, sessao, comSessao };
}

/** Primário, depois secundário — o mesmo fallback do onboarding (A3). */
async function escolherBase(enderecos) {
  for (const [rotulo, url] of [
    ['primário', enderecos.primary],
    ['secundário', enderecos.secondary],
  ]) {
    if (!url) continue;
    try {
      const ping = await pedir(`${url}/v1/ping`, { timeout: 5000 });
      if (ping.status >= 200 && ping.status < 300) {
        anotar(`A · ping ${rotulo}`, 'ok', `${url} respondeu ${ping.status}`);
        return url;
      }
      anotar(`A · ping ${rotulo}`, 'divergiu', `${url} respondeu ${ping.status}`);
    } catch (e) {
      anotar(
        `A · ping ${rotulo}`,
        'divergiu',
        `${url} não respondeu (${e.message}) — exercita o fallback`,
      );
    }
  }
  anotar('A · escolha da base', 'divergiu', 'nem primário nem secundário responderam');
  return null;
}

/** Fila, situação (D2), dados do cliente e ciclo de reserva. */
async function blocoC({ base, sessao, comSessao }) {
  const fila = await pedir(`${base}/v1/remoteauthorization/searchpending/${sessao.code}`, {
    headers: comSessao,
  });
  salvarBruto('searchpending', { status: fila.status, corpo: fila.json ?? fila.texto });
  if (!respostaUtilizavel('C · searchpending', fila)) return;

  const { resultado: parseFila, warns } = comWarnsCapturados(() =>
    liberacaoListSchema.safeParse(fila.json),
  );
  const brutas = Array.isArray(fila.json) ? fila.json : [];

  if (!parseFila.success) {
    // A lista é tudo-ou-nada: aponta a linha culpada em vez de só dizer "falhou".
    const culpadas = brutas
      .map((linha, i) => ({ i, r: liberacaoSchema.safeParse(linha) }))
      .filter((x) => !x.r.success)
      .map((x) => `linha ${x.i}: ${JSON.stringify(x.r.error.issues.slice(0, 3))}`);
    anotar(
      'C · searchpending',
      'divergiu',
      culpadas.join(' | ') || JSON.stringify(parseFila.error.issues.slice(0, 6)),
    );
    return;
  }

  const pendentes = parseFila.data;
  anotar('C · searchpending', 'ok', `${pendentes.length} liberação(ões)`);

  // D2: o fallback de situação só se manifesta com payload real.
  const situacoes = [...new Set(brutas.map((l) => JSON.stringify(l?.LIBERACAO_LIBERADA)))];
  const conhecidas = new Set(Object.values(SituacaoLiberacao));
  const foraDoCiclo = situacoes.filter((s) => !conhecidas.has(JSON.parse(s)));
  anotar(
    'C · D2 fallback de situação',
    foraDoCiclo.length || warns.length ? 'divergiu' : 'ok',
    foraDoCiclo.length || warns.length
      ? `LIBERACAO_LIBERADA fora do ciclo: ${foraDoCiclo.join(', ')} — ${warns.length} aviso(s). ` +
          'Cada um é estado do ERP a incluir em SituacaoLiberacao.'
      : `só valores conhecidos: ${situacoes.join(', ') || '(fila vazia)'}`,
  );

  const zeradas = brutas.filter((l) => String(l?.LIBERACAO_SEQUENCIA) === '0').length;
  const borderos = pendentes.filter((l) => l.isBordero).length;
  anotar(
    'C · higiene da fila',
    'ok',
    `${zeradas} linha(s) com sequência 0 filtradas · ${borderos} linha(s) de borderô`,
  );

  const alvo = pendentes.find((l) => !l.isBordero && l.cliente.codigo && l.empresa.codigo);
  if (!alvo) {
    anotar('C · dados do cliente', 'pulado', 'nenhuma liberação com empresa+cliente na fila');
    return;
  }

  for (const [passo, rota, schema] of [
    ['C · customerdataanalytics', 'customerdataanalytics', analiseCreditoSchema],
    ['C · customerpurchasehistory', 'customerpurchasehistory', historicoComprasSchema],
  ]) {
    const r = await pedir(
      `${base}/v1/remoteauthorization/${rota}/${alvo.empresa.codigo}/${alvo.cliente.codigo}`,
      { headers: comSessao },
    );
    salvarBruto(rota, { status: r.status, corpo: r.json ?? r.texto });
    validarResposta(passo, schema, r);
  }

  if (!args.reservar) {
    anotar('C · reserve/release', 'pulado', 'rode com --reservar para exercitar a reserva');
    return;
  }

  const res = await pedir(`${base}/v1/remoteauthorization/reserve/${alvo.id}/${sessao.code}`, {
    headers: comSessao,
  });
  anotar(
    'C · reserve',
    res.status === 200 ? 'ok' : 'divergiu',
    `status ${res.status} na liberação ${alvo.id}`,
  );
  const rel = await pedir(`${base}/v1/remoteauthorization/release/${alvo.id}/${sessao.code}`, {
    headers: comSessao,
  });
  anotar(
    'C · release (devolução)',
    rel.status === 200 ? 'ok' : 'divergiu',
    `status ${rel.status} — liberação ${alvo.id} devolvida à fila`,
  );
}

async function main() {
  const { documento, usuario, senha } = args;
  if (!documento || !usuario || !senha) {
    console.error('Faltam --documento, --usuario e --senha.');
    process.exit(2);
  }

  const contexto = await blocoA(String(documento).replace(/\D/g, ''), usuario, senha);
  if (contexto) await blocoC(contexto);

  anotar('C · autorizar/reprovar', 'pulado', 'este probe nunca decide — exercitar pelo app');

  console.log(`\nPayloads brutos em ${SAIDA}`);
  console.log(
    houveDivergencia ? '\nHOUVE DIVERGÊNCIA — ver as linhas DIVERGIU.' : '\nNenhuma divergência.',
  );
  process.exitCode = houveDivergencia ? 1 : 0;
}

main().catch((e) => {
  console.error('Probe interrompido:', e);
  process.exitCode = 2;
});
