import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Vue from 'vue';

import { createVueTourGuide } from '@apps';
import type { TourStep } from '@types';

const TourGuide = createVueTourGuide(Vue) as Vue.Component;
const steps: TourStep[] = [{ title: 'One' }, { title: 'Two' }];

let app: Vue.App | null = null;

afterEach(() => {
  app?.unmount();
  app = null;
  document.body.innerHTML = '';
});

describe('Vue adapter', () => {
  it('mounts, opens via v-model:open and emits events', async () => {
    const onStepChange = vi.fn();
    const open = Vue.ref(true);
    const tour = Vue.ref<{ next: () => Promise<boolean>; skip: () => boolean } | null>(
      null,
    );

    app = Vue.createApp({
      setup: () => () =>
        Vue.h(TourGuide, {
          'ref': tour,
          steps,
          'theme': 'dark',
          'open': open.value,
          'onUpdate:open': (value: boolean) => (open.value = value),
          'onStepChange': (e: CustomEvent<{ index: number }>) => {
            onStepChange(e.detail.index);
          },
        }),
    });
    const root = document.createElement('div');
    document.body.append(root);
    app.mount(root);
    await Vue.nextTick();

    const element = root.querySelector('tour-guide')!;
    expect(element.getAttribute('theme')).toBe('dark');
    expect(element.isActive).toBe(true);
    expect(onStepChange).toHaveBeenCalledWith(0);

    await tour.value!.next();
    expect(element.currentIndex).toBe(1);
    tour.value!.skip();
    await Vue.nextTick();
    expect(open.value).toBe(false);
  });

  it('reacts to steps and open changes', async () => {
    const open = Vue.ref(false);
    const list = Vue.ref<TourStep[]>([{ title: 'A' }]);
    app = Vue.createApp({
      setup: () => () => Vue.h(TourGuide, { steps: list.value, open: open.value }),
    });
    const root = document.createElement('div');
    document.body.append(root);
    app.mount(root);
    const element = root.querySelector('tour-guide')!;

    open.value = true;
    await Vue.nextTick();
    expect(element.isActive).toBe(true);

    list.value = [{ title: 'B' }, { title: 'C' }];
    await Vue.nextTick();
    expect(element.total).toBe(2);

    open.value = false;
    await Vue.nextTick();
    expect(element.status).toBe('closed');
  });
});
