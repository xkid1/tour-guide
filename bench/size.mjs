#!/usr/bin/env node
/**
 * Bundle-size budget for what users download. Run after `yarn build`.
 *
 *   node bench/size.mjs            # table + fails if a budget is exceeded
 *   node bench/size.mjs --json     # machine-readable
 *
 * Budgets are gzip bytes (what CDNs and most servers send). Raise one deliberately, in the
 * same PR as the change that needs it, so size growth is always a reviewed decision.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');

/** @typedef {{ raw: number; gzip: number; brotli: number }} Size */

/** gzip budgets in bytes. @type {Record<string, number>} */
const BUDGETS = {
  'browser/tour-guide.iife.js': 16 * 1024,
  // 17 → 18 kB: strict-CSP custom styles (per-instance constructable sheet). It sat at
  // 16.94 kB with ~60 bytes of headroom before that.
  'browser/tour-guide.es.js': 18 * 1024,
  // Whole unbundled ESM tree (dist/**/*.js without the bundles), comments included: an upper
  // bound for what `import` pulls in before the app's bundler minifies and tree-shakes it.
  // 30 → 32 kB: motion, mobile follow layout, clickable target and the ./resume entry.
  'esm (all modules)': 32 * 1024,
};

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** @param {Buffer} buffer @returns {Size} */
function measure(buffer) {
  return {
    raw: buffer.length,
    gzip: gzipSync(buffer, { level: 9 }).length,
    brotli: brotliCompressSync(buffer, {
      params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
    }).length,
  };
}

if (!existsSync(join(DIST, 'browser'))) {
  throw new Error('size: dist/ not found. Run `yarn build` first.');
}
const files = walk(DIST);
const esm = files.filter(
  (file) => file.endsWith('.js') && !file.includes(`${join('dist', 'browser')}`),
);
/** @type {[string, Size][]} */
const rows = [
  [
    'browser/tour-guide.iife.js',
    measure(readFileSync(join(DIST, 'browser/tour-guide.iife.js'))),
  ],
  [
    'browser/tour-guide.es.js',
    measure(readFileSync(join(DIST, 'browser/tour-guide.es.js'))),
  ],
  // Concatenated so gzip sees shared strings, like an HTTP/2 bundle-free app roughly would.
  ['esm (all modules)', measure(Buffer.concat(esm.map((file) => readFileSync(file))))],
];

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(Object.fromEntries(rows), null, 2));
} else {
  const kb = (/** @type {number} */ bytes) => `${(bytes / 1024).toFixed(2)} kB`;
  console.log('| File | Raw | Gzip | Brotli | Budget (gzip) | |');
  console.log('| --- | ---: | ---: | ---: | ---: | --- |');
  for (const [name, size] of rows) {
    const budget = BUDGETS[name] ?? 0;
    const ok = size.gzip <= budget;
    console.log(
      `| ${name} | ${kb(size.raw)} | ${kb(size.gzip)} | ${kb(size.brotli)} | ${kb(budget)} | ${ok ? '✅' : '❌ over'} |`,
    );
  }
}

const over = rows.filter(([name, size]) => size.gzip > (BUDGETS[name] ?? 0));
if (over.length) {
  console.error(`\nsize: over budget: ${over.map(([name]) => name).join(', ')}`);
  process.exitCode = 1;
}
