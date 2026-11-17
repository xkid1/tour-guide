/**
 * Bundlers: apps are built with Vite/Rollup before they reach users. Checks that the exports
 * map resolves, that `sideEffects` keeps the self-registering entries, and that adapters
 * tree-shake to what they use.
 */
import './helpers/dom.mjs';

import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { build } from 'vite';

import { demoSteps, flush, part } from './helpers/tour.mjs';

const PROJECT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORK = join(PROJECT, 'dist-bundles');

const ENTRIES = {
  // `import '…/browser'` for its side effect only: must still register <tour-guide>.
  'side-effect': `import '@xkid1/tour-guide/browser';`,
  'vanilla': `export { createTour } from '@xkid1/tour-guide/browser';`,
  'react': `export { createReactTourGuide } from '@xkid1/tour-guide/react';`,
  'vue': `export { createVueTourGuide } from '@xkid1/tour-guide/vue';`,
  'svelte': `export { tourGuide } from '@xkid1/tour-guide/svelte';`,
  'angular': `export { registerTourGuide } from '@xkid1/tour-guide/angular';`,
  'android': `export { connectNativeBridge } from '@xkid1/tour-guide/android';`,
  'manager-only': `export { TourManager } from '@xkid1/tour-guide';`,
};

/** name → { code, path } */
const bundles = {};

before(async () => {
  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(join(WORK, 'src'), { recursive: true });
  for (const [name, source] of Object.entries(ENTRIES)) {
    const entry = join(WORK, 'src', `${name}.js`);
    writeFileSync(entry, `${source}\n`);
    await build({
      root: PROJECT,
      configFile: false,
      logLevel: 'silent',
      build: {
        outDir: join(WORK, 'out'),
        emptyOutDir: false,
        minify: true,
        target: 'es2020',
        lib: { entry, formats: ['es'], fileName: () => `${name}.js` },
      },
    });
    const path = join(WORK, 'out', `${name}.js`);
    bundles[name] = { path, code: readFileSync(path, 'utf8') };
  }
});

after(() => {
  rmSync(WORK, { recursive: true, force: true });
});

describe('Vite production build', () => {
  it('a side-effect-only import still registers <tour-guide>', async () => {
    assert.equal(customElements.get('tour-guide'), undefined);
    await import(pathToFileURL(bundles['side-effect'].path).href);
    assert.ok(customElements.get('tour-guide'), 'registered after bundling');
  });

  it('the bundled vanilla entry runs a tour', async () => {
    const { createTour } = await import(pathToFileURL(bundles.vanilla.path).href);
    const tour = createTour({ steps: demoSteps() });
    await tour.start();
    await flush();
    assert.equal(part(tour.element, 'title').textContent, 'Welcome');
    tour.destroy();
  });

  it('adapters bundle without pulling in any framework', () => {
    for (const name of ['react', 'vue', 'svelte', 'angular']) {
      const { code } = bundles[name];
      assert.doesNotMatch(
        code,
        /from\s*["'](react|vue|svelte|@angular\/[^"']+)["']/,
        name,
      );
    }
  });

  it('tree-shakes the native bridge out of framework adapters', () => {
    for (const name of ['react', 'vue', 'svelte', 'angular', 'manager-only']) {
      assert.doesNotMatch(
        bundles[name].code,
        /ReactNativeWebView/,
        `${name} has no bridge`,
      );
    }
    assert.match(bundles.android.code, /ReactNativeWebView/);
  });

  it('TourManager alone does not drag in the custom element and its styles', () => {
    const manager = bundles['manager-only'].code.length;
    const full = bundles.vanilla.code.length;
    assert.ok(manager < full / 2, `manager ${manager} B vs full ${full} B`);
  });
});
