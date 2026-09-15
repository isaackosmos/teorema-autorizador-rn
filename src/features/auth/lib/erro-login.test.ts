import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  mensagemDeErroDeLogin,
  motivoDoErroDeLogin,
  MotivoLoginFalhou,
} from '@/features/auth/lib/erro-login';
import { ApiError, ContractError } from '@/shared/lib/http/errors';

/**
 * Contrato do único ponto do app que decide por que o login não passou
 * (ficha A4). O app Delphi comparava o texto da mensagem e virou código morto
 * quando o servidor mudou a redação (docs/analise §7.1.3) — a tabela abaixo é
 * o que impede a decisão de voltar a depender de texto.
 */
function erro(status: number, payload?: unknown): ApiError {
  return new ApiError(status, 'mensagem qualquer do servidor', payload);
}

describe('motivoDoErroDeLogin — a decisão é por status', () => {
  test('o que não é ApiError é desconhecido', () => {
    // O tipo do erro da mutation é asserção do TanStack, não garantia.
    assert.equal(motivoDoErroDeLogin(new Error('boom')), MotivoLoginFalhou.Desconhecido);
    assert.equal(motivoDoErroDeLogin('boom'), MotivoLoginFalhou.Desconhecido);
    assert.equal(motivoDoErroDeLogin(null), MotivoLoginFalhou.Desconhecido);
    assert.equal(motivoDoErroDeLogin(undefined), MotivoLoginFalhou.Desconhecido);
  });

  test('status 0 é rede', () => {
    // Dívida D9 do CLAUDE.md §9: o mesmo 0 também significa "servidor do
    // cliente ainda não resolvido". Fixado aqui como está, para que separar os
    // dois seja uma mudança visível e não um efeito colateral.
    assert.equal(motivoDoErroDeLogin(erro(0)), MotivoLoginFalhou.Rede);
  });

  test('5xx é falha do servidor', () => {
    for (const status of [500, 502, 503, 504]) {
      assert.equal(
        motivoDoErroDeLogin(erro(status)),
        MotivoLoginFalhou.Servidor,
        `status ${status}`,
      );
    }
  });

  test('resposta fora do contrato não se confunde com falha do servidor', () => {
    // As duas são 5xx, e é justamente por isso que o caso existe: um 502 de
    // gateway é transitório e pede "tente novamente"; um `ContractError` é
    // determinístico e repetir devolve o mesmo corpo (F3).
    const foraDeContrato = new ContractError('Resposta inesperada do servidor no login.');

    assert.equal(motivoDoErroDeLogin(foraDeContrato), MotivoLoginFalhou.Contrato);
    assert.equal(motivoDoErroDeLogin(erro(502)), MotivoLoginFalhou.Servidor);
    assert.doesNotMatch(mensagemDeErroDeLogin(foraDeContrato), /novamente/i);
  });

  test('401 sem corpo é credencial', () => {
    assert.equal(motivoDoErroDeLogin(erro(401)), MotivoLoginFalhou.Credencial);
  });

  test('400 sem corpo é requisição, não credencial', () => {
    // 400 é como uma divergência de contrato chega enquanto o 🔒 B1 não cai.
    // Acusar "usuário ou senha inválidos" faria o usuário redigitar para sempre.
    assert.equal(motivoDoErroDeLogin(erro(400)), MotivoLoginFalhou.Requisicao);
  });

  test('outros 4xx são requisição', () => {
    for (const status of [403, 404, 409, 422]) {
      assert.equal(
        motivoDoErroDeLogin(erro(status)),
        MotivoLoginFalhou.Requisicao,
        `status ${status}`,
      );
    }
  });

  test('status abaixo de 400 cai no desconhecido', () => {
    // Nenhum deles é resposta esperada de um login que falhou.
    for (const status of [100, 204, 302, 399]) {
      assert.equal(
        motivoDoErroDeLogin(erro(status)),
        MotivoLoginFalhou.Desconhecido,
        `status ${status}`,
      );
    }
  });

  test('acima de 500 a faixa é aberta, não uma lista', () => {
    // `>= 500` é guarda-chuva de propósito: status inventado por proxy ou
    // gateway continua sendo falha de servidor, não erro do usuário.
    assert.equal(motivoDoErroDeLogin(erro(600)), MotivoLoginFalhou.Servidor);
  });
});

