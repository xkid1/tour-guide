/**
 * Builds single-file bundles for <script> tags, CDNs, Electron and WebViews:
 *   dist/browser/tour-guide.iife.js  → registers <tour-guide>, exposes window.TourGuide
 *   dist/browser/tour-guide.es.js    → same, as an ES module
 */
import { fileURLToPath } from 'node:url';

import { build } from 'vite';

import { viteAliases } from './aliases.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

await build({
  root,
  configFile: false,
  logLevel: 'warn',
  resolve: { alias: viteAliases },
  build: {
    outDir: 'dist/browser',
    emptyOutDir: true,
    target: 'es2020',
    minify: true,
    sourcemap: true,
    lib: {
      entry: fileURLToPath(new URL('../src/apps/browser/index.ts', import.meta.url)),
      name: 'TourGuide',
      formats: ['iife', 'es'],
      fileName: (format) => `tour-guide.${format}.js`,
    },
  },
});

console.log('build-browser: dist/browser/tour-guide.{iife,es}.js');
