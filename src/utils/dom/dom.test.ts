import { describe, expect, it, vi } from 'vitest';

import {
  h,
  isEditable,
  rafThrottle,
  resolveTarget,
  scrollIntoViewIfNeeded,
  toNode,
} from './dom';

describe('dom utils', () => {
  it('h creates elements with attributes and children', () => {
    const el = h(
      'button',
      { 'type': 'button', 'disabled': true, 'hidden': false, 'data-x': undefined },
      ['Hi'],
    );
    expect(el.outerHTML).toBe('<button type="button" disabled="">Hi</button>');
  });

  it('resolveTarget handles selectors, elements, functions and errors', () => {
    document.body.innerHTML = '<div id="x"></div>';
    const x = document.getElementById('x')!;
    expect(resolveTarget('#x')).toBe(x);
    expect(resolveTarget(x)).toBe(x);
    expect(resolveTarget(() => x)).toBe(x);
    expect(resolveTarget(() => null)).toBeNull();
    expect(resolveTarget('###invalid')).toBeNull();
    expect(resolveTarget(undefined)).toBeNull();
  });

  it('toNode', () => {
    expect(toNode('', false)).toBeNull();
    expect(toNode('<i>a</i>', false)?.textContent).toBe('<i>a</i>');
    expect(
      (toNode('<i>a</i>', true) as DocumentFragment).querySelector('i'),
    ).not.toBeNull();
    const node = document.createElement('p');
    expect(toNode(node, false)).toBe(node);
  });

  it('isEditable', () => {
    expect(isEditable(document.createElement('input'))).toBe(true);
    expect(isEditable(document.createElement('div'))).toBe(false);
    expect(isEditable(null)).toBe(false);
  });

  it('rafThrottle coalesces calls', async () => {
    const fn = vi.fn();
    const scheduler = rafThrottle(fn);
    scheduler.schedule();
    scheduler.schedule();
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    scheduler.schedule();
    scheduler.cancel();
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  describe('scrollIntoViewIfNeeded', () => {
    const at = (y: number, height = 40) => {
      const el = document.createElement('div');
      el.scrollIntoView = vi.fn();
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(
        DOMRect.fromRect({ x: 20, y, width: 100, height }),
      );
      return el;
    };
    const viewport = window.innerHeight;

    it('leaves visible elements alone', () => {
      const el = at(100);
      expect(scrollIntoViewIfNeeded(el, 'smooth')).toBe(false);
      expect(el.scrollIntoView).not.toHaveBeenCalled();
    });

    it('centres elements below the fold (e.g. in the footer)', () => {
      const el = at(viewport + 200);
      expect(scrollIntoViewIfNeeded(el, 'smooth')).toBe(true);
      expect(el.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    });

    it('scrolls when the margin around the element would be clipped', () => {
      expect(scrollIntoViewIfNeeded(at(4), 'auto')).toBe(false);
      expect(scrollIntoViewIfNeeded(at(4), 'auto', 8)).toBe(true);
    });

    it('aligns elements taller than the viewport to the top', () => {
      const el = at(-50, viewport + 100);
      scrollIntoViewIfNeeded(el, 'auto');
      expect(el.scrollIntoView).toHaveBeenCalledWith(
        expect.objectContaining({ block: 'start' }),
      );
    });

    it('is a no-op without scrollIntoView', () => {
      const el = document.createElement('div');
      Object.defineProperty(el, 'scrollIntoView', { value: undefined });
      expect(scrollIntoViewIfNeeded(el, 'auto')).toBe(false);
    });
  });
});
