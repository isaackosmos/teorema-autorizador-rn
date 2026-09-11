import { execFileSync } from 'node:child_process';

const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

/**
 * Commits do intervalo. No GitHub Actions, o intervalo vem do evento de push
 * (`github.event.before..github.sha`). Fora dele, cai para as últimas 24 h — que é
 * o recorte certo para o Morning Brief.
 */
export function commitsDoPush({ intervalo = process.env.SYNC_RANGE } = {}) {
  const formato = '%H%x1f%an%x1f%aI%x1f%s';
  let bruto = '';
  try {
    bruto =
      intervalo && !/^0{40}\.\./.test(intervalo)
        ? git(['log', `--format=${formato}`, intervalo])
        : git(['log', `--format=${formato}`, '--since=24 hours ago']);
  } catch {
    return [];
  }
  return bruto
    .split('\n')
    .filter(Boolean)
    .map((linha) => {
      const [sha, autor, quando, assunto] = linha.split('\u001f');
      return { sha, curto: sha.slice(0, 7), autor, quando, assunto };
    });
}

/** Arquivos tocados no intervalo, para saber qual feature andou. */
export function arquivosDoPush({ intervalo = process.env.SYNC_RANGE } = {}) {
  try {
    const bruto =
      intervalo && !/^0{40}\.\./.test(intervalo)
        ? git(['diff', '--name-only', intervalo])
        : git(['log', '--name-only', '--format=', '--since=24 hours ago']);
    return [...new Set(bruto.split('\n').filter(Boolean))];
  } catch {
    return [];
  }
}

export const shaAtual = () => {
  try {
    return git(['rev-parse', 'HEAD']);
  } catch {
    return null;
  }
};
