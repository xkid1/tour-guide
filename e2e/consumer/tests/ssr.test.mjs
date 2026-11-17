/**
 * Server-side rendering: Next.js, Nuxt, SvelteKit, Angular SSR and plain Node import the
 * package with no DOM. Nothing may touch `window`/`document` at import time.
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { importSvelte } from './helpers/svelte.mjs';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const steps = [{ id: 'welcome', title: 'Welcome' }];
const REACT_MAJOR = Number((await import('react')).version.split('.')[0]);

assert.equal(typeof window, 'undefined', 'this suite runs without a DOM');

describe('importing on the server', () => {
  for (const entry of [
    '',
    '/browser',
    '/electron',
    '/react',
    '/vue',
    '/svelte',
    '/angular',
    '/android',
  ]) {
    it(`import "@xkid1/tour-guide${entry}" does not throw`, async () => {
      await import(`@xkid1/tour-guide${entry}`);
    });
  }

  it('defineTourGuide() and registerTourGuide() are no-ops', async () => {
    const { defineTourGuide } = await import('@xkid1/tour-guide');
    const { registerTourGuide } = await import('@xkid1/tour-guide/angular');
    assert.equal(defineTourGuide(), undefined);
    assert.doesNotThrow(() => {
      registerTourGuide();
    });
  });

  it('pure helpers work without a DOM', async () => {
    const { computePosition, resolveOptions, validateSteps, TourManager } =
      await import('@xkid1/tour-guide');
    const result = computePosition({
      target: { top: 100, left: 100, width: 50, height: 20 },
      popover: { width: 200, height: 100 },
      viewport: { width: 1000, height: 800 },
      placement: 'bottom',
      offset: 8,
      margin: 8,
    });
    assert.equal(typeof result.top, 'number');
    assert.equal(typeof resolveOptions().keyboardNavigation, 'boolean');
    assert.ok(Array.isArray(validateSteps(steps)));

    const manager = new TourManager();
    manager.setSteps([{ title: 'A' }, { title: 'B' }]);
    assert.equal(await manager.start(), true);
    assert.equal(await manager.next(), true);
    assert.equal(manager.index, 1);
  });

  it('the native bridge finds no channel and stays inert', async () => {
    const { detectNativeChannel, parseCommand } =
      await import('@xkid1/tour-guide/android');
    assert.equal(detectNativeChannel(), null);
    assert.deepEqual(parseCommand('{"command":"next"}'), { command: 'next' });
  });
});

describe('rendering to HTML', () => {
  it('React renderToString emits <tour-guide>', async () => {
    const React = await import('react');
    const { renderToString } = await import('react-dom/server');
    const { createReactTourGuide } = await import('@xkid1/tour-guide/react');
    const { TourGuide } = createReactTourGuide(React);
    const html = renderToString(
      React.createElement(TourGuide, {
        steps,
        open: true,
        theme: 'dark',
      }),
    );
    assert.match(html, /<tour-guide[^>]*theme="dark"/);
  });

  it(
    'React renderToString maps className to class',
    // Same known React 18 issue as in react.test.mjs.
    { todo: REACT_MAJOR < 19 ? 'React 18 renders className literally' : undefined },
    async () => {
      const React = await import('react');
      const { renderToString } = await import('react-dom/server');
      const { createReactTourGuide } = await import('@xkid1/tour-guide/react');
      const { TourGuide } = createReactTourGuide(React);
      const html = renderToString(
        React.createElement(TourGuide, { steps, className: 'tour' }),
      );
      assert.match(html, /<tour-guide[^>]*\sclass="tour"/);
    },
  );

  it('Vue renderToString emits <tour-guide>', async () => {
    const Vue = await import('vue');
    const { renderToString } = await import('vue/server-renderer');
    const { createVueTourGuide } = await import('@xkid1/tour-guide/vue');
    const TourGuide = createVueTourGuide(Vue);
    const app = Vue.createSSRApp({
      render: () => Vue.h(TourGuide, { steps, open: true, theme: 'dark' }),
    });
    const html = await renderToString(app);
    assert.match(html, /<tour-guide[^>]*theme="dark"/);
  });

  it('Svelte server render emits <tour-guide> (the action never runs)', async () => {
    const { render } = await import('svelte/server').catch(() => ({ render: null }));
    const Tour = await importSvelte(join(FIXTURES, 'Tour.svelte'), 'server');
    const html = render
      ? render(Tour, { props: { steps } }).body
      : Tour.render({ steps }).html;
    assert.match(html, /<tour-guide[^>]*id="action-tour"/);
    assert.match(html, /slot="step-welcome"/);
  });
});
