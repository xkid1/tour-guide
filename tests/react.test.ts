import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createReactTourGuide } from '@apps';
import type { TourGuideElement } from '@libs';
import type { TourStep } from '@types';

import type { Root } from 'react-dom/client';

const { TourGuide, useTourGuide } = createReactTourGuide(React);
const steps: TourStep[] = [{ title: 'One' }, { title: 'Two' }];

let root: Root | null = null;
let container: HTMLElement;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  await React.act(async () => root?.unmount());
  root = null;
  container.remove();
});

async function render(node: React.ReactNode) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await React.act(async () => {
    root!.render(node);
  });
}

describe('React adapter', () => {
  it('renders <tour-guide>, opens via prop and forwards events', async () => {
    const onStepChange = vi.fn();
    const onEnd = vi.fn();
    const ref = React.createRef<TourGuideElement>();

    await render(
      React.createElement(TourGuide, {
        ref,
        steps,
        open: true,
        theme: 'dark',
        className: 'my-tour',
        onStepChange: (e) => {
          onStepChange(e.detail.index);
        },
        onEnd: (e) => {
          onEnd(e.detail.reason);
        },
      }),
    );

    const element = container.querySelector('tour-guide')!;
    expect(ref.current).toBe(element);
    expect(element.getAttribute('theme')).toBe('dark');
    expect(element.className).toBe('my-tour');
    expect(element.isActive).toBe(true);
    expect(onStepChange).toHaveBeenCalledWith(0);

    await React.act(async () => {
      await element.next();
      element.skip();
    });
    expect(onEnd).toHaveBeenCalledWith('skip');
  });

  it('closes when open becomes false and updates options', async () => {
    function App({ open }: { open: boolean }) {
      return React.createElement(TourGuide, {
        steps,
        open,
        options: { labels: { next: 'Go' } },
      });
    }
    await render(React.createElement(App, { open: true }));
    const element = container.querySelector('tour-guide')!;
    expect(element.shadowRoot!.querySelector('.primary')!.textContent).toBe('Go');
    await React.act(async () => {
      root!.render(React.createElement(App, { open: false }));
    });
    expect(element.status).toBe('closed');
  });

  it('useTourGuide exposes imperative controls', async () => {
    let controls!: ReturnType<typeof useTourGuide>;
    function App() {
      controls = useTourGuide();
      return React.createElement(TourGuide, { ref: controls.ref, steps });
    }
    await render(React.createElement(App));
    await React.act(async () => {
      await controls.start();
      await controls.next();
    });
    expect(controls.ref.current?.currentIndex).toBe(1);
    await React.act(async () => {
      await controls.back();
      await controls.goTo(1);
    });
    expect(controls.complete()).toBe(true);
    expect(controls.close()).toBe(false);
    expect(controls.skip()).toBe(false);
  });
});
