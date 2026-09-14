import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { formatDate, formatDateTime, orionDateToIso } from '@/shared/lib/format/date';

describe('orionDateToIso — data do Firebird vira ISO na borda', () => {
  test('dd/mm/yyyy vira yyyy-mm-dd', () => {
    // `new Date('31/12/2026')` é Invalid Date: sem esta conversão a data do
    // Orion não sobrevive à travessia.
    assert.equal(orionDateToIso('31/12/2026'), '2026-12-31');
    assert.equal(orionDateToIso('05/03/2024'), '2024-03-05');
  });

  test('a hora que às vezes acompanha é descartada', () => {
    assert.equal(orionDateToIso('05/03/2024 14:30'), '2024-03-05');
    assert.equal(orionDateToIso('05/03/2024 14:30:59'), '2024-03-05');
  });

  test('espaço em volta não atrapalha', () => {
    assert.equal(orionDateToIso('  31/12/2026  '), '2026-12-31');
  });

  test('ausência e texto não-data viram null, nunca Invalid Date', () => {
    for (const valor of [null, undefined, '', '   ', 'não sou data']) {
      assert.equal(orionDateToIso(valor), null, `${JSON.stringify(valor)} deveria virar null`);
    }
  });

  /**
   * O ramo de fallback (`parse` + `toISOString`) passa por UTC e por isso
   * depende do fuso da máquina. Não é pinado aqui de propósito: nenhum
   * chamador o alcança — toda data que entra vem do Orion em `dd/mm/yyyy`,
   * coberta acima. Se um dia alguém mandar ISO para cá, o teste a escrever é
   * o do fuso, não este.
   */
});

describe('formatDate — data sem hora é dia civil', () => {
  test('não escorrega um dia para trás por causa de UTC', () => {
    // `new Date('2026-08-28')` é meia-noite UTC; em UTC-3 o formatador
    // devolveria 27/08. A asserção vale em qualquer fuso porque o parse
    // constrói a data local — é exatamente essa garantia que se está travando.
    assert.equal(formatDate('2026-08-28'), '28/08/2026');
    assert.equal(formatDate('2026-01-01'), '01/01/2026');
    assert.equal(formatDate('2026-12-31'), '31/12/2026');
  });

  test('objeto Date é aceito', () => {
    assert.equal(formatDate(new Date(2026, 7, 28)), '28/08/2026');
  });

  test('ausência e entrada inválida viram travessão, nunca "Invalid Date"', () => {
    for (const valor of [null, undefined, '', 'não sou data']) {
      assert.equal(formatDate(valor), '—', `${JSON.stringify(valor)} deveria virar travessão`);
    }
    assert.equal(formatDate(new Date('lixo')), '—');
  });
});

describe('formatDateTime', () => {
  test('mostra data e hora locais', () => {
    // Date construído no fuso local: a asserção não depende do fuso da máquina.
    assert.equal(formatDateTime(new Date(2026, 7, 28, 15, 45)), '28/08/2026, 15:45');
  });

  test('ausência e entrada inválida viram travessão', () => {
    assert.equal(formatDateTime(null), '—');
    assert.equal(formatDateTime('não sou data'), '—');
  });
});
