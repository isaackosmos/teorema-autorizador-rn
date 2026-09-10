/**
 * Resolve o alias `@/` e deixa o Node ler os `.ts` do app direto.
 *
 * Existe para o probe usar os *schemas reais* de `src/` em vez de uma cópia:
 * uma divergência de contrato do Orion precisa estourar no mesmo Zod que a
 * tela usa, senão o teste mede a cópia e não o app.
 *
 * O `package.json` do projeto não tem `"type": "module"`, então o formato é
 * forçado aqui — sem isso o Node leria os `.ts` como CommonJS.
 */
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const SRC = path.resolve(import.meta.dirname, '..', 'src');
const EXTENSOES = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

function resolverArquivo(base) {
  if (existsSync(base) && path.extname(base)) return base;
  for (const ext of EXTENSOES) {
    if (existsSync(base + ext)) return base + ext;
  }
  return null;
}

/**
 * Só imports relativos *de dentro* de `src/` passam por aqui. Os relativos do
 * node_modules (os internos do zod, por exemplo) são JS e têm que cair no
 * resolvedor padrão — forçá-los a `module-typescript` faz o Node recusar com
 * ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING.
 */
function ehModuloDoApp(parentURL) {
  if (!parentURL?.startsWith('file:')) return false;
  const arquivo = fileURLToPath(parentURL);
  return arquivo.startsWith(SRC) && /\.tsx?$/.test(arquivo);
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    let alvo = null;

    if (specifier.startsWith('@/')) {
      alvo = resolverArquivo(path.join(SRC, specifier.slice(2)));
    } else if (specifier.startsWith('.') && ehModuloDoApp(context.parentURL)) {
      const pai = path.dirname(fileURLToPath(context.parentURL));
      alvo = resolverArquivo(path.resolve(pai, specifier));
    }

    if (!alvo) return nextResolve(specifier, context);
    return { url: pathToFileURL(alvo).href, format: 'module-typescript', shortCircuit: true };
  },
});
