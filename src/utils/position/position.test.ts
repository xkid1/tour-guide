import { describe, expect, it } from 'vitest';

import {
  clamp,
  computePosition,
  isMobileViewport,
  padRect,
  resolveSheetEdge,
  computeMobilePosition,
} from './position';

const viewport = { width: 1000, height: 800 };
const popover = { width: 300, height: 150 };
const base = { popover, viewport, offset: 10, margin: 12 };

describe('computePosition', () => {
  it('centres when there is no target', () => {
    const result = computePosition({ ...base, target: null, placement: 'auto' });
    expect(result).toEqual({ top: 325, left: 350, placement: 'center', arrow: null });
  });

  it('centres when placement is center', () => {
    const result = computePosition({
      ...base,
      target: { top: 10, left: 10, width: 10, height: 10 },
      placement: 'center',
    });
    expect(result.placement).toBe('center');
  });

  it('respects the preferred side when it fits', () => {
    const target = { top: 400, left: 400, width: 100, height: 40 };
    const result = computePosition({ ...base, target, placement: 'top' });
    expect(result.placement).toBe('top');
    expect(result.top).toBe(400 - 10 - 150);
    expect(result.left).toBe(450 - 150);
    expect(result.arrow).toEqual({ left: 150 });
  });

  it('flips to the opposite side when the preferred one does not fit', () => {
    const target = { top: 20, left: 400, width: 100, height: 40 };
    const result = computePosition({ ...base, target, placement: 'top' });
    expect(result.placement).toBe('bottom');
    expect(result.top).toBe(70);
  });

  it('auto picks the side with most space', () => {
    const target = { top: 300, left: 20, width: 50, height: 50 };
    const result = computePosition({ ...base, target, placement: 'auto' });
    expect(result.placement).toBe('right');
    expect(result.left).toBe(80);
  });

  it('clamps inside the viewport and keeps the arrow pointing at the target', () => {
    const target = { top: 400, left: 960, width: 30, height: 30 };
    const result = computePosition({ ...base, target, placement: 'bottom' });
    expect(result.left).toBe(1000 - 300 - 12);
    expect(result.arrow).toEqual({ left: 284 });
  });

  it('handles left placement', () => {
    const target = { top: 400, left: 700, width: 50, height: 50 };
    const result = computePosition({ ...base, target, placement: 'left' });
    expect(result.placement).toBe('left');
    expect(result.left).toBe(700 - 10 - 300);
    expect(result.arrow).toHaveProperty('top');
  });

  it('falls back to the roomiest side when nothing fits', () => {
    const target = { top: 0, left: 0, width: 1000, height: 780 };
    const result = computePosition({ ...base, target, placement: 'auto' });
    expect(['top', 'bottom', 'left', 'right']).toContain(result.placement);
    expect(result.top).toBeGreaterThanOrEqual(12);
  });
});

describe('helpers', () => {
  it('clamp', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
    expect(clamp(5, 10, 0)).toBe(10);
  });

  it('padRect', () => {
    expect(padRect({ top: 10, left: 10, width: 10, height: 10 }, 5)).toEqual({
      top: 5,
      left: 5,
      width: 20,
      height: 20,
    });
  });

  it('isMobileViewport', () => {
    expect(isMobileViewport(500, 640)).toBe(true);
    expect(isMobileViewport(640, 640)).toBe(false);
  });
});

describe('resolveSheetEdge', () => {
  const low = { top: 700, left: 0, width: 10, height: 20 };
  const high = { top: 50, left: 0, width: 10, height: 20 };

  it('docks away from the target with auto', () => {
    expect(resolveSheetEdge(low, 800, 'auto')).toBe('top');
    expect(resolveSheetEdge(high, 800, 'auto')).toBe('bottom');
    expect(resolveSheetEdge(null, 800, 'auto')).toBe('bottom');
  });

  it('respects a fixed preference', () => {
    expect(resolveSheetEdge(high, 800, 'top')).toBe('top');
    expect(resolveSheetEdge(low, 800, 'bottom')).toBe('bottom');
  });
});

describe('computeMobilePosition', () => {
  const base = {
    popover: { width: 366, height: 150 },
    viewport: { width: 390, height: 800 },
    offset: 12,
    margin: 12,
  };
  const target = (top: number) => ({ top, left: 20, width: 80, height: 40 });

  it('uses the roomier vertical side, never left/right', () => {
    expect(
      computeMobilePosition({ ...base, target: target(20), placement: 'auto' })
        ?.placement,
    ).toBe('bottom');
    expect(
      computeMobilePosition({ ...base, target: target(700), placement: 'right' })
        ?.placement,
    ).toBe('top');
  });

  it('honours a top/bottom preference when it fits, else flips', () => {
    expect(
      computeMobilePosition({ ...base, target: target(400), placement: 'top' })
        ?.placement,
    ).toBe('top');
    expect(
      computeMobilePosition({ ...base, target: target(40), placement: 'top' })?.placement,
    ).toBe('bottom');
  });

  it('centres without a target and returns null when nothing fits', () => {
    expect(
      computeMobilePosition({ ...base, target: null, placement: 'auto' })?.placement,
    ).toBe('center');
    expect(
      computeMobilePosition({
        ...base,
        target: { top: 100, left: 0, width: 390, height: 600 },
        placement: 'auto',
      }),
    ).toBeNull();
  });
});