describe('motivoDoErroDeLogin — o corpo só desempata 400 e 401 (dívida D8)', () => {
  test('erro=cadastro é sobre o aparelho, não sobre o usuário', () => {
    // O `registerid` enviado no login não existe mais no central
    // (docs/analise §3.1, "Aparelho com registro excluído").
    const esperado = MotivoLoginFalhou.AparelhoSemRegistro;
    assert.equal(motivoDoErroDeLogin(erro(401, { erro: 'cadastro' })), esperado);
    assert.equal(motivoDoErroDeLogin(erro(400, { erro: 'cadastro' })), esperado);
  });

  test('usuário inexistente e senha errada compartilham o mesmo motivo', () => {
    // De propósito: responder "este usuário não existe" entrega a lista de
    // logins válidos a quem tenta adivinhar (decisao-hash-senha §3, risco R7).
    // Separar as duas mensagens é o tipo de "melhoria de UX" que alguém desfaz
    // de boa-fé — este teste é o que impede.
    const porUsuario = motivoDoErroDeLogin(erro(401, { erro: 'usuario' }));
    const porSenha = motivoDoErroDeLogin(erro(401, { erro: 'senha' }));
    assert.equal(porUsuario, MotivoLoginFalhou.Credencial);
    assert.equal(porSenha, MotivoLoginFalhou.Credencial);
    assert.equal(
      mensagemDeErroDeLogin(erro(401, { erro: 'usuario' })),
      mensagemDeErroDeLogin(erro(401, { erro: 'senha' })),
    );
  });

  test('corpo fora do contrato não muda a decisão do status', () => {
    for (const payload of [{ erro: 'sei-la' }, { outro: 'campo' }, 'texto solto', null, 42]) {
      assert.equal(motivoDoErroDeLogin(erro(401, payload)), MotivoLoginFalhou.Credencial);
      assert.equal(motivoDoErroDeLogin(erro(400, payload)), MotivoLoginFalhou.Requisicao);
    }
  });

  test('o corpo não é lido fora de 400 e 401', () => {
    // Um 500 com `{"erro":"cadastro"}` continua sendo falha de servidor.
    assert.equal(motivoDoErroDeLogin(erro(500, { erro: 'cadastro' })), MotivoLoginFalhou.Servidor);
    assert.equal(
      motivoDoErroDeLogin(erro(403, { erro: 'cadastro' })),
      MotivoLoginFalhou.Requisicao,
    );
    assert.equal(motivoDoErroDeLogin(erro(0, { erro: 'cadastro' })), MotivoLoginFalhou.Rede);
  });
});

/**
 * Uma entrada por motivo. O `Record` é o que dá exaustividade: motivo novo em
 * `MotivoLoginFalhou` sem entrada aqui não compila, então a tabela não pode
 * ficar para trás em silêncio.
 */
const ENTRADA_POR_MOTIVO: Record<MotivoLoginFalhou, unknown> = {
  [MotivoLoginFalhou.Rede]: erro(0),
  [MotivoLoginFalhou.Credencial]: erro(401),
  [MotivoLoginFalhou.AparelhoSemRegistro]: erro(401, { erro: 'cadastro' }),
  [MotivoLoginFalhou.Requisicao]: erro(400),
  [MotivoLoginFalhou.Servidor]: erro(500),
  [MotivoLoginFalhou.Contrato]: new ContractError('Resposta inesperada do servidor no login.'),
  [MotivoLoginFalhou.Desconhecido]: new Error('boom'),
};

describe('mensagemDeErroDeLogin', () => {
  for (const [motivo, entrada] of Object.entries(ENTRADA_POR_MOTIVO)) {
    test(`${motivo}: a entrada leva ao motivo e a mensagem não é vazia`, () => {
      assert.equal(motivoDoErroDeLogin(entrada), motivo);
      assert.ok(mensagemDeErroDeLogin(entrada).trim().length > 0);
    });
  }

  test('cada motivo tem uma mensagem distinta', () => {
    // Duas mensagens iguais para motivos diferentes é mapa copiado por
    // descuido — exceto usuário/senha, que compartilham de propósito e não
    // são motivos diferentes.
    const mensagens = Object.values(ENTRADA_POR_MOTIVO).map(mensagemDeErroDeLogin);
    assert.equal(new Set(mensagens).size, mensagens.length);
  });

  test('a mensagem do aparelho sem registro não manda refazer a configuração', () => {
    // Dívida D10: nada no app derruba o `registerId` morto, então o caminho
    // não resolveria. Prometer um caminho que não conserta é pior que não tê-lo.
    const mensagem = mensagemDeErroDeLogin(erro(401, { erro: 'cadastro' }));
    assert.doesNotMatch(mensagem, /configura/i);
    assert.match(mensagem, /registr/i);
  });

  test('a mensagem de credencial não distingue usuário de senha', () => {
    assert.equal(mensagemDeErroDeLogin(erro(401)), 'Usuário ou senha inválidos.');
  });

  test('a mensagem nunca vaza o texto cru do servidor', () => {
    const mensagem = mensagemDeErroDeLogin(new ApiError(401, 'ORA-06512: at line 42'));
    assert.doesNotMatch(mensagem, /ORA-/);
  });
});
