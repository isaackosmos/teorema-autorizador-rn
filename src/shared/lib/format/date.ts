const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });
const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

/** ISO só com a data, sem hora nem fuso. */
const SOMENTE_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `null` para entrada inválida — nunca "Invalid Date" na tela. */
function parse(value: string | Date | null | undefined): Date | null {
  if (!value) return null;

  // `new Date('2026-08-28')` é meia-noite **UTC**: em UTC-3 o formatador
  // devolveria 27/08. Data sem hora é dia civil e é lida como dia local.
  const civil = typeof value === 'string' ? SOMENTE_DATA.exec(value.trim()) : null;
  if (civil) {
    const [, ano, mes, dia] = civil;
    const local = new Date(Number(ano), Number(mes) - 1, Number(dia));
    return Number.isNaN(local.getTime()) ? null : local;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | Date | null | undefined): string {
  const date = parse(value);
  return date ? dateFormatter.format(date) : '—';
}

export function formatDateTime(value: string | Date | null | undefined): string {
  const date = parse(value);
  return date ? dateTimeFormatter.format(date) : '—';
}

/**
 * Data do Orion → ISO 8601 (só a parte da data).
 *
 * O Firebird devolve datas como texto no formato brasileiro
 * (`dd/mm/yyyy`, às vezes com hora), e `new Date('31/12/2026')` é
 * `Invalid Date`. A conversão acontece no schema, na borda: da sessão para
 * dentro toda data é ISO.
 */
export function orionDateToIso(value: string | null | undefined): string | null {
  if (!value) return null;

  const brasileira = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(value.trim());
  if (brasileira) {
    const [, dia, mes, ano] = brasileira;
    return `${ano}-${mes}-${dia}`;
  }

  const date = parse(value);
  return date ? (date.toISOString().split('T')[0] ?? null) : null;
}
