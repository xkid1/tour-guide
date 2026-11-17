/**
 * Svelte: a real .svelte component compiled by svelte/compiler, using `use:tourGuide` and
 * `createSvelteTourGuide()`. Run with `--conditions=browser` (Svelte's client runtime).
 */
import './helpers/dom.mjs';

import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { afterEach, before, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { setLogLevel } from '@xkid1/tour-guide';

import { importSvelte, SVELTE_MAJOR } from './helpers/svelte.mjs';
import { assertUserJourney, demoSteps, fixture, flush, part } from './helpers/tour.mjs';

setLogLevel('silent');

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'Tour.svelte');
const svelte = await import('svelte');

let Tour;
let instance = null;
let target;
let cleanup = () => undefined;

before(async () => {
  Tour = await importSvelte(FIXTURE, 'client');
});

beforeEach(() => {
  cleanup = fixture();
  target = document.createElement('div');
  document.body.append(target);
});

afterEach(async () => {
  if (instance) {
    if (SVELTE_MAJOR >= 5) await svelte.unmount(instance);
    else instance.$destroy();
  }
  instance = null;
  target.remove();
  cleanup();
});

/** Mounts with Svelte 5's mount() or Svelte 3/4's `new Component()`. */
async function mount(props) {
  instance =
    SVELTE_MAJOR >= 5
      ? svelte.mount(Tour, { target, props })
      : new Tour({ target, props });
  if (SVELTE_MAJOR >= 5) svelte.flushSync();
  await flush();
}

/** Clicks a button inside the component and lets Svelte apply the state change. */
async function clickInComponent(selector) {
  target.querySelector(selector).click();
  if (SVELTE_MAJOR >= 5) svelte.flushSync();
  await flush();
}

describe(`@xkid1/tour-guide/svelte with Svelte ${SVELTE_MAJOR}`, () => {
  it('use:tourGuide opens on mount, sets the theme and forwards events', async () => {
    const events = [];
    await mount({ steps: demoSteps(), open: true, events });
    const element = target.querySelector('#action-tour');
    assert.equal(element.isActive, true);
    assert.equal(element.getAttribute('theme'), 'dark');
    assert.equal(
      element.querySelector('.svelte-slot').getAttribute('slot'),
      'step-welcome',
    );

    part(element, 'close-button').click();
    await flush();
    assert.equal(element.isActive, false);
    assert.deepEqual(
      events.map((e) => e.type),
      ['start', 'step-change', 'end'],
    );
  });

  it('createSvelteTourGuide() controls: full user journey', async () => {
    const controls = (await import('@xkid1/tour-guide/svelte')).createSvelteTourGuide();
    await mount({ steps: demoSteps(), controls });
    const element = target.querySelector('#controls-tour');
    assert.equal(controls.element(), element);
    await assertUserJourney(element, () => controls.start());
  });

  it('a button in the component starts the tour', async () => {
    const controls = (await import('@xkid1/tour-guide/svelte')).createSvelteTourGuide();
    await mount({ steps: demoSteps(), controls });
    await clickInComponent('#start');
    assert.equal(target.querySelector('#controls-tour').isActive, true);
  });

  it('state changes reach the action through update() (open toggles)', async () => {
    await mount({ steps: demoSteps(), open: false });
    const element = target.querySelector('#action-tour');
    assert.equal(element.isActive, false);
    await clickInComponent('#toggle');
    assert.equal(element.isActive, true);
    await clickInComponent('#toggle');
    assert.equal(element.isActive, false);
  });

  it('unmount destroys the action and closes the tour', async () => {
    const controls = (await import('@xkid1/tour-guide/svelte')).createSvelteTourGuide();
    await mount({ steps: demoSteps(), controls, open: true });
    const element = target.querySelector('#action-tour');
    if (SVELTE_MAJOR >= 5) await svelte.unmount(instance);
    else instance.$destroy();
    instance = null;
    assert.equal(element.isActive, false);
    assert.equal(controls.element(), null);
  });
});
