#!/usr/bin/env bash
# Roda depois de cada Edit/Write. Lê o JSON do hook no stdin, pega o arquivo tocado e
# passa o ESLint só nele. Objetivo é feedback em segundos, enquanto o modelo ainda está
# no assunto — não substituir `npm run lint` no fechamento da ficha.
#
# Saída 2 = erro que volta para o Claude Code no stderr. Qualquer outra saída é silenciosa.

set -uo pipefail

entrada="$(cat)"

arquivo="$(printf '%s' "$entrada" | node -e '
  let buffer = "";
  process.stdin.on("data", (pedaco) => (buffer += pedaco));
  process.stdin.on("end", () => {
    try {
      const evento = JSON.parse(buffer);
      process.stdout.write(evento?.tool_input?.file_path ?? "");
    } catch {
      process.stdout.write("");
    }
  });
' 2>/dev/null)"

# Sem arquivo, ou arquivo que o ESLint deste projeto não cobre: nada a fazer.
[ -n "$arquivo" ] || exit 0
case "$arquivo" in
  *.ts|*.tsx|*.mjs|*.js) ;;
  *) exit 0 ;;
esac
[ -f "$arquivo" ] || exit 0

saida="$(npx --no-install eslint "$arquivo" 2>&1)"
codigo=$?

if [ $codigo -ne 0 ]; then
  printf 'ESLint reprovou %s:\n%s\n' "$arquivo" "$saida" >&2
  exit 2
fi

exit 0
