/** React 18 / 19 with react-dom/client, in StrictMode, like a Vite/Next.js client app. */
import './helpers/dom.mjs';

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import * as React from 'react';
import { createRoot } from 'react-dom/client';

import { setLogLevel } from '@xkid1/tour-guide';
import { createReactTourGuide } from '@xkid1/tour-guide/react';

import { assertUserJourney, demoSteps, fixture, flush, part } from './helpers/tour.mjs';

setLogLevel('silent');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const h = React.createElement;
const { TourGuide, useTourGuide } = createReactTourGuide(React);
const steps = demoSteps();

let root = null;
let container;
let cleanup = () => undefined;

beforeEach(() => {
  cleanup = fixture();
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(async () => {
  await React.act(async () => root?.unmount());
  root = null;
  container.remove();
  cleanup();
});

async function render(node) {
  root = createRoot(container);
  await React.act(async () => {
    root.render(h(React.StrictMode, null, node));
  });
  await flush();
}

const tourElement = () => container.querySelector('tour-guide');

const REACT_MAJOR = Number(React.version.split('.')[0]);

/**
 * Known issue on React 18: the adapter forwards `className` as-is, and React 18 renders it on
 * custom elements as a literal `className` attribute (React 19 maps it to `class`).
 */
const CLASSNAME_TODO =
  REACT_MAJOR < 19
    ? 'React 18 renders className literally on custom elements'
    : undefined;

describe(`@xkid1/tour-guide/react with React ${React.version}`, () => {
  it('className reaches the element as its class', { todo: CLASSNAME_TODO }, async () => {
    await render(h(TourGuide, { steps, className: 'app-tour' }));
    assert.equal(tourElement().className, 'app-tour');
    assert.equal(tourElement().hasAttribute('classname'), false);
  });

  it('controlled `open` prop + onEnd keeps state in sync', async () => {
    const log = [];
    let setOpen;
    function App() {
      const [open, set] = React.useState(false);
      setOpen = set;
      return h(TourGuide, {
        steps,
        open,
        theme: 'dark',
        onStart: () => log.push('start'),
        onStepChange: (event) => log.push(`step:${event.detail.index}`),
        onEnd: (event) => {
          log.push(`end:${event.detail.reason}`);
          set(false);
        },
      });
    }
    await render(h(App));
    const element = tourElement();
    assert.equal(element.getAttribute('theme'), 'dark');
    assert.equal(element.isActive, false);

    await React.act(async () => setOpen(true));
    await flush();
    assert.equal(element.isActive, true);

    await React.act(async () => part(element, 'next-button').click());
    await flush();
    assert.equal(element.currentIndex, 1);

    await React.act(async () => part(element, 'close-button').click());
    await flush();
    assert.equal(element.isActive, false);
    // StrictMode mounts effects twice; listeners must not double up.
    assert.deepEqual(log, ['start', 'step:0', 'step:1', 'end:close']);
  });

  it('useTourGuide() controls drive the full user journey', async () => {
    let controls;
    function App() {
      controls = useTourGuide();
      return h(TourGuide, { ref: controls.ref, steps });
    }
    await render(h(App));
    assert.equal(controls.ref.current, tourElement());
    await assertUserJourney(tourElement(), () => React.act(async () => controls.start()));
  });

  it('projects React children into the step slot', async () => {
    await render(
      h(
        TourGuide,
        { steps, open: true },
        h(
          'div',
          { slot: 'step-welcome', id: 'react-slot' },
          'Rendered by ',
          h('b', null, 'React'),
        ),
      ),
    );
    const element = tourElement();
    assert.equal(element.isActive, true);
    const slot = element.shadowRoot.querySelector('slot[name="step-welcome"]');
    assert.ok(slot, 'named slot for the step id');
    assert.equal(document.getElementById('react-slot').assignedSlot ?? slot, slot);
  });

  it('re-renders with new steps while open', async () => {
    let setSteps;
    function App() {
      const [list, set] = React.useState(steps);
      setSteps = set;
      return h(TourGuide, { steps: list, open: true });
    }
    await render(h(App));
    await React.act(async () => setSteps([{ title: 'Only' }]));
    await flush();
    assert.equal(tourElement().total, 1);
    assert.equal(part(tourElement(), 'title').textContent, 'Only');
  });

  it('unmounting closes listeners without errors', async () => {
    await render(h(TourGuide, { steps, open: true }));
    const element = tourElement();
    await React.act(async () => root.unmount());
    root = null;
    assert.equal(element.isConnected, false);
    assert.equal(element.isActive, false);
  });
});
