import type { Scheduler, Size, TargetResolver } from '@types';

/** True when running in a DOM environment (not SSR / Node). */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

type Attributes = Record<string, string | boolean | undefined>;

/** Tiny element factory: `h('button', { class: 'btn', type: 'button' }, ['Next'])`. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === false) continue;
    element.setAttribute(name, value === true ? '' : value);
  }
  element.append(...children);
  return element;
}

/** Resolves a step target to an element, or `null` when not found. Never throws; errors go to `onError`. */
export function resolveTarget(
  target: TargetResolver | undefined,
  root: ParentNode = document,
  onError?: (error: unknown) => void,
): Element | null {
  if (!target) return null;
  try {
    if (typeof target === 'string') return root.querySelector(target);
    if (typeof target === 'function') return target() ?? null;
    return target;
  } catch (error) {
    // Invalid selectors are reported by validation; this mainly catches throwing resolvers.
    onError?.(error);
    return null;
  }
}

/** Parses trusted HTML into a fragment without executing scripts. */
export function htmlToFragment(html: string): DocumentFragment {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
}

/** Converts step content into a Node. Strings are text unless `allowHtml` is set. */
export function toNode(
  content: string | Node | null | undefined,
  allowHtml: boolean,
): Node | null {
  if (content === null || content === undefined || content === '') return null;
  if (typeof content !== 'string') return content;
  return allowHtml ? htmlToFragment(content) : document.createTextNode(content);
}

/** Replaces the inner SVG/markup of an element with trusted markup. */
export function setTrustedMarkup(element: Element, markup: string): void {
  element.replaceChildren(htmlToFragment(markup));
}

export function setHidden(element: HTMLElement, hidden: boolean): void {
  element.toggleAttribute('hidden', hidden);
}

/**
 * Size of the layout viewport that `position: fixed` uses, excluding classic scrollbars so the
 * popover is never clamped underneath one. Falls back to `innerWidth/innerHeight`.
 */
export function getViewportSize(): Size {
  const root = document.documentElement;
  return {
    width: root.clientWidth || window.innerWidth,
    height: root.clientHeight || window.innerHeight,
  };
}

/**
 * Scrolls the element into view only when it is (partly) outside the viewport, keeping `margin`
 * px clear of the edges. Targets taller than the viewport are aligned to the top instead of
 * centred so their start stays visible. Returns `true` when a scroll was started.
 */
export function scrollIntoViewIfNeeded(
  element: Element,
  behavior: ScrollBehavior,
  margin = 0,
): boolean {
  if (typeof element.scrollIntoView !== 'function') return false;
  const rect = element.getBoundingClientRect();
  const viewport = getViewportSize();
  const fullyVisible =
    rect.top >= margin &&
    rect.left >= margin &&
    rect.bottom <= viewport.height - margin &&
    rect.right <= viewport.width - margin;
  if (fullyVisible) return false;
  const tooTall = rect.height > viewport.height - margin * 2;
  element.scrollIntoView({
    behavior,
    block: tooTall ? 'start' : 'center',
    inline: 'nearest',
  });
  return true;
}

/** Coalesces many calls into one per animation frame. */
export function rafThrottle(callback: () => void): Scheduler {
  let frame: number | null = null;
  const raf =
    typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (fn: FrameRequestCallback) =>
          setTimeout(() => {
            fn(Date.now());
          }, 16) as unknown as number;
  const caf =
    typeof cancelAnimationFrame === 'function'
      ? cancelAnimationFrame
      : (id: number) => {
          clearTimeout(id);
        };
  return {
    schedule() {
      if (frame !== null) return;
      frame = raf(() => {
        frame = null;
        callback();
      });
    },
    cancel() {
      if (frame !== null) caf(frame);
      frame = null;
    },
  };
}

/** True for inputs, textareas, selects and contenteditable elements. */
export function isEditable(element: Element | null): boolean {
  if (!element) return false;
  if (element instanceof HTMLElement && element.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName);
}

/** Adds a listener and returns a function that removes it. */
export function listen<K extends keyof WindowEventMap>(
  target: Window,
  type: K,
  handler: (event: WindowEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void;
export function listen<K extends keyof DocumentEventMap>(
  target: Document,
  type: K,
  handler: (event: DocumentEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void;
export function listen(
  target: EventTarget,
  type: string,
  handler: (event: Event) => void,
  options?: AddEventListenerOptions,
): () => void;
export function listen(
  target: EventTarget,
  type: string,
  handler: (event: Event) => void,
  options?: AddEventListenerOptions,
): () => void {
  target.addEventListener(type, handler, options);
  return () => {
    target.removeEventListener(type, handler, options);
  };
}
