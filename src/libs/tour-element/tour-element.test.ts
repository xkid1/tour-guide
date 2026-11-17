import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TourStep } from '@types';

import { TourGuideElement, defineTourGuide } from './tour-element';

defineTourGuide();

const flush = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

function setup(steps: TourStep[] = defaultSteps()) {
  const element = document.createElement('tour-guide');
  element.steps = steps;
  document.body.append(element);
  const shadow = element.shadowRoot!;
  const $ = (selector: string): HTMLElement =>
    shadow.querySelector<HTMLElement>(selector)!;
  return { element, shadow, $ };
}

function defaultSteps(): TourStep[] {
  return [
    { id: 'welcome', title: 'Welcome', content: 'Hello' },
    { target: '#target', title: 'Target', content: '<b>bold</b>' },
    { title: 'Done', content: 'Bye' },
  ];
}

beforeEach(() => {
  document.body.innerHTML =
    '<button id="target">Target</button><button id="outside">outside</button>';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('<tour-guide>', () => {
  it('registers once and supports custom tag names', () => {
    expect(customElements.get('tour-guide')).toBe(TourGuideElement);
    expect(defineTourGuide()).toBe(TourGuideElement);
    const Custom = defineTourGuide('my-tour');
    expect(Custom).not.toBe(TourGuideElement);
    expect(document.createElement('my-tour')).toBeInstanceOf(TourGuideElement);
  });

  it('renders header (title + close), body and footer (back, skip, complete)', async () => {
    const { element, $ } = setup();
    const onStart = vi.fn();
    element.on('tour-start', onStart);

    expect(await element.start()).toBe(true);
    expect(onStart).toHaveBeenCalledOnce();
    expect(element.hasAttribute('open')).toBe(true);
    expect($('.root').hidden).toBe(false);
    expect($('.title').textContent).toBe('Welcome');
    expect($('.close').getAttribute('aria-label')).toBe('Close tour');
    expect($('.close svg')).not.toBeNull();
    expect($('slot').textContent).toBe('Hello');
    expect($('slot').getAttribute('name')).toBe('step-welcome');
    expect($('.back').hidden).toBe(true);
    expect($('.skip').hidden).toBe(false);
    expect($('.primary').textContent).toBe('Next');
    expect($('.progress').textContent).toBe('1 of 3');
    expect($('.popover').getAttribute('role')).toBe('dialog');
  });

  it('renders string content as text unless allowHtml', async () => {
    const { element, $ } = setup();
    await element.start(1);
    expect($('slot').textContent).toBe('<b>bold</b>');
    element.options = { allowHtml: true };
    expect($('slot b').textContent).toBe('bold');
  });

  it('navigates via buttons and completes on the last step', async () => {
    const { element, $ } = setup();
    const changes: number[] = [];
    const onComplete = vi.fn();
    const onEnd = vi.fn();
    element.on('tour-step-change', (e) => changes.push(e.detail.index));
    element.on('tour-complete', onComplete);
    element.on('tour-end', (e) => {
      onEnd(e.detail.reason);
    });

    await element.start();
    $('.primary').click();
    await flush();
    expect(element.currentIndex).toBe(1);
    expect($('.back').hidden).toBe(false);

    $('.back').click();
    await flush();
    expect(element.currentIndex).toBe(0);

    await element.goTo(2);
    expect($('.primary').textContent).toBe('Complete');
    expect($('.primary').getAttribute('part')).toContain('complete-button');
    expect($('.skip').hidden).toBe(true);

    $('.primary').click();
    await flush();
    expect(changes).toEqual([0, 1, 0, 2]);
    expect(onComplete).toHaveBeenCalledOnce();
    expect(onEnd).toHaveBeenCalledWith('complete');
    expect(element.status).toBe('completed');
    expect(element.hasAttribute('open')).toBe(false);
    expect($('.root').hidden).toBe(true);
  });

  it('skip and close buttons end the tour with the right reason', async () => {
    const { element, $ } = setup();
    const reasons: string[] = [];
    element.on('tour-end', (e) => reasons.push(e.detail.reason));

    await element.start();
    $('.skip').click();
    await element.start();
    $('.close').click();
    expect(reasons).toEqual(['skip', 'close']);
  });

  it('highlights the target with the spotlight', async () => {
    const { element, $ } = setup();
    vi.spyOn(document.getElementById('target')!, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 100, y: 100, width: 80, height: 30 }),
    );
    await element.start(1);
    expect($('.spotlight').hidden).toBe(false);
    expect($('.spotlight').style.top).toBe('94px');
    expect($('.popover').dataset.placement).toBeTruthy();
  });

  it('animates Next / Back in the travel direction', async () => {
    const { element, $ } = setup();
    await element.start();
    // The first step is covered by the enter animation, not a step transition.
    expect($('.popover').classList.contains('is-stepping')).toBe(false);
    await element.next();
    expect($('.popover').classList.contains('is-stepping')).toBe(true);
    expect($('.popover').dataset.direction).toBe('next');
    await element.back();
    expect($('.popover').dataset.direction).toBe('back');
  });

  it('hides the popover while scrolling to an off-screen target', async () => {
    const { element, $ } = setup();
    const target = document.getElementById('target')!;
    let top = window.innerHeight + 300;
    vi.spyOn(target, 'getBoundingClientRect').mockImplementation(() =>
      DOMRect.fromRect({ x: 10, y: top, width: 80, height: 30 }),
    );
    target.scrollIntoView = vi.fn(() => {
      top = 200;
    });
    await element.start(1);
    expect(target.scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'smooth', block: 'center' }),
    );
    expect($('.root').classList.contains('is-scrolling')).toBe(true);
    await vi.waitFor(() => {
      expect($('.root').classList.contains('is-scrolling')).toBe(false);
    });
    expect($('.spotlight').style.top).toBe('194px');
  });

  it('stops waiting for the scroll when the tour closes', async () => {
    const { element, $ } = setup();
    const target = document.getElementById('target')!;
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 10, y: -500, width: 80, height: 30 }),
    );
    target.scrollIntoView = vi.fn();
    await element.start(1);
    expect($('.root').classList.contains('is-scrolling')).toBe(true);
    element.close();
    expect($('.root').classList.contains('is-scrolling')).toBe(false);
    expect($('.root').hidden).toBe(true);
  });

  it('centres when the target is missing', async () => {
    const { element, $ } = setup([{ target: '#nope', title: 'Missing' }]);
    await element.start();
    expect($('.spotlight').hidden).toBe(true);
    expect($('.root').classList.contains('no-target')).toBe(true);
  });

  it('skips steps with missing targets when missingTarget is "skip"', async () => {
    const { element } = setup([
      { title: 'A' },
      { target: '#nope', title: 'B' },
      { title: 'C' },
    ]);
    element.options = { missingTarget: 'skip' };
    await element.start();
    await element.next();
    await flush();
    expect(element.currentStep?.title).toBe('C');
  });

  it('supports keyboard: Escape closes, arrows navigate', async () => {
    const { element } = setup();
    await element.start();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    await flush();
    expect(element.currentIndex).toBe(1);
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
    );
    await flush();
    expect(element.currentIndex).toBe(0);
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(element.status).toBe('closed');
  });

  it('respects closeOnEsc=false via attribute', async () => {
    const { element } = setup();
    element.setAttribute('close-on-esc', 'false');
    await element.start();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(element.isActive).toBe(true);
  });

  it('applies labels from attributes and options (options win)', async () => {
    const { element, $ } = setup();
    element.setAttribute('label-next', 'Weiter');
    element.setAttribute('label-skip', 'Überspringen');
    await element.start();
    expect($('.primary').textContent).toBe('Weiter');
    element.options = { labels: { skip: 'Saltar', progress: (c, t) => `${c}/${t}` } };
    expect($('.skip').textContent).toBe('Saltar');
    expect($('.progress').textContent).toBe('1/3');
  });

  it('hides buttons per options and per step', async () => {
    const { element, $ } = setup([{ title: 'A', showClose: false }, { title: 'B' }]);
    element.options = { showSkip: false, showProgress: false };
    await element.start();
    expect($('.close').hidden).toBe(true);
    expect($('.skip').hidden).toBe(true);
    expect($('.progress').hidden).toBe(true);
  });

  it('cancels navigation when tour-before-change is prevented', async () => {
    const { element } = setup();
    element.addEventListener('tour-before-change', (e) => {
      e.preventDefault();
    });
    await element.start();
    expect(element.currentIndex).toBe(-1);
    expect(element.isActive).toBe(false);
  });

  it('starts via the open attribute and closes when it is removed', async () => {
    const { element } = setup();
    element.setAttribute('open', '');
    await flush();
    expect(element.isActive).toBe(true);
    element.removeAttribute('open');
    expect(element.status).toBe('closed');
  });

  it('reads declarative <tour-step> children', async () => {
    document.body.innerHTML = `
      <button id="a">A</button>
      <tour-guide>
        <tour-step step-id="first" target="#a" title="First" placement="bottom"><p>Para <em>one</em></p></tour-step>
        <tour-step title="Second">Two</tour-step>
      </tour-guide>`;
    const element = document.querySelector('tour-guide')!;
    await element.start();
    const shadow = element.shadowRoot!;
    expect(element.total).toBe(2);
    expect(shadow.querySelector('.title')?.textContent).toBe('First');
    expect(shadow.querySelector('slot em')?.textContent).toBe('one');
    expect(shadow.querySelector('slot')?.getAttribute('name')).toBe('step-first');
  });

  it('calls beforeShow / afterShow hooks with context', async () => {
    const beforeShow = vi.fn();
    const afterShow = vi.fn();
    const { element } = setup([{ title: 'A', beforeShow, afterShow }]);
    await element.start();
    expect(beforeShow).toHaveBeenCalledWith(
      expect.objectContaining({ index: 0, total: 1, direction: 1 }),
    );
    expect(afterShow).toHaveBeenCalledOnce();
  });

  it('renders content functions and custom icons/styles', async () => {
    const { element, $, shadow } = setup([
      { title: 'A', content: ({ index, total }) => `step ${index + 1}/${total}` },
    ]);
    element.options = {
      icons: { close: '<svg data-custom="x"></svg>' },
      styles: '.popover{color:red}',
    };
    await element.start();
    expect($('slot').textContent).toBe('step 1/1');
    expect($('.close svg').getAttribute('data-custom')).toBe('x');
    expect(shadow.querySelector('style[data-tg-custom]')?.textContent).toContain(
      'color:red',
    );
  });

  it('uses aria-label when the step has no title', async () => {
    const { element, $ } = setup([{ content: 'No title' }]);
    await element.start();
    expect($('.popover').getAttribute('aria-label')).toBe('Guided tour');
    expect($('.title').hidden).toBe(true);
  });

  it('closes on backdrop click only when enabled', async () => {
    const { element, $ } = setup();
    await element.start();
    $('.backdrop').click();
    expect(element.isActive).toBe(true);
    element.options = { closeOnBackdropClick: true };
    $('.backdrop').click();
    expect(element.status).toBe('closed');
  });

  it('restores focus to the previously focused element', async () => {
    const { element } = setup();
    const outside = document.getElementById('outside')!;
    outside.focus();
    await element.start();
    element.close();
    expect(document.activeElement).toBe(outside);
  });

  it('switches to bottom sheet below the mobile breakpoint', async () => {
    const { element, $ } = setup();
    element.options = { mobileBreakpoint: 100_000, mobilePlacement: 'auto' };
    await element.start(1);
    expect($('.popover').classList.contains('is-mobile')).toBe(true);
  });

  it('silently resets when removed from the DOM', async () => {
    const { element } = setup();
    const onEnd = vi.fn();
    element.on('tour-end', onEnd);
    await element.start();
    element.remove();
    expect(element.status).toBe('idle');
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('ends the tour when steps are cleared while active', async () => {
    const { element } = setup();
    await element.start();
    element.steps = [];
    expect(element.status).toBe('closed');
  });

  describe('error handling and diagnostics', () => {
    const boom = () => {
      throw new Error('boom');
    };

    it('fires tour-error and logs when a hook throws, keeping the tour usable', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { element, $ } = setup([
        { title: 'A' },
        { id: 'b', title: 'B', beforeShow: boom },
      ]);
      const onError = vi.fn();
      element.on('tour-error', (event) => {
        onError(event.detail.error.code, event.detail.error.phase, event.detail.index);
      });
      await element.start();
      expect(await element.next()).toBe(false);
      expect(onError).toHaveBeenCalledWith('HOOK_FAILED', 'beforeShow', 1);
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('[tour-guide]'),
        expect.stringContaining('beforeShow() of step 1 ("b") threw: boom'),
        expect.any(Error),
      );
      expect($('.title').textContent).toBe('A');
      expect(element.isActive).toBe(true);
    });

    it('preventDefault() on tour-error silences the console', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { element } = setup([{ title: 'A', afterShow: boom }]);
      element.on('tour-error', (event) => {
        event.preventDefault();
      });
      expect(await element.start()).toBe(true);
      expect(consoleError).not.toHaveBeenCalled();
    });

    it('reports rejected async afterShow hooks', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { element } = setup([
        { title: 'A', afterShow: () => Promise.reject(new Error('late')) as never },
      ]);
      const phases: (string | undefined)[] = [];
      element.on('tour-error', (event) => phases.push(event.detail.error.phase));
      await element.start();
      await flush();
      expect(phases).toEqual(['afterShow']);
    });

    it('does not leave an empty overlay when the first step fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { element, shadow } = setup([{ title: 'A', beforeShow: boom }]);
      const onStart = vi.fn();
      element.on('tour-start', onStart);
      expect(await element.start()).toBe(false);
      expect(element.status).toBe('idle');
      expect(element.hasAttribute('open')).toBe(false);
      expect(onStart).not.toHaveBeenCalled();
      expect(shadow.querySelector<HTMLElement>('.root')?.hidden ?? true).toBe(true);
    });

    it('does not show anything when the first tour-before-change is cancelled', async () => {
      const { element, shadow } = setup();
      element.on('tour-before-change', (event) => {
        event.preventDefault();
      });
      expect(await element.start()).toBe(false);
      expect(element.status).toBe('idle');
      expect(shadow.querySelector<HTMLElement>('.root')?.hidden ?? true).toBe(true);
    });

    it('renders an empty body when content() throws', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { element, $ } = setup([{ title: 'A', content: boom }]);
      const phases: (string | undefined)[] = [];
      element.on('tour-error', (event) => phases.push(event.detail.error.phase));
      expect(await element.start()).toBe(true);
      expect(phases).toEqual(['content']);
      expect($('slot').childNodes).toHaveLength(0);
    });

    it('centres the step when a target() function throws', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { element, $ } = setup([{ title: 'A', target: boom }]);
      const phases: (string | undefined)[] = [];
      element.on('tour-error', (event) => phases.push(event.detail.error.phase));
      await element.start();
      expect(phases).toEqual(['target']);
      expect($('.popover').dataset.placement).toBe('center');
    });

    it('warns once about invalid options, steps and indexes', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const { element } = setup();
      element.options = { clsoeOnEsc: false } as never;
      element.options = { clsoeOnEsc: false } as never;
      element.steps = [{ title: 'A' }, { titel: 'B' } as never];
      await element.start();
      expect(await element.goTo(9)).toBe(false);
      const messages = warn.mock.calls.map((call) => String(call[1]));
      expect(messages).toEqual([
        'Unknown option "clsoeOnEsc". Did you mean "closeOnEsc"?',
        'step 1: unknown field "titel". Did you mean "title"?',
        'goTo(9) is out of range. Use an integer from 0 to 1.',
      ]);
    });

    it('warns when start() is called without steps', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const { element } = setup([]);
      expect(await element.start()).toBe(false);
      expect(String(warn.mock.calls[0]?.[1])).toContain('has no steps');
    });

    it('warns when a target selector matches nothing', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const { element } = setup([{ id: 'x', target: '#missing', title: 'A' }]);
      await element.start();
      expect(String(warn.mock.calls[0]?.[1])).toContain(
        'step 0 ("x"): target "#missing" was not found',
      );
    });
  });

  describe('responsive sheet', () => {
    function stubTarget(top: number) {
      const target = document.getElementById('target')!;
      vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
        top,
        left: 10,
        width: 100,
        height: 20,
        right: 110,
        bottom: top + 20,
        x: 10,
        y: top,
      } as DOMRect);
    }

    it('docks to the top when the target is in the lower half', async () => {
      stubTarget(window.innerHeight - 40);
      const { element, $ } = setup();
      element.options = { mobileBreakpoint: 100_000, mobilePlacement: 'auto' };
      await element.start(1);
      expect($('.popover').dataset.placement).toBe('top-sheet');
    });

    it('docks to the bottom when the target is in the upper half', async () => {
      stubTarget(10);
      const { element, $ } = setup();
      element.options = { mobileBreakpoint: 100_000, mobilePlacement: 'auto' };
      await element.start(1);
      expect($('.popover').dataset.placement).toBe('bottom-sheet');
    });

    /** The popover is created on start, so stub every <div>'s measurement. */
    function stubPopover(height: number) {
      vi.spyOn(HTMLDivElement.prototype, 'getBoundingClientRect').mockReturnValue(
        DOMRect.fromRect({ width: 300, height }),
      );
    }

    it('follows the target as a screen-wide card by default', async () => {
      stubTarget(window.innerHeight - 60);
      const { element, $ } = setup();
      element.options = { mobileBreakpoint: 100_000 };
      stubPopover(120);
      await element.start(1);
      const popover = $('.popover');
      expect(popover.classList.contains('is-mobile')).toBe(false);
      expect(popover.classList.contains('is-compact')).toBe(true);
      expect(popover.dataset.placement).toBe('top');
      expect(popover.style.width).toBe(`${window.innerWidth - 24}px`);
      expect(popover.style.left).toBe('12px');
    });

    it('centres steps without a target as a screen-wide card', async () => {
      const { element, $ } = setup();
      element.options = { mobileBreakpoint: 100_000 };
      await element.start(0);
      expect($('.popover').dataset.placement).toBe('center');
      expect($('.popover').classList.contains('is-compact')).toBe(true);
    });

    it('falls back to a sheet when the card fits neither above nor below', async () => {
      stubTarget(window.innerHeight / 2);
      const { element, $ } = setup();
      element.options = { mobileBreakpoint: 100_000 };
      stubPopover(window.innerHeight);
      await element.start(1);
      expect($('.popover').classList.contains('is-mobile')).toBe(true);
      expect($('.popover').classList.contains('is-compact')).toBe(false);
      expect($('.popover').style.width).toBe('');
    });

    it('honours a fixed mobile-placement attribute', async () => {
      stubTarget(10);
      const { element, $ } = setup();
      element.setAttribute('mobile-breakpoint', '100000');
      element.setAttribute('mobile-placement', 'top');
      await element.start(1);
      expect($('.popover').dataset.placement).toBe('top-sheet');
    });
  });
});
