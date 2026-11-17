import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSvelteTourGuide, tourGuide } from '@apps';
import type { TourGuideElement } from '@libs';
import type { TourStep } from '@types';

const steps: TourStep[] = [{ title: 'One' }, { title: 'Two' }];

/** Mimics what Svelte does: create the node, insert it, run the action. */
function mountNode(tag = 'tour-guide'): HTMLElement {
  const node = document.createElement(tag);
  document.body.append(node);
  return node;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Svelte action', () => {
  it('syncs steps, theme and open, and forwards events', async () => {
    const node = mountNode();
    const onStepChange = vi.fn();
    const onEnd = vi.fn();
    const action = tourGuide(node, {
      steps,
      theme: 'dark',
      open: true,
      onStepChange,
      onEnd,
    });
    const element = node as TourGuideElement;

    await Promise.resolve();
    expect(element.isActive).toBe(true);
    expect(element.getAttribute('theme')).toBe('dark');
    expect(onStepChange).toHaveBeenCalledOnce();

    // Svelte calls update() with a fresh object; new handlers are picked up without resubscribing.
    const latest = vi.fn();
    action.update({ steps, open: true, onStepChange: latest, onEnd });
    expect(element.hasAttribute('theme')).toBe(false);
    await element.next();
    expect(latest).toHaveBeenCalledOnce();
    expect(onStepChange).toHaveBeenCalledOnce();

    action.update({ steps, open: false, onEnd });
    expect(element.isActive).toBe(false);
    expect(onEnd).toHaveBeenCalledOnce();

    action.destroy();
    await element.start();
    expect(onEnd).toHaveBeenCalledOnce();
    element.close();
  });

  it('honours startAt, options and only re-applies changed values', async () => {
    const node = mountNode();
    const options = { showProgress: false };
    const action = tourGuide(node, { steps, options, startAt: 1, open: true });
    const element = node as TourGuideElement;
    await Promise.resolve();
    expect(element.currentIndex).toBe(1);
    expect(element.resolvedOptions.showProgress).toBe(false);

    const setter = vi.spyOn(element, 'steps', 'set');
    action.update({ steps, options, startAt: 1, open: true });
    expect(setter).not.toHaveBeenCalled();
    action.update();
    expect(element.options).toEqual({});
    action.destroy();
    expect(element.isActive).toBe(false);
  });

  it('upgrades elements created before registration and rejects plain elements', () => {
    const node = mountNode('svelte-early-tour');
    expect(customElements.get('svelte-early-tour')).toBeUndefined();
    tourGuide(node, { steps }).destroy();
    expect(typeof (node as TourGuideElement).start).toBe('function');

    expect(() => tourGuide(mountNode('div'))).toThrow(/must be placed on a <tour-guide>/);
  });
});

describe('createSvelteTourGuide', () => {
  it('exposes controls bound to the mounted element', async () => {
    const tour = createSvelteTourGuide();
    expect(tour.element()).toBeNull();
    expect(await tour.start()).toBe(false);
    expect(await tour.next()).toBe(false);
    expect(await tour.back()).toBe(false);
    expect(await tour.goTo(1)).toBe(false);
    expect(tour.skip()).toBe(false);
    expect(tour.complete()).toBe(false);
    expect(tour.close()).toBe(false);

    const node = mountNode();
    const action = tour.tourGuide(node, { steps: [...steps, { title: 'Three' }] });
    expect(tour.element()).toBe(node);
    expect(await tour.start()).toBe(true);
    expect(await tour.next()).toBe(true);
    expect(await tour.back()).toBe(true);
    expect(await tour.goTo(2)).toBe(true);
    expect(tour.complete()).toBe(true);
    await tour.start();
    expect(tour.skip()).toBe(true);
    await tour.start();
    expect(tour.close()).toBe(true);

    action.destroy();
    expect(tour.element()).toBeNull();
  });
});
