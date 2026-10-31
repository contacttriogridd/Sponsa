import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const url = new URL(`${specifier.slice(2)}.ts`, root);
    if (existsSync(fileURLToPath(url))) return { url: pathToFileURL(fileURLToPath(url)).href, shortCircuit: true };
  }
  return next(specifier, context);
}
