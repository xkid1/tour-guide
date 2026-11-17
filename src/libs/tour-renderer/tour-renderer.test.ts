import { describe, expect, it, vi } from 'vitest';

import { resolveOptions } from '../defaults/defaults';

import { TourRenderer } from './tour-renderer';

function setup() {
  const host = document.createElement('div');
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const handlers = {
    onClose: vi.fn(),
    onBack: vi.fn(),
    onSkip: vi.fn(),
    onPrimary: vi.fn(),
    onBackdropClick: vi.fn(),
  };
  return new TourRenderer(shadow, handlers, resolveOptions());
}

/** Makes `root.getAnimations()` report one running animation that the test finishes. */
function runningAnimation(renderer: TourRenderer) {
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const animation = {
    playState: 'running',
    pending: false,
    finished,
  } as unknown as Animation;
  vi.spyOn(renderer.root, 'getAnimations').mockReturnValue([animation]);
  return {
    finish: async () => {
      finish();
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    },
  };
}

describe('TourRenderer motion', () => {
  it('hides synchronously when no exit animation runs', () => {
    const renderer = setup();
    renderer.show();
    renderer.hide();
    expect(renderer.root.hidden).toBe(true);
    expect(renderer.isClosing).toBe(false);
    renderer.hide(); // already hidden: no-op
    expect(renderer.root.hidden).toBe(true);
  });

  it('plays the exit animation before hiding', async () => {
    const renderer = setup();
    renderer.show();
    renderer.animateStep(1, true);
    const exit = runningAnimation(renderer);
    renderer.hide();
    expect(renderer.isClosing).toBe(true);
    expect(renderer.isVisible).toBe(true);
    // Transient step classes are dropped so only the exit animation plays.
    expect(renderer.root.classList.contains('is-moving')).toBe(false);
    expect(renderer.popover.classList.contains('is-stepping')).toBe(false);
    renderer.hide(); // ignored while closing
    await exit.finish();
    expect(renderer.root.hidden).toBe(true);
    expect(renderer.spotlight.hidden).toBe(true);
    expect(renderer.isClosing).toBe(false);
  });

  it('show() during the exit animation cancels it', async () => {
    const renderer = setup();
    renderer.show();
    const exit = runningAnimation(renderer);
    renderer.hide();
    renderer.show();
    expect(renderer.isClosing).toBe(false);
    await exit.finish();
    expect(renderer.root.hidden).toBe(false);
  });

  it('animates a step in the travel direction and glides until settled', async () => {
    const renderer = setup();
    renderer.animateStep(1, true);
    expect(renderer.popover.dataset.direction).toBe('next');
    expect(renderer.popover.classList.contains('is-stepping')).toBe(true);
    expect(renderer.root.classList.contains('is-moving')).toBe(true);

    const glide = runningAnimation(renderer);
    renderer.settle();
    expect(renderer.root.classList.contains('is-moving')).toBe(true);
    await glide.finish();
    expect(renderer.root.classList.contains('is-moving')).toBe(false);

    renderer.animateStep(-1, false);
    expect(renderer.popover.dataset.direction).toBe('back');
    expect(renderer.root.classList.contains('is-moving')).toBe(false);
  });

  it('toggles the scrolling state', () => {
    const renderer = setup();
    renderer.setScrolling(true);
    expect(renderer.root.classList.contains('is-scrolling')).toBe(true);
    renderer.setScrolling(false);
    expect(renderer.root.classList.contains('is-scrolling')).toBe(false);
  });

  it('measures the layout size, ignoring transforms', () => {
    const renderer = setup();
    vi.spyOn(renderer.popover, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ width: 300, height: 100 }),
    );
    expect(renderer.measurePopover()).toEqual({ width: 300, height: 100 });
    // Mid enter-animation the rect is scaled; offsetWidth/Height are not.
    vi.spyOn(renderer.popover, 'offsetWidth', 'get').mockReturnValue(360);
    vi.spyOn(renderer.popover, 'offsetHeight', 'get').mockReturnValue(120);
    expect(renderer.measurePopover()).toEqual({ width: 360, height: 120 });
  });

  describe('target interaction', () => {
    const rect = { top: 10, left: 20, width: 100, height: 40 };
    const render = (renderer: TourRenderer, step = {}, options = {}) => {
      renderer.update({
        context: { step, index: 0, total: 1, direction: 1 },
        isFirst: true,
        isLast: true,
        options: resolveOptions(options),
      });
    };

    it('cuts a hole in the backdrop over the target by default', () => {
      const renderer = setup();
      render(renderer);
      renderer.setSpotlight(rect);
      expect(renderer.backdrop.style.clipPath).toContain('evenodd');
      expect(renderer.backdrop.style.clipPath).toContain('120px 50px');
      renderer.setSpotlight(null);
      expect(renderer.backdrop.style.clipPath).toBe('');
    });

    it('keeps the target blocked when disabled by option or step', () => {
      const renderer = setup();
      render(renderer, {}, { allowTargetInteraction: false });
      renderer.setSpotlight(rect);
      expect(renderer.backdrop.style.clipPath).toBe('');

      render(
        renderer,
        { allowTargetInteraction: true },
        { allowTargetInteraction: false },
      );
      renderer.setSpotlight(rect);
      expect(renderer.backdrop.style.clipPath).toContain('evenodd');

      render(renderer, { allowTargetInteraction: false });
      renderer.setSpotlight(rect);
      expect(renderer.backdrop.style.clipPath).toBe('');
    });
  });
});
