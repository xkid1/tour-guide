import { afterEach, describe, expect, it, vi } from 'vitest';

import { TOUR_STYLES, applyStyles } from './styles';

const shadowRoot = () => document.createElement('div').attachShadow({ mode: 'open' });
const sheetText = (sheet: CSSStyleSheet | undefined) =>
  [...(sheet?.cssRules ?? [])].map((rule) => rule.cssText).join('\n');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('applyStyles() with constructable stylesheets', () => {
  it('adopts the shared base sheet and adds no inline <style> (strict CSP safe)', () => {
    const first = shadowRoot();
    const second = shadowRoot();
    applyStyles(first);
    applyStyles(second, '');

    expect(first.querySelectorAll('style')).toHaveLength(0);
    expect(first.adoptedStyleSheets).toHaveLength(1);
    expect(second.adoptedStyleSheets[0]).toBe(first.adoptedStyleSheets[0]);
    expect(first.adoptedStyleSheets[0]?.cssRules.length).toBeGreaterThan(0);
  });

  it('puts custom CSS in its own adopted sheet after the base, and updates it', () => {
    const shadow = shadowRoot();
    const styles = applyStyles(shadow, '.popover { color: red; }');

    expect(shadow.querySelectorAll('style')).toHaveLength(0);
    expect(shadow.adoptedStyleSheets).toHaveLength(2);
    const custom = shadow.adoptedStyleSheets[1];
    expect(sheetText(custom)).toContain('red');

    styles.setCustom('.popover { color: blue; }');
    expect(shadow.adoptedStyleSheets).toHaveLength(2);
    expect(shadow.adoptedStyleSheets[1]).toBe(custom);
    expect(sheetText(custom)).toContain('blue');

    styles.setCustom('');
    expect(sheetText(custom)).toBe('');
  });

  it('creates the custom sheet lazily, on the first non-empty CSS', () => {
    const shadow = shadowRoot();
    const styles = applyStyles(shadow);
    styles.setCustom('');
    expect(shadow.adoptedStyleSheets).toHaveLength(1);

    styles.setCustom('.title { margin: 0; }');
    expect(shadow.adoptedStyleSheets).toHaveLength(2);
  });
});

describe('applyStyles() without constructable stylesheets (older WebViews)', () => {
  it('falls back to <style> elements and only adds the custom one when needed', () => {
    vi.stubGlobal('CSSStyleSheet', undefined);
    const shadow = shadowRoot();
    const styles = applyStyles(shadow);

    const base = shadow.querySelectorAll('style');
    expect(base).toHaveLength(1);
    expect(base[0]?.textContent).toBe(TOUR_STYLES);
    expect(shadow.querySelector('style[data-tg-custom]')).toBeNull();

    styles.setCustom('.popover { color: red; }');
    const custom = shadow.querySelector('style[data-tg-custom]');
    expect(custom?.textContent).toBe('.popover { color: red; }');
    expect(shadow.lastElementChild).toBe(custom);

    styles.setCustom('.popover { color: blue; }');
    expect(shadow.querySelectorAll('style[data-tg-custom]')).toHaveLength(1);
    expect(custom?.textContent).toBe('.popover { color: blue; }');
  });

  it('falls back to <style> when adopting the sheet throws', () => {
    const shadow = shadowRoot();
    vi.spyOn(shadow, 'adoptedStyleSheets', 'set').mockImplementation(() => {
      throw new Error('not supported');
    });
    applyStyles(shadow, '.x { color: red; }');

    expect(shadow.querySelectorAll('style')).toHaveLength(2);
    expect(shadow.querySelector('style[data-tg-custom]')?.textContent).toContain('red');
  });
});
