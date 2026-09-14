import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  liberacaoListSchema,
  liberacaoSchema,
  ORIGEM_LABEL,
  SituacaoLiberacao,
} from '@/features/liberacoes/schemas/liberacao.schema';

/**
 * O item mínimo que `searchpending` devolve. Todo campo além da sequência é
 * opcional no schema, então cada teste declara só o que está exercitando.
 *
 * A situação vem preenchida por padrão de propósito: sem ela o schema relata
 * no `console.warn`, e uma suíte que imprime quinze cópias do único canal de
 * relato que o app tem (§6, "Relato de erro") ensina o time a ignorá-lo. Quem
 * está testando o relato sobrescreve ou omite o campo — e captura o aviso.
 */
function payload(extra: Record<string, unknown> = {}) {
  return { LIBERACAO_SEQUENCIA: '1', LIBERACAO_LIBERADA: SituacaoLiberacao.Livre, ...extra };
}

/** Cala o `console.warn` do relato e devolve o que ele recebeu. */
function capturarAvisos(): { mensagens: string[]; restaurar: () => void } {
  const mensagens: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    mensagens.push(args.map(String).join(' '));
  };
  return { mensagens, restaurar: () => (console.warn = original) };
}

describe('liberacaoSchema — tradução do payload', () => {
  test('sequência numérica vira id string', () => {
    assert.equal(liberacaoSchema.parse(payload({ LIBERACAO_SEQUENCIA: 42 })).id, '42');
  });

  test('texto do Firebird perde o espaço de preenchimento', () => {
    const item = liberacaoSchema.parse(payload({ CLIFOR_NOME: '  ACME LTDA  ' }));
    assert.equal(item.cliente.nome, 'ACME LTDA');
  });

  test('campo só de espaço é ausência, não string vazia', () => {
    const item = liberacaoSchema.parse(payload({ CLIFOR_NOME: '   ' }));
    assert.equal(item.cliente.nome, null);
  });

  test('nenhum nome de coluna do Firebird sobrevive à borda', () => {
    // A árvore inteira, não só o primeiro nível: `cliente`, `empresa` e `item`
    // são objetos aninhados e uma coluna vazada dentro deles passaria batida.
    const item = liberacaoSchema.parse(payload({ CLIFOR_NOME: 'ACME' }));
    const arvore = JSON.stringify(item);
    assert.doesNotMatch(arvore, /"[A-Z]{2,}_/, `vazou coluna do ERP: ${arvore}`);
  });

  test('mensagem ausente vira string vazia, não null', () => {
    // A tela renderiza `mensagem` direto; `null` viraria "null" em texto.
    assert.equal(liberacaoSchema.parse(payload()).mensagem, '');
  });

  test('desconto ausente é 0 e desconto em texto é coagido', () => {
    assert.equal(liberacaoSchema.parse(payload()).desconto, 0);
    assert.equal(liberacaoSchema.parse(payload({ LIBERACAO_DESCONTO: '12.5' })).desconto, 12.5);
  });
});

describe('liberacaoSchema — origem', () => {
  test('origem conhecida vira o rótulo do mapa', () => {
    const item = liberacaoSchema.parse(payload({ LIBERACAO_ORIGEM: 'OS' }));
    assert.equal(item.origemLabel, 'Ordem de Serviço');
    assert.equal(item.origem, 'OS');
  });

  test('origem desconhecida vira rótulo vazio, nunca undefined', () => {
    // `noUncheckedIndexedAccess` (CLAUDE.md §3): o lookup precisa do `?? ''`.
    const item = liberacaoSchema.parse(payload({ LIBERACAO_ORIGEM: 'ZZ' }));
    assert.equal(item.origemLabel, '');
    assert.equal(ORIGEM_LABEL['ZZ'], undefined);
  });

  test('origem ausente não tenta o lookup', () => {
    assert.equal(liberacaoSchema.parse(payload()).origemLabel, '');
  });
});

describe('liberacaoSchema — situação (docs/analise §7.1.2)', () => {
  test('cada código do ciclo conhecido passa sem aviso', () => {
    const { mensagens, restaurar } = capturarAvisos();
    try {
      for (const codigo of Object.values(SituacaoLiberacao)) {
        const item = liberacaoSchema.parse(payload({ LIBERACAO_LIBERADA: codigo }));
        assert.equal(item.situacao, codigo);
      }
    } finally {
      restaurar();
    }
    assert.deepEqual(mensagens, [], 'código conhecido não pode gerar relato');
  });

  test('código fora do ciclo cai em Livre e relata', () => {
    const { mensagens, restaurar } = capturarAvisos();
    try {
      const item = liberacaoSchema.parse(payload({ LIBERACAO_LIBERADA: '7' }));
      assert.equal(item.situacao, SituacaoLiberacao.Livre);
    } finally {
      restaurar();
    }
    assert.equal(mensagens.length, 1);
    assert.match(mensagens[0] ?? '', /fora do ciclo conhecido/);
  });

  test('campo ausente cai em Livre e relata com outro texto', () => {
    // Dois donos diferentes: ausência é resposta malformada de searchpending;
    // código novo é estado novo do ERP. O relato precisa distinguir.
    const { mensagens, restaurar } = capturarAvisos();
    try {
      const item = liberacaoSchema.parse({ LIBERACAO_SEQUENCIA: '1' });
      assert.equal(item.situacao, SituacaoLiberacao.Livre);
    } finally {
      restaurar();
    }
    assert.equal(mensagens.length, 1);
    assert.match(mensagens[0] ?? '', /sem LIBERACAO_LIBERADA/);
  });

  test('uma linha com situação inesperada não derruba a fila inteira', () => {
    const { restaurar } = capturarAvisos();
    try {
      const fila = liberacaoListSchema.parse([
        payload({ LIBERACAO_SEQUENCIA: '1', LIBERACAO_LIBERADA: '2' }),
        payload({ LIBERACAO_SEQUENCIA: '2', LIBERACAO_LIBERADA: 'XPTO' }),
        payload({ LIBERACAO_SEQUENCIA: '3', LIBERACAO_LIBERADA: '3' }),
      ]);
      assert.equal(fila.length, 3);
      assert.deepEqual(
        fila.map((item) => item.situacao),
        [SituacaoLiberacao.Aprovada, SituacaoLiberacao.Livre, SituacaoLiberacao.Reprovada],
      );
    } finally {
      restaurar();
    }
  });
});

describe('liberacaoSchema — borderô', () => {
  test('TIPO_REGISTRO BORDERO marca a linha sintética', () => {
    const item = liberacaoSchema.parse(
      payload({ TIPO_REGISTRO: 'BORDERO', BORDERO_SEQUENCIA: '99', BORDERO_NUMERO: '1234' }),
    );
    assert.equal(item.isBordero, true);
    assert.equal(item.borderoSequencia, '99');
    assert.equal(item.borderoNumero, '1234');
  });

  test('liberação comum não é borderô', () => {
    assert.equal(liberacaoSchema.parse(payload({ TIPO_REGISTRO: 'LIBERACAO' })).isBordero, false);
    assert.equal(liberacaoSchema.parse(payload()).isBordero, false);
  });

  test('a sequência do borderô vem do campo, não do texto da mensagem', () => {
    // O original extraía a sequência fatiando o label (docs/analise §7.1.7).
    const item = liberacaoSchema.parse(
      payload({
        TIPO_REGISTRO: 'BORDERO',
        BORDERO_SEQUENCIA: '77',
        LIBERACAO_MENSAGEM: 'Borderô 000123 aguardando liberação',
      }),
    );
    assert.equal(item.borderoSequencia, '77');
  });
});

describe('liberacaoSchema — recusa', () => {
  test('payload sem sequência é recusado', () => {
    // O `.catch()` da situação roda antes de a sequência reprovar, então o
    // relato sai junto — capturado para não virar ruído no portão.
    const { restaurar } = capturarAvisos();
    try {
      assert.equal(liberacaoSchema.safeParse({}).success, false);
    } finally {
      restaurar();
    }
  });

  test('lista não-array é recusada', () => {
    assert.equal(liberacaoListSchema.safeParse({ LIBERACAO_SEQUENCIA: '1' }).success, false);
  });
});
