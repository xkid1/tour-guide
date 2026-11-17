import { describe, expect, it, vi } from 'vitest';

import { TourGuideController, createTour, registerTourGuide } from '@apps';

describe('browser adapter', () => {
  it('createTour mounts, runs and destroys', async () => {
    const onEnd = vi.fn();
    const tour = createTour({
      steps: [{ title: 'Hi' }],
      theme: 'dark',
      on: { 'tour-end': onEnd },
    });
    expect(tour.element.isConnected).toBe(true);
    expect(tour.element.getAttribute('theme')).toBe('dark');
    expect(await tour.start()).toBe(true);
    tour.destroy();
    expect(onEnd).toHaveBeenCalledOnce();
    expect(tour.element.isConnected).toBe(false);
  });
});

describe('angular adapter', () => {
  it('controller wraps the element', async () => {
    registerTourGuide();
    const element = document.createElement('tour-guide');
    document.body.append(element);
    const onStep = vi.fn();
    const controller = new TourGuideController(element)
      .setSteps([{ title: 'A' }, { title: 'B' }])
      .setOptions({ showProgress: false })
      .on('tour-step-change', (detail) => {
        onStep(detail.index);
      });
    await controller.start();
    await controller.next();
    await controller.back();
    await controller.goTo(1);
    expect(onStep.mock.calls.map((c) => c[0] as unknown)).toEqual([0, 1, 0, 1]);
    expect(controller.complete()).toBe(true);
    controller.destroy();
    element.remove();
  });
});
