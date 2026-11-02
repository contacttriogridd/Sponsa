import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);

/** Maps "@/..." and extension-less relative imports to the project's .ts files. */
export async function resolve(specifier, context, next) {
  let url = null;
  if (specifier.startsWith('@/')) url = new URL(`${specifier.slice(2)}.ts`, root);
  else if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier) && context.parentURL?.endsWith('.ts')) {
    url = new URL(`${specifier}.ts`, context.parentURL);
  }
  if (url && existsSync(fileURLToPath(url))) return { url: pathToFileURL(fileURLToPath(url)).href, shortCircuit: true };
  return next(specifier, context);
}
