import { describe, expect, it } from 'vitest';

import { getFocusableElements, handleFocusTrap } from './focus';

describe('focus utils', () => {
  it('finds focusable elements and skips hidden/disabled ones', () => {
    document.body.innerHTML = `<div id="c"><button>a</button><button disabled>b</button><a href="#">c</a><input type="hidden"><span tabindex="0">d</span><div hidden><button>e</button></div></div>`;
    const items = getFocusableElements(document.getElementById('c')!);
    expect(items.map((el) => el.textContent)).toEqual(['a', 'c', 'd']);
  });

  it('wraps focus with Tab and Shift+Tab', () => {
    document.body.innerHTML = `<div id="c" tabindex="-1"><button id="a">a</button><button id="b">b</button></div>`;
    const container = document.getElementById('c')!;
    const a = document.getElementById('a')!;
    const b = document.getElementById('b')!;

    b.focus();
    const forward = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    handleFocusTrap(forward, container);
    expect(document.activeElement).toBe(a);
    expect(forward.defaultPrevented).toBe(true);

    const backward = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      cancelable: true,
    });
    handleFocusTrap(backward, container);
    expect(document.activeElement).toBe(b);
  });
});
