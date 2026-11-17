import type {
  PositionResult,
  Rect,
  RendererHandlers,
  RenderState,
  ResolvedTourOptions,
  Size,
} from '@types';
import { afterAnimations, h, setHidden, setTrustedMarkup, toNode, uid } from '@utils';

import { applyStyles } from '../styles/styles';

/**
 * Owns the shadow DOM: builds the structure once and updates it per step.
 * Holds no tour state of its own.
 *
 * Structure (every node has a `part` for `::part()` styling):
 *   root > backdrop, spotlight, popover[role=dialog]
 *   popover > arrow, header(title, close-button), body(slot), footer(progress, back-button, skip-button, primary-button)
 */
export class TourRenderer {
  readonly root: HTMLDivElement;
  readonly backdrop: HTMLDivElement;
  readonly spotlight: HTMLDivElement;
  readonly popover: HTMLDivElement;
  readonly arrow: HTMLDivElement;
  readonly title: HTMLHeadingElement;
  readonly headerSpacer: HTMLSpanElement;
  readonly closeButton: HTMLButtonElement;
  readonly body: HTMLDivElement;
  readonly slot: HTMLSlotElement;
  readonly progress: HTMLSpanElement;
  readonly backButton: HTMLButtonElement;
  readonly skipButton: HTMLButtonElement;
  readonly primaryButton: HTMLButtonElement;

  readonly #customStyle: HTMLStyleElement;
  readonly #handlers: RendererHandlers;
  readonly #ids = { title: uid('tg-title'), body: uid('tg-body') };
  #icons = { close: '', back: '' };
  /** Cancels the pending end of the exit animation (when the tour is reopened meanwhile). */
  #cancelHide: (() => void) | null = null;
  #cancelSettle: (() => void) | null = null;
  /** Whether the current step lets clicks through the spotlight to its target. */
  #targetInteraction = true;

  constructor(
    shadow: ShadowRoot,
    handlers: RendererHandlers,
    options: ResolvedTourOptions,
  ) {
    this.#handlers = handlers;
    this.#customStyle = applyStyles(shadow, options.styles);

    this.backdrop = h('div', { class: 'backdrop', part: 'backdrop' });
    this.spotlight = h('div', { class: 'spotlight', part: 'spotlight', hidden: true });
    this.arrow = h('div', { class: 'arrow', part: 'arrow' });

    this.title = h('h2', { class: 'title', part: 'title', id: this.#ids.title });
    this.headerSpacer = h('span', { class: 'header-spacer', hidden: true });
    this.closeButton = h('button', {
      type: 'button',
      class: 'icon-button close',
      part: 'close-button',
    });
    const header = h('header', { class: 'header', part: 'header' }, [
      this.title,
      this.headerSpacer,
      this.closeButton,
    ]);

    this.slot = h('slot');
    this.body = h('div', { class: 'body', part: 'body', id: this.#ids.body }, [
      this.slot,
    ]);

    this.progress = h('span', {
      'class': 'progress',
      'part': 'progress',
      'aria-live': 'polite',
    });
    this.backButton = h('button', {
      type: 'button',
      class: 'icon-button back',
      part: 'back-button',
    });
    this.skipButton = h('button', {
      type: 'button',
      class: 'button button-secondary skip',
      part: 'skip-button',
    });
    this.primaryButton = h('button', {
      type: 'button',
      class: 'button button-primary primary',
      part: 'primary-button next-button',
    });
    const actions = h('div', { class: 'actions', part: 'actions' }, [
      this.backButton,
      this.skipButton,
      this.primaryButton,
    ]);
    const footer = h('footer', { class: 'footer', part: 'footer' }, [
      this.progress,
      actions,
    ]);

    this.popover = h(
      'div',
      {
        'class': 'popover',
        'part': 'popover',
        'role': 'dialog',
        'aria-modal': 'true',
        'tabindex': '-1',
        'aria-describedby': this.#ids.body,
      },
      [this.arrow, header, this.body, footer],
    );
    this.root = h('div', { class: 'root', part: 'root', hidden: true }, [
      this.backdrop,
      this.spotlight,
      this.popover,
    ]);
    shadow.append(this.root);

    this.closeButton.addEventListener('click', handlers.onClose);
    this.backButton.addEventListener('click', handlers.onBack);
    this.skipButton.addEventListener('click', handlers.onSkip);
    this.primaryButton.addEventListener('click', handlers.onPrimary);
    this.backdrop.addEventListener('click', handlers.onBackdropClick);
  }

  /** `true` while the tour is shown, including during the exit animation. */
  get isVisible(): boolean {
    return !this.root.hidden;
  }

  /** `true` while the exit animation runs. */
  get isClosing(): boolean {
    return this.root.classList.contains('is-closing');
  }

  /** Shows the overlay. Unhiding restarts the CSS enter animations. */
  show(): void {
    this.#cancelHide?.();
    this.#cancelHide = null;
    this.root.classList.remove('is-closing');
    this.root.hidden = false;
  }

  /**
   * Plays the exit animation, then hides the overlay. Without running animations (reduced
   * motion, no Web Animations support, detached element) it hides synchronously.
   */
  hide(): void {
    if (this.root.hidden || this.isClosing) return;
    this.#cancelSettle?.();
    this.root.classList.remove('is-moving', 'is-scrolling');
    this.popover.classList.remove('is-stepping');
    this.root.classList.add('is-closing');
    this.#cancelHide = afterAnimations(this.root, () => {
      this.#cancelHide = null;
      this.root.classList.remove('is-closing');
      this.root.hidden = true;
      this.spotlight.hidden = true;
    });
  }

