/**
 * No bundler: `<script src="…/tour-guide.iife.js">` (CDN, Electron without a bundler, WebViews).
 * Runs in its own process so nothing else has registered <tour-guide> first.
 */
import './helpers/dom.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { runInThisContext } from 'node:vm';

import { assertUserJourney, demoSteps, fixture, flush } from './helpers/tour.mjs';

const require = createRequire(import.meta.url);

let cleanup = () => undefined;
beforeEach(() => {
  cleanup = fixture();
});
afterEach(() => {
  cleanup();
});

describe('dist/browser/tour-guide.iife.js', () => {
  it('defines window.TourGuide and registers <tour-guide>', () => {
    assert.equal(customElements.get('tour-guide'), undefined);
    // Same as a classic <script>: top-level `var TourGuide` becomes a global.
    const file = require.resolve('@xkid1/tour-guide/iife');
    runInThisContext(readFileSync(file, 'utf8'), { filename: file });
    const { TourGuide } = globalThis;
    assert.equal(typeof TourGuide, 'object');
    assert.equal(customElements.get('tour-guide'), TourGuide.TourGuideElement);
    for (const name of [
      'createTour',
      'connectNativeBridge',
      'defineTourGuide',
      'setLogLevel',
    ])
      assert.equal(typeof TourGuide[name], 'function', name);
    TourGuide.setLogLevel('silent');
  });

  it('TourGuide.createTour() runs the full journey', async () => {
    const tour = globalThis.TourGuide.createTour({ steps: demoSteps() });
    await assertUserJourney(tour.element, () => tour.start());
    tour.destroy();
  });

  it('TourGuide.connectNativeBridge() works from the bundle', async () => {
    const messages = [];
    const element = document.createElement('tour-guide');
    element.steps = demoSteps();
    document.body.append(element);
    const disconnect = globalThis.TourGuide.connectNativeBridge(element, {
      post: (json) => messages.push(JSON.parse(json)),
    });
    window.dispatchEvent(new MessageEvent('message', { data: '{"command":"start"}' }));
    await flush();
    assert.equal(element.isActive, true);
    const start = messages.find((message) => message.type === 'tour-start');
    assert.deepEqual(start, {
      source: 'tour-guide',
      type: 'tour-start',
      index: 0,
      total: 3,
    });
    disconnect();
    element.remove();
  });
});
