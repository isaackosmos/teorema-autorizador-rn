/**
 * Regra de validade do registro (`REGISTER_EXPIRATION`).
 *
 * Licença paga vem sem validade; demo vem com. Vencida, o aparelho volta a
 * "não registrado" e o registro é refeito — é o que o original fazia em
 * `PreparaLogin` (docs/analise §3.1, item 4).
 */
export function isRegistroExpirado(registerExpiration: string | null): boolean {
  if (!registerExpiration) return false;

  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(registerExpiration);
  if (!partes) return false;

  const [, ano, mes, dia] = partes;
  // Data local, não UTC: `new Date('2026-09-03')` é meia-noite em UTC e viraria
  // o dia anterior no fuso do Brasil. A licença vale até o fim do dia informado.
  const validade = new Date(Number(ano), Number(mes) - 1, Number(dia), 23, 59, 59, 999);

  return validade.getTime() <= Date.now();
}
