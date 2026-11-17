/**
 * Makes the emitted .js and .d.ts files valid ESM that runs in Node, bundlers and browsers
 * without any alias config:
 *
 *   '@libs'       → '../libs/index.js'   (layer barrel aliases, see scripts/aliases.mjs)
 *   './defaults'  → './defaults.js'      (extensionless relative file)
 *   './react'     → './react/index.js'   (extensionless relative directory)
 *
 *   node scripts/resolve-aliases.mjs dist
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { LAYERS } from './aliases.mjs';

const outDir = resolve(process.argv[2] ?? 'dist');
const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"]+)\2/g;
const ALIAS = new RegExp(`^@(${LAYERS.join('|')})$`);

/**
 * @param {string} dir
 * @returns {Generator<string>}
 */
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(js|d\.ts)$/.test(name)) yield full;
  }
}

/**
 * @param {string} fromFile
 * @param {string} target
 */
function toRelative(fromFile, target) {
  const rel = relative(dirname(fromFile), target).split(sep).join('/');
  return rel.startsWith('.') ? rel : `./${rel}`;
}

/**
 * Returns the rewritten specifier, or `null` to leave it untouched.
 * @param {string} file
 * @param {string} specifier
 * @returns {string | null}
 */
function rewrite(file, specifier) {
  const layer = ALIAS.exec(specifier)?.[1];
  if (layer) return toRelative(file, join(outDir, layer, 'index.js'));
  if (!specifier.startsWith('.') || /\.(m?js|json)$/.test(specifier)) return null;

  const base = resolve(dirname(file), specifier);
  // The .js twin always exists, even when rewriting a .d.ts file (types/index.js is an empty module).
  if (existsSync(`${base}.js`)) return `${specifier}.js`;
  if (existsSync(join(base, 'index.js')))
    return `${specifier.replace(/\/$/, '')}/index.js`;
  throw new Error(
    `resolve-aliases: cannot resolve '${specifier}' in ${relative(process.cwd(), file)}`,
  );
}

let changed = 0;
for (const file of walk(outDir)) {
  const source = readFileSync(file, 'utf8');
  const output = source.replace(
    SPECIFIER,
    (
      /** @type {string} */ match,
      /** @type {string} */ prefix,
      /** @type {string} */ quote,
      /** @type {string} */ specifier,
    ) => {
      const next = rewrite(file, specifier);
      return next === null ? match : `${prefix}${quote}${next}${quote}`;
    },
  );
  if (output !== source) {
    writeFileSync(file, output);
    changed += 1;
  }
}
console.log(
  `resolve-aliases: rewrote ${changed} file(s) in ${relative(process.cwd(), outDir) || '.'}`,
);
