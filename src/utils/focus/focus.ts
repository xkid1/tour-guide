const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

function isHiddenElement(element: HTMLElement): boolean {
  return (
    Boolean(element.hidden) ||
    element.closest('[hidden]') !== null ||
    element.getAttribute('aria-hidden') === 'true'
  );
}

function collect(root: ParentNode, out: HTMLElement[]): void {
  for (const element of Array.from(
    root.querySelectorAll<HTMLElement>(`${FOCUSABLE_SELECTOR},slot`),
  )) {
    if (element instanceof HTMLSlotElement) {
      for (const assigned of element.assignedElements({ flatten: true })) {
        if (assigned instanceof HTMLElement && assigned.matches(FOCUSABLE_SELECTOR))
          out.push(assigned);
        collect(assigned, out);
      }
      continue;
    }
    if (!isHiddenElement(element)) out.push(element);
  }
}

/** Focusable elements inside `container`, including light-DOM content projected through slots. */
export function getFocusableElements(container: ParentNode): HTMLElement[] {
  const result: HTMLElement[] = [];
  collect(container, result);
  return result;
}

/** The really focused element, walking through open shadow roots. */
export function getDeepActiveElement(
  root: Document | ShadowRoot = document,
): Element | null {
  let active = root.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

/** Keeps Tab / Shift+Tab focus cycling inside `container`. Call from a keydown handler. */
export function handleFocusTrap(event: KeyboardEvent, container: HTMLElement): void {
  if (event.key !== 'Tab') return;
  const items = getFocusableElements(container);
  if (items.length === 0) {
    event.preventDefault();
    container.focus({ preventScroll: true });
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return;
  const active = getDeepActiveElement();
  const inside =
    active === container || (active instanceof HTMLElement && items.includes(active));

  if (event.shiftKey) {
    if (!inside || active === first || active === container) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    }
  } else if (!inside || active === last) {
    event.preventDefault();
    first.focus({ preventScroll: true });
  }
}

/** Focuses an element if it is still in the document. */
export function restoreFocus(element: Element | null): void {
  if (element instanceof HTMLElement && element.isConnected)
    element.focus({ preventScroll: true });
}
