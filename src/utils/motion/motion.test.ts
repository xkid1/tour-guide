import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  afterAnimations,
  prefersReducedMotion,
  resolveScrollBehavior,
  waitForScrollEnd,
} from './motion';

/** A running animation whose `finished` promise the test settles. */
function fakeAnimation() {
  let settle!: (ok: boolean) => void;
  const finished = new Promise<void>((resolve, reject) => {
    settle = (ok) => {
      if (ok) resolve();
      else reject(new Error('cancelled'));
    };
  });
  const animation = {
    playState: 'running',
    pending: false,
    finished,
  } as unknown as Animation;
  return { animation, settle };
}

const tick = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

function mockReducedMotion(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches }) as MediaQueryList),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('reduced motion', () => {
  it('reads prefers-reduced-motion', () => {
    mockReducedMotion(true);
    expect(prefersReducedMotion()).toBe(true);
    mockReducedMotion(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it('is false without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(prefersReducedMotion()).toBe(false);
  });

  it('downgrades smooth scrolling only when motion is reduced', () => {
    mockReducedMotion(true);
    expect(resolveScrollBehavior('smooth')).toBe('auto');
    expect(resolveScrollBehavior('instant')).toBe('instant');
    mockReducedMotion(false);
    expect(resolveScrollBehavior('smooth')).toBe('smooth');
  });
});

describe('afterAnimations', () => {
  it('runs synchronously when nothing is animating', () => {
    const done = vi.fn();
    afterAnimations(document.createElement('div'), done);
    expect(done).toHaveBeenCalledOnce();
  });

  it('runs synchronously without Web Animations support', () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'getAnimations', { value: undefined });
    const done = vi.fn();
    afterAnimations(element, done);
    expect(done).toHaveBeenCalledOnce();
  });

  it('waits for running animations, including cancelled ones', async () => {
    const element = document.createElement('div');
    const a = fakeAnimation();
    const b = fakeAnimation();
    const idle = { playState: 'idle', pending: false } as unknown as Animation;
    const spy = vi
      .spyOn(element, 'getAnimations')
      .mockReturnValue([a.animation, b.animation, idle]);
    const done = vi.fn();
    afterAnimations(element, done);
    expect(spy).toHaveBeenCalledWith({ subtree: true });
    a.settle(true);
    await tick();
    expect(done).not.toHaveBeenCalled();
    b.settle(false);
    await tick();
    expect(done).toHaveBeenCalledOnce();
  });

  it('can be cancelled', async () => {
    const element = document.createElement('div');
    const a = fakeAnimation();
    vi.spyOn(element, 'getAnimations').mockReturnValue([a.animation]);
    const done = vi.fn();
    const cancel = afterAnimations(element, done);
    cancel();
    a.settle(true);
    await tick();
    expect(done).not.toHaveBeenCalled();
  });
});

describe('waitForScrollEnd', () => {
  it('resolves once the element stops moving', async () => {
    const element = document.createElement('div');
    let top = 500;
    vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() =>
      DOMRect.fromRect({ x: 0, y: top, width: 10, height: 10 }),
    );
    const done = vi.fn();
    waitForScrollEnd(element, done, { stableFrames: 2, timeout: 5000 });
    // Simulate a scroll: the element moves for a few frames, then stops.
    for (const next of [400, 300, 200]) {
      top = next;
      await new Promise((resolve) => {
        requestAnimationFrame(resolve);
      });
    }
    expect(done).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(done).toHaveBeenCalledOnce();
    });
  });

  it('gives up after the timeout', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', undefined);
    vi.stubGlobal('cancelAnimationFrame', undefined);
    const element = document.createElement('div');
    let top = 0;
    vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() =>
      DOMRect.fromRect({ x: 0, y: (top += 10), width: 10, height: 10 }),
    );
    const done = vi.fn();
    waitForScrollEnd(element, done, { timeout: 100 });
    vi.advanceTimersByTime(90);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(40);
    expect(done).toHaveBeenCalledOnce();
  });

  it('can be cancelled', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', undefined);
    vi.stubGlobal('cancelAnimationFrame', undefined);
    const done = vi.fn();
    const cancel = waitForScrollEnd(document.createElement('div'), done);
    cancel();
    cancel();
    vi.advanceTimersByTime(2000);
    expect(done).not.toHaveBeenCalled();
  });
});