  /**
   * Starts a step transition: the content slides in from the travel `direction`, and with
   * `glide` the popover and spotlight move smoothly to the new target. Call `settle()` once the
   * new position is applied.
   */
  animateStep(direction: 1 | -1, glide: boolean): void {
    this.#cancelSettle?.();
    this.popover.dataset.direction = direction === 1 ? 'next' : 'back';
    this.popover.classList.remove('is-stepping');
    // Force a style flush so re-adding the class restarts the animation.
    void this.popover.getBoundingClientRect();
    this.popover.classList.add('is-stepping');
    this.root.classList.toggle('is-moving', glide);
  }

  /** Ends the glide started by `animateStep()` once its transitions have finished. */
  settle(): void {
    this.#cancelSettle?.();
    this.#cancelSettle = afterAnimations(this.root, () => {
      this.#cancelSettle = null;
      this.root.classList.remove('is-moving');
    });
  }

  /** Hides the popover while the page scrolls to the target; it animates back in afterwards. */
  setScrolling(scrolling: boolean): void {
    this.root.classList.toggle('is-scrolling', scrolling);
  }

  setCustomStyles(css: string): void {
    if (this.#customStyle.textContent !== css) this.#customStyle.textContent = css;
  }

  update(state: RenderState): void {
    const { context, options } = state;
    const { step, index } = context;

    this.setCustomStyles(options.styles);
    this.root.classList.toggle('no-backdrop', !options.backdrop);
    this.root.classList.toggle('allow-interaction', options.allowInteraction);
    this.#targetInteraction =
      step.allowTargetInteraction ?? options.allowTargetInteraction;
    this.popover.dataset.stepIndex = String(index);
    if (step.id) this.popover.dataset.stepId = step.id;
    else delete this.popover.dataset.stepId;

    this.#renderHeader(state);
    this.#renderBody(state);
    this.#renderFooter(state);
  }

  /** Title (or `aria-label` fallback) and the close icon button. */
  #renderHeader({ context: { step }, options }: RenderState): void {
    const hasTitle = Boolean(step.title);
    this.title.textContent = step.title ?? '';
    setHidden(this.title, !hasTitle);
    setHidden(this.headerSpacer, hasTitle);
    if (hasTitle) {
      this.popover.setAttribute('aria-labelledby', this.#ids.title);
      this.popover.removeAttribute('aria-label');
    } else {
      this.popover.removeAttribute('aria-labelledby');
      this.popover.setAttribute('aria-label', options.ariaLabel);
    }
    this.#setIcon(this.closeButton, 'close', options.icons.close);
    this.#setLabel(this.closeButton, options.labels.close);
    setHidden(this.closeButton, !(step.showClose ?? options.showClose));
  }

  /** Slot `step-<id>` (or `step-<index>`), with the step's `content` as fallback. */
  #renderBody({ context, options }: RenderState): void {
    const { step, index } = context;
    this.slot.name = `step-${step.id ?? index}`;
    let raw: string | Node | undefined;
    try {
      raw = typeof step.content === 'function' ? step.content(context) : step.content;
    } catch (error) {
      this.#handlers.onContentError?.(error);
      raw = undefined;
    }
    const node = toNode(raw, step.allowHtml ?? options.allowHtml);
    this.slot.replaceChildren(...(node ? [node] : []));
  }

  /** Progress text, back / skip buttons and the next-or-complete primary button. */
  #renderFooter({ context, isFirst, isLast, options }: RenderState): void {
    const { step, index, total } = context;
    const { labels } = options;

    this.progress.textContent = labels.progress(index + 1, total);
    setHidden(this.progress, !options.showProgress);

    this.#setIcon(this.backButton, 'back', options.icons.back);
    this.#setLabel(this.backButton, labels.back);
    setHidden(this.backButton, isFirst || !(step.showBack ?? options.showBack));

    this.skipButton.textContent = labels.skip;
    setHidden(this.skipButton, isLast || !(step.showSkip ?? options.showSkip));

    const action = isLast ? 'complete' : 'next';
    this.primaryButton.textContent = isLast ? labels.complete : labels.next;
    this.primaryButton.setAttribute('part', `primary-button ${action}-button`);
    this.primaryButton.dataset.action = action;
  }

  setSpotlight(rect: Rect | null): void {
    this.root.classList.toggle('no-target', rect === null);
    this.#setBackdropHole(rect && this.#targetInteraction ? rect : null);
    if (!rect) {
      this.spotlight.hidden = true;
      return;
    }
    this.spotlight.hidden = false;
    Object.assign(this.spotlight.style, {
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  }

  /**
   * Cuts a hole the size of the spotlight out of the backdrop's hit area, so clicks there reach
   * the target while the rest of the page stays blocked.
   */
  #setBackdropHole(rect: Rect | null): void {
    if (!rect) {
      this.backdrop.style.removeProperty('clip-path');
      return;
    }
    const x1 = `${rect.left}px`;
    const y1 = `${rect.top}px`;
    const x2 = `${rect.left + rect.width}px`;
    const y2 = `${rect.top + rect.height}px`;
    this.backdrop.style.clipPath =
      `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ` +
      `${x1} ${y1}, ${x2} ${y1}, ${x2} ${y2}, ${x1} ${y2}, ${x1} ${y1})`;
  }

  /** Layout size of the popover. `offset*` first: they ignore the enter animation's scale. */
  measurePopover(): Size {
    this.popover.classList.remove('is-mobile');
    if (this.popover.offsetWidth > 0) {
      return { width: this.popover.offsetWidth, height: this.popover.offsetHeight };
    }
    const rect = this.popover.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }

  /**
   * Mobile `follow` layout: a card `width` px wide (the screen minus margins), positioned with
   * `setPosition()`. `null` restores the regular width.
   */
  setCompact(width: number | null): void {
    this.popover.classList.toggle('is-compact', width !== null);
    if (width === null) this.popover.style.removeProperty('width');
    else this.popover.style.width = `${Math.max(0, Math.round(width))}px`;
  }

  /** Docks the popover as a full-width sheet to the `top` or `bottom` screen edge. */
  setMobile(edge: 'top' | 'bottom' = 'bottom'): void {
    this.popover.classList.add('is-mobile');
    this.popover.dataset.placement = `${edge}-sheet`;
    this.popover.style.removeProperty('top');
    this.popover.style.removeProperty('left');
  }

  setPosition(result: PositionResult): void {
    this.popover.classList.remove('is-mobile');
    this.popover.dataset.placement = result.placement;
    this.popover.style.top = `${Math.round(result.top)}px`;
    this.popover.style.left = `${Math.round(result.left)}px`;
    this.arrow.style.removeProperty('top');
    this.arrow.style.removeProperty('left');
    if (result.arrow && 'left' in result.arrow)
      this.arrow.style.left = `${result.arrow.left}px`;
    if (result.arrow && 'top' in result.arrow)
      this.arrow.style.top = `${result.arrow.top}px`;
  }

  focus(): void {
    this.popover.focus({ preventScroll: true });
  }

  /** Icon buttons have no text, so the label goes to `aria-label` and the tooltip. */
  #setLabel(button: HTMLButtonElement, label: string): void {
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
  }

  #setIcon(button: HTMLButtonElement, key: 'close' | 'back', markup: string): void {
    if (this.#icons[key] === markup && button.firstChild) return;
    this.#icons[key] = markup;
    setTrustedMarkup(button, markup);
  }
}
