import type { Rect } from '@types';

/** True when the user asked the OS to minimise animations. */
export function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** `smooth` becomes `auto` (instant) for users who prefer reduced motion. */
export function resolveScrollBehavior(behavior: ScrollBehavior): ScrollBehavior {
  return behavior === 'smooth' && prefersReducedMotion() ? 'auto' : behavior;
}

/**
 * Calls `done` once every animation and transition running on `element` (and, by default, its
 * subtree) has finished or was cancelled. Runs `done` synchronously when nothing is running
 * (no Web Animations support, `prefers-reduced-motion`, zero durations...).
 * Returns a function that cancels the pending callback.
 */
export function afterAnimations(
  element: Element,
  done: () => void,
  subtree = true,
): () => void {
  const animations =
    typeof element.getAnimations === 'function' ? element.getAnimations({ subtree }) : [];
  const running = animations.filter(
    (animation) => animation.playState === 'running' || animation.pending,
  );
  if (running.length === 0) {
    done();
    return () => undefined;
  }
  let cancelled = false;
  void Promise.all(
    running.map((animation) => animation.finished.catch(() => undefined)),
  ).then(() => {
    if (!cancelled) done();
  });
  return () => {
    cancelled = true;
  };
}

const sameRect = (a: Rect, b: Rect) =>
  Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5;

/**
 * Calls `done` once `element` stops moving on screen, i.e. when a (smooth) scroll has settled:
 * its position is unchanged for `stableFrames` consecutive frames, or `timeout` ms passed.
 * Works for every scroll container and doesn't depend on the `scrollend` event.
 * Returns a function that cancels the wait.
 */
export function waitForScrollEnd(
  element: Element,
  done: () => void,
  { timeout = 1000, stableFrames = 3 }: { timeout?: number; stableFrames?: number } = {},
): () => void {
  const raf =
    typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (fn: FrameRequestCallback) =>
          setTimeout(() => {
            fn(Date.now());
          }, 16) as unknown as number;
  const caf =
    typeof cancelAnimationFrame === 'function'
      ? cancelAnimationFrame
      : (id: number) => {
          clearTimeout(id);
        };

  const started = Date.now();
  let last: Rect = element.getBoundingClientRect();
  let stable = 0;
  let frame: number | null = null;

  const tick = () => {
    const rect = element.getBoundingClientRect();
    stable = sameRect(rect, last) ? stable + 1 : 0;
    last = rect;
    if (stable >= stableFrames || Date.now() - started >= timeout) {
      frame = null;
      done();
      return;
    }
    frame = raf(tick);
  };
  frame = raf(tick);

  return () => {
    if (frame !== null) caf(frame);
    frame = null;
  };
}
