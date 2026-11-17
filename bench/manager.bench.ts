/**
 * TourManager: the DOM-free state machine behind every navigation (async hooks, race tokens).
 */
import { describe, expect, test } from 'vitest';

import { TourManager as Imported } from '@libs';
import type { TourStep } from '@types';

import { RUN } from './options';

const TourManager = Imported;

const steps = (count: number, hooks = false): TourStep[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `step-${i}`,
    title: `Step ${i}`,
    ...(hooks
      ? {
          beforeShow: () => Promise.resolve(),
          beforeLeave: () => true,
          afterShow: () => undefined,
        }
      : {}),
  }));

const tenSteps = steps(10);
const hundredSteps = steps(100);
const hookedSteps = steps(100, true);

async function walk(manager: Imported, list: TourStep[]): Promise<void> {
  manager.setSteps(list);
  await manager.start();
  for (let i = 1; i < list.length; i += 1) await manager.next();
  manager.complete();
}

describe('TourManager', () => {
  test('full tour (start → next … → complete)', async ({ bench }) => {
    const manager = new TourManager();
    const result = await bench.compare(
      bench('10 steps', async () => {
        await walk(manager, tenSteps);
      }),
      bench('100 steps', async () => {
        await walk(manager, hundredSteps);
      }),
      bench('100 steps with async hooks', async () => {
        await walk(manager, hookedSteps);
      }),
      RUN,
    );
    // Navigation overhead per step stays in the microseconds, hooks included.
    expect(result.get('100 steps with async hooks').latency.mean / 100).toBeLessThan(0.1);
  });

  test('rapid goTo() (superseded transitions)', async ({ bench }) => {
    const manager = new TourManager();
    manager.setSteps(hookedSteps);
    await manager.start();
    // Fire-and-forget like a user mashing "next": only the last transition may win.
    await bench('50 overlapping goTo()', async () => {
      const pending: Promise<boolean>[] = [];
      for (let i = 0; i < 50; i += 1) pending.push(manager.goTo((i * 37) % 100));
      await Promise.all(pending);
    }).run(RUN);
  });
});
