/** Junta classes do Tailwind ignorando `false`/`null`/`undefined`. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
