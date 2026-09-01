const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });
const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

/** `null` para entrada inválida — nunca "Invalid Date" na tela. */
function parse(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
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
