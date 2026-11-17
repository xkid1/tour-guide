/** Vue 3: the component wrapper, v-model:open, exposed methods and raw <tour-guide> tags. */
import './helpers/dom.mjs';

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import * as Vue from 'vue';

import { setLogLevel } from '@xkid1/tour-guide';
import { createVueTourGuide } from '@xkid1/tour-guide/vue';

import { assertUserJourney, demoSteps, fixture, flush, part } from './helpers/tour.mjs';

setLogLevel('silent');

const TourGuide = createVueTourGuide(Vue);
const steps = demoSteps();

let app = null;
let host;
let cleanup = () => undefined;

beforeEach(() => {
  cleanup = fixture();
  host = document.createElement('div');
  document.body.append(host);
});

afterEach(() => {
  app?.unmount();
  app = null;
  host.remove();
  cleanup();
});

async function mount(component) {
  app = Vue.createApp(component);
  app.mount(host);
  await Vue.nextTick();
  await flush();
}

const tourElement = () => host.querySelector('tour-guide');

describe(`@xkid1/tour-guide/vue with Vue ${Vue.version}`, () => {
  it('v-model:open opens, emits and syncs back on close', async () => {
    const open = Vue.ref(false);
    const log = [];
    await mount({
      setup: () => () =>
        Vue.h(TourGuide, {
          steps,
          'theme': 'dark',
          'open': open.value,
          'onUpdate:open': (value) => {
            open.value = value;
          },
          'onStepChange': (event) => log.push(`step:${event.detail.index}`),
          'onEnd': (event) => log.push(`end:${event.detail.reason}`),
        }),
    });
    const element = tourElement();
    assert.equal(element.getAttribute('theme'), 'dark');

    open.value = true;
    await Vue.nextTick();
    await flush();
    assert.equal(element.isActive, true);

    part(element, 'skip-button').click();
    await Vue.nextTick();
    await flush();
    assert.equal(element.isActive, false);
    assert.equal(open.value, false, 'update:open(false) was emitted');
    assert.deepEqual(log, ['step:0', 'end:skip']);
  });

  it('template ref exposes start/next/back/goTo/close', async () => {
    const tour = Vue.ref(null);
    await mount({ setup: () => () => Vue.h(TourGuide, { ref: tour, steps }) });
    await assertUserJourney(tourElement(), () => tour.value.start());
    assert.equal(tour.value.element(), tourElement());
  });

  it('reacts to deep step changes', async () => {
    const list = Vue.reactive([{ title: 'First' }]);
    await mount({ setup: () => () => Vue.h(TourGuide, { steps: list, open: true }) });
    list[0].title = 'Renamed';
    await Vue.nextTick();
    await flush();
    assert.equal(part(tourElement(), 'title').textContent, 'Renamed');
  });

  it('default slot content reaches the step slot', async () => {
    await mount({
      setup: () => () =>
        Vue.h(TourGuide, { steps, open: true }, () =>
          Vue.h('div', { slot: 'step-welcome', id: 'vue-slot' }, 'From Vue'),
        ),
    });
    assert.equal(document.getElementById('vue-slot').parentElement, tourElement());
  });

  it('raw <tour-guide> in a compiled template (isCustomElement)', async () => {
    // Runtime template compilation, the same path as an SFC with isCustomElement set.
    const { compile } = Vue;
    app = Vue.createApp({
      data: () => ({ steps }),
      render: compile(
        '<tour-guide ref="tour" :steps="steps" theme="dark"></tour-guide>',
        {
          isCustomElement: (tag) => tag === 'tour-guide',
        },
      ),
    });
    app.mount(host);
    await Vue.nextTick();
    const element = tourElement();
    assert.equal(element.total, 3, ':steps binds the DOM property');
    await element.start();
    await flush();
    assert.equal(element.isActive, true);
  });
});
