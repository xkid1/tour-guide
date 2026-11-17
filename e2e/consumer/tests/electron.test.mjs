/**
 * Electron renderer with a bundler: `import … from '@xkid1/tour-guide/electron'`.
 * (A real Electron window is covered by the opt-in electron-app suite.)
 */
import './helpers/dom.mjs';

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import * as browser from '@xkid1/tour-guide/browser';
import * as electron from '@xkid1/tour-guide/electron';

import { assertUserJourney, demoSteps, fixture } from './helpers/tour.mjs';

electron.setLogLevel('silent');

let cleanup = () => undefined;
beforeEach(() => {
  cleanup = fixture();
});
afterEach(() => {
  cleanup();
});

describe('@xkid1/tour-guide/electron', () => {
  it('is the browser entry (same names, same module instances)', () => {
    assert.deepEqual(Object.keys(electron).sort(), Object.keys(browser).sort());
    for (const name of Object.keys(electron))
      assert.equal(electron[name], browser[name], name);
  });

  it('registers <tour-guide> on import', () => {
    assert.equal(customElements.get('tour-guide'), electron.TourGuideElement);
  });

  it('runs a full tour without any Node API (contextIsolation-safe)', async () => {
    // A sandboxed renderer has no `process`/`require`; the entry must not need them.
    const tour = electron.createTour({ steps: demoSteps() });
    await assertUserJourney(tour.element, () => tour.start());
    tour.destroy();
  });
});
