/** Compiles a .svelte fixture the way a Svelte toolchain would, and imports the result. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { compile, VERSION } from 'svelte/compiler';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.svelte-out');

export const SVELTE_MAJOR = Number(VERSION.split('.')[0]);

/** @param {'client' | 'server'} generate */
export async function importSvelte(fixture, generate) {
  const source = readFileSync(fixture, 'utf8');
  const filename = basename(fixture);
  const options =
    SVELTE_MAJOR >= 5
      ? { filename, generate }
      : { filename, generate: generate === 'client' ? 'dom' : 'ssr', format: 'esm' };
  const { js } = compile(source, options);
  mkdirSync(OUT, { recursive: true });
  // Written inside the consumer project so `svelte/internal/*` resolves from its node_modules.
  const out = join(OUT, `${filename}.${generate}.${process.pid}.js`);
  writeFileSync(out, js.code);
  return (await import(pathToFileURL(out).href)).default;
}
