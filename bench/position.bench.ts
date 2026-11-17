/**
 * computePosition() runs on every scroll/resize frame while a tour is open, so it must stay
 * far below a frame budget (16 ms) even in the worst flip/clamp case.
 */
import { describe, expect, test } from 'vitest';

import type { PositionInput } from '@types';
import { computePosition as imported } from '@utils';

import { RUN } from './options';

// Bind once: calling through the module's export getter in a hot loop skews the timings.
const computePosition = imported;

const viewport = { width: 1280, height: 800 };
const popover = { width: 320, height: 180 };

const base: PositionInput = {
  target: { top: 300, left: 500, width: 120, height: 40 },
  popover,
  viewport,
  placement: 'bottom',
  offset: 12,
  margin: 8,
};

/** Target hugging the bottom-right corner: bottom and right overflow, forcing flips + clamps. */
const cornered: PositionInput = {
  ...base,
  target: { top: 760, left: 1200, width: 60, height: 30 },
};
const auto: PositionInput = { ...base, placement: 'auto' };
const centred: PositionInput = { ...base, target: null, placement: 'center' };

describe('computePosition', () => {
  test('placements', async ({ bench }) => {
    const result = await bench.compare(
      bench('bottom (fits)', () => {
        computePosition(base);
      }),
      bench('auto', () => {
        computePosition(auto);
      }),
      bench('bottom → flip + clamp (cornered target)', () => {
        computePosition(cornered);
      }),
      bench('center (no target)', () => {
        computePosition(centred);
      }),
      RUN,
    );
    // Sanity bound, not a micro-target: one call stays far below 0.05 ms on any CI machine.
    expect(
      result.get('bottom → flip + clamp (cornered target)').latency.mean,
    ).toBeLessThan(0.05);
  });

  test('scroll burst', async ({ bench }) => {
    const inputs = Array.from({ length: 1000 }, (_, i): PositionInput => ({
      ...base,
      target: { top: (i * 7) % 800, left: (i * 13) % 1280, width: 80, height: 30 },
      placement: 'auto',
    }));
    const result = await bench('1 000 × auto', () => {
      for (const input of inputs) computePosition(input);
    }).run(RUN);
    // 1 000 frames' worth of positioning in well under one frame.
    expect(result.latency.mean).toBeLessThan(16);
  });
});
