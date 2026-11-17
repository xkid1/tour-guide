import { describe, expect, it, vi } from 'vitest';

import type { TourStep } from '@types';

import { TourManager } from './tour-manager';

const steps: TourStep[] = [{ title: 'One' }, { title: 'Two' }, { title: 'Three' }];

describe('TourManager', () => {
  it('does not start without steps', async () => {
    const manager = new TourManager();
    expect(await manager.start()).toBe(false);
    expect(manager.status).toBe('idle');
  });

  it('starts, navigates and completes', async () => {
    const onChange = vi.fn();
    const onEnd = vi.fn();
    const manager = new TourManager({ onChange, onEnd });
    manager.setSteps(steps);

    expect(await manager.start()).toBe(true);
    expect(manager.index).toBe(0);
    expect(manager.isFirst).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith(0, -1, 1);

    await manager.next();
    expect(manager.index).toBe(1);
    await manager.back();
    expect(manager.index).toBe(0);
    expect(onChange).toHaveBeenLastCalledWith(0, 1, -1);

    await manager.goTo(2);
    expect(manager.isLast).toBe(true);
    await manager.next();
    expect(manager.status).toBe('completed');
    expect(onEnd).toHaveBeenCalledWith('complete', 2);
  });

  it('clamps the start index', async () => {
    const manager = new TourManager();
    manager.setSteps(steps);
    await manager.start(99);
    expect(manager.index).toBe(2);
  });

  it('rejects out-of-range goTo and back on first step', async () => {
    const manager = new TourManager();
    manager.setSteps(steps);
    await manager.start();
    expect(await manager.goTo(-1)).toBe(false);
    expect(await manager.goTo(3)).toBe(false);
    expect(await manager.back()).toBe(false);
  });

  it('honours beforeLeave returning false', async () => {
    const manager = new TourManager();
    manager.setSteps([{ title: 'A', beforeLeave: () => false }, { title: 'B' }]);
    await manager.start();
    expect(await manager.next()).toBe(false);
    expect(manager.index).toBe(0);
  });

  it('honours onBeforeChange returning false', async () => {
    const manager = new TourManager({ onBeforeChange: (_from, to) => to !== 1 });
    manager.setSteps(steps);
    await manager.start();
    expect(await manager.next()).toBe(false);
    expect(await manager.goTo(2)).toBe(true);
  });

  it('awaits async beforeShow and drops superseded transitions', async () => {
    let release: () => void = () => undefined;
    const slow = new Promise<void>((resolve) => {
      release = resolve;
    });
    const manager = new TourManager();
    manager.setSteps([
      { title: 'A' },
      { title: 'B', beforeShow: () => slow },
      { title: 'C' },
    ]);
    await manager.start();

    const toB = manager.goTo(1);
    const toC = manager.goTo(2);
    expect(await toC).toBe(true);
    release();
    expect(await toB).toBe(false);
    expect(manager.index).toBe(2);
  });

  it('skip and close end the tour with the right status', async () => {
    const onEnd = vi.fn();
    const manager = new TourManager({ onEnd });
    manager.setSteps(steps);
    await manager.start();
    expect(manager.skip()).toBe(true);
    expect(manager.status).toBe('skipped');
    expect(manager.close()).toBe(false);

    await manager.start();
    manager.close();
    expect(manager.status).toBe('closed');
    expect(onEnd).toHaveBeenCalledTimes(2);
  });

  it('reset returns to idle silently', async () => {
    const onEnd = vi.fn();
    const manager = new TourManager({ onEnd });
    manager.setSteps(steps);
    await manager.start();
    manager.reset();
    expect(manager.status).toBe('idle');
    expect(manager.index).toBe(-1);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('clamps the index when steps shrink while active', async () => {
    const manager = new TourManager();
    manager.setSteps(steps);
    await manager.start(2);
    manager.setSteps([{ title: 'only' }]);
    expect(manager.index).toBe(0);
  });

  describe('error handling', () => {
    it('cancels navigation and reports when beforeLeave throws', async () => {
      const onError = vi.fn();
      const manager = new TourManager({ onError });
      manager.setSteps([
        {
          id: 'a',
          beforeLeave: () => {
            throw new Error('boom');
          },
        },
        { title: 'B' },
      ]);
      await manager.start();
      expect(await manager.next()).toBe(false);
      expect(manager.index).toBe(0);
      expect(manager.isActive).toBe(true);
      const [error] = onError.mock.calls[0] as [
        { code: string; phase: string; stepId: string },
      ];
      expect(error).toMatchObject({
        code: 'HOOK_FAILED',
        phase: 'beforeLeave',
        stepId: 'a',
      });
    });

    it('cancels navigation when an async beforeShow rejects', async () => {
      const onError = vi.fn();
      const onChange = vi.fn();
      const manager = new TourManager({ onError, onChange });
      manager.setSteps([
        { title: 'A' },
        { beforeShow: () => Promise.reject(new Error('404')) },
      ]);
      await manager.start();
      expect(await manager.next()).toBe(false);
      expect(manager.index).toBe(0);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'beforeShow', stepIndex: 1 }),
      );
    });

    it('reports onBeforeChange failures', async () => {
      const onError = vi.fn();
      const manager = new TourManager({
        onError,
        onBeforeChange: () => {
          throw new Error('listener');
        },
      });
      manager.setSteps(steps);
      expect(await manager.start()).toBe(false);
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'beforeChange' }),
      );
    });

    it('goes back to idle without onStart when the first step fails', async () => {
      const onStart = vi.fn();
      const manager = new TourManager({ onStart });
      manager.setSteps([
        {
          beforeShow: () => {
            throw new Error('nope');
          },
        },
      ]);
      expect(await manager.start()).toBe(false);
      expect(manager.status).toBe('idle');
      expect(onStart).not.toHaveBeenCalled();
    });

    it('fires onStart once, right before the first onChange', async () => {
      const calls: string[] = [];
      const manager = new TourManager({
        onStart: () => calls.push('start'),
        onChange: (index) => calls.push(`change:${index}`),
      });
      manager.setSteps(steps);
      await manager.start(1);
      await manager.next();
      expect(calls).toEqual(['start', 'change:1', 'change:2']);
    });

    it('switches synchronously when no step has hooks', () => {
      const manager = new TourManager();
      manager.setSteps(steps);
      void manager.start();
      expect(manager.index).toBe(0);
      void manager.next();
      expect(manager.index).toBe(1);
    });

    it('rejects non-integer indexes', async () => {
      const manager = new TourManager();
      manager.setSteps(steps);
      await manager.start();
      expect(await manager.goTo(1.5)).toBe(false);
      expect(await manager.goTo(Number.NaN)).toBe(false);
    });
  });
});
