/**
 * <tour-guide> end to end in happy-dom: creation, first render, step changes, repositioning,
 * declarative parsing and validation. happy-dom is slower than a browser, so treat these as
 * relative numbers (compare runs, not absolute budgets).
 */
import { afterAll, beforeAll, describe, test } from 'vitest';

import { defineTourGuide, resolveOptions, validateSteps } from '@libs';
import type { TourGuideElement } from '@libs';
import type { TourStep } from '@types';

import { RUN } from './options';

const validate = validateSteps;
const resolve = resolveOptions;

const flush = () =>
  new Promise((done) => {
    setTimeout(done, 0);
  });

const demoSteps = (count: number): TourStep[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `s${i}`,
    title: `Step ${i}`,
    content: `Content for step ${i}`,
    target: i % 2 === 0 ? '#anchor' : undefined,
  }));

beforeAll(() => {
  defineTourGuide();
  document.body.innerHTML = '<button id="anchor">Anchor</button>';
  const anchor = document.getElementById('anchor')!;
  anchor.getBoundingClientRect = () => new DOMRect(400, 300, 120, 40);
});

afterAll(() => {
  document.body.innerHTML = '';
});

function mount(steps: TourStep[]): TourGuideElement {
  const element = document.createElement('tour-guide');
  element.steps = steps;
  document.body.append(element);
  return element;
}

describe('<tour-guide>', () => {
  test('lifecycle', async ({ bench }) => {
    const steps = demoSteps(10);
    await bench.compare(
      bench('create + connect + remove', () => {
        mount(steps).remove();
      }),
      bench('cold start (first render) + close', async () => {
        const element = mount(steps);
        await element.start();
        element.close();
        element.remove();
      }),
      RUN,
    );
  });

  test('navigation', async ({ bench }) => {
    const element = mount(demoSteps(10));
    await element.start();
    await bench.compare(
      bench('next() / back() (re-render step)', async () => {
        await element.next();
        await element.back();
      }),
      bench('goTo() across the tour', async () => {
        await element.goTo(9);
        await element.goTo(0);
      }),
      bench('refresh() (reposition only)', () => {
        element.refresh();
      }),
      RUN,
    );
    element.close();
    element.remove();
  });

  test('setup work', async ({ bench }) => {
    const many = demoSteps(100);
    const markup = `<tour-guide>${many
      .map(
        (step) =>
          `<tour-step title="${step.title ?? ''}">Content for ${step.id ?? ''}</tour-step>`,
      )
      .join('')}</tour-guide>`;
    await bench.compare(
      bench('parse 100 declarative <tour-step>', async () => {
        const host = document.createElement('div');
        host.innerHTML = markup;
        document.body.append(host);
        const element = host.firstElementChild as TourGuideElement;
        await element.start();
        element.close();
        host.remove();
        await flush();
      }),
      bench('validateSteps(100)', () => {
        validate(many);
      }),
      bench('resolveOptions()', () => {
        resolve({ placement: 'top', labels: { next: 'Weiter' } });
      }),
      RUN,
    );
  });
});
