import type {
  Rect,
  ResolvedTourOptions,
  StepContext,
  TourEndReason,
  TourErrorDetails,
  TourEventMap,
  TourEventName,
  TourOptions,
  TourStatus,
  TourStep,
} from '@types';
import {
  TourGuideError,
  computeMobilePosition,
  computePosition,
  describeStep,
  getDeepActiveElement,
  getViewportSize,
  handleFocusTrap,
  hookError,
  isBrowser,
  isEditable,
  isMobileViewport,
  listen,
  logger,
  padRect,
  rafThrottle,
  resolveScrollBehavior,
  resolveSheetEdge,
  resolveTarget,
  restoreFocus,
  scrollIntoViewIfNeeded,
  toRect,
  waitForScrollEnd,
} from '@utils';

import {
  CONTROL_ATTRIBUTES,
  OBSERVED_ATTRIBUTES,
  parseNumber,
  readAttributeOptions,
  readDeclarativeSteps,
} from '../attributes/attributes';
import { DEFAULT_TAG_NAME, resolveOptions } from '../defaults/defaults';
import { TourManager } from '../tour-manager/tour-manager';
import { TourRenderer } from '../tour-renderer/tour-renderer';
import { validateIndex, validateOptions, validateSteps } from '../validate/validate';

/** SSR-safe base class: on the server there is no HTMLElement. */
const BaseElement: typeof HTMLElement =
  typeof HTMLElement === 'undefined'
    ? // eslint-disable-next-line @typescript-eslint/no-extraneous-class -- placeholder base for SSR
      (class {} as typeof HTMLElement)
    : HTMLElement;

/**
 * `<tour-guide>`: accessible, themable product-tour custom element.
 *
 * @fires tour-start
 * @fires tour-before-change - cancelable
 * @fires tour-step-change
 * @fires tour-complete
 * @fires tour-skip
 * @fires tour-close
 * @fires tour-end
 * @fires tour-error - cancelable; `preventDefault()` silences the console error
 *
 * @csspart root, backdrop, spotlight, popover, arrow, header, title, close-button, body,
 *   footer, progress, actions, back-button, skip-button, primary-button, next-button, complete-button
 */
export class TourGuideElement extends BaseElement {
  static get observedAttributes(): string[] {
    return [...OBSERVED_ATTRIBUTES];
  }

  readonly #manager: TourManager;
  #renderer: TourRenderer | null = null;
  #steps: TourStep[] = [];
  #stepsFromProperty = false;
  #options: TourOptions = {};
  #attributeOptions: TourOptions = {};
  #resolved: ResolvedTourOptions = resolveOptions();
  #target: Element | null = null;
  #previousFocus: Element | null = null;
  #cleanups: (() => void)[] = [];
  #resizeObserver: ResizeObserver | null = null;
  /** Cancels waiting for the smooth scroll to the current target to settle. */
  #cancelScrollWait: (() => void) | null = null;
  #reflectingOpen = false;
  #connected = false;
  /** Warning messages already logged by this instance (each is logged once). */
  readonly #warned = new Set<string>();
  readonly #scheduler = rafThrottle(() => {
    this.#updatePosition();
  });

  constructor() {
    super();
    this.#manager = new TourManager({
      onStart: (index) => {
        this.#mount(index);
      },
      onBeforeChange: (from, to) => this.#beforeChange(from, to),
      onChange: (index, previous, direction) => {
        this.#renderStep(index, previous, direction);
      },
      onEnd: (reason, index) => {
        this.#end(reason, index);
      },
      onError: (error) => {
        this.#reportError(error);
      },
    });
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
  }

  // ---------------------------------------------------------------- properties

  get steps(): TourStep[] {
    return [...this.#steps];
  }
  set steps(value: TourStep[] | null | undefined) {
    const fromProperty = value !== null && value !== undefined;
    if (fromProperty) this.#warn(validateSteps(value));
    this.#steps = Array.isArray(value) ? [...value] : [];
    this.#stepsFromProperty = fromProperty;
    this.#manager.setSteps(this.#steps);
    if (this.#manager.isActive) {
      if (this.#steps.length === 0) this.#manager.close();
      else this.refresh();
    }
  }

  get options(): TourOptions {
    return { ...this.#options };
  }
  set options(value: TourOptions | null | undefined) {
    this.#warn(validateOptions(value));
    this.#options = { ...(value ?? {}) };
    this.#recomputeOptions();
  }

  /** Effective options (defaults ← attributes ← `options` property). */
  get resolvedOptions(): ResolvedTourOptions {
    return this.#resolved;
  }
  get currentIndex(): number {
    return this.#manager.index;
  }
  get currentStep(): TourStep | null {
    return this.#manager.current;
  }
  get total(): number {
    return this.#manager.total;
  }
  get status(): TourStatus {
    return this.#manager.status;
  }
  get isActive(): boolean {
    return this.#manager.isActive;
  }

  get open(): boolean {
    return this.hasAttribute('open');
  }
  set open(value: boolean) {
    this.toggleAttribute('open', value);
  }

  // ---------------------------------------------------------------- public API

  /** Starts (or jumps within) the tour. Resolves `true` when a step is shown. */
  async start(index?: number): Promise<boolean> {
    if (!isBrowser()) return false;
    const at = index ?? parseNumber(this.getAttribute('start-at')) ?? 0;
    if (this.#manager.isActive) return this.goTo(at);
    if (!this.#stepsFromProperty) {
      this.#steps = readDeclarativeSteps(this);
      this.#warn(validateSteps(this.#steps));
    }
    this.#manager.setSteps(this.#steps);
    // start() clamps out-of-range indexes, but say so: it is usually a bug.
    const problem = validateIndex(at, this.#steps.length, 'start');
    if (problem) this.#warn([problem]);
    return this.#manager.start(at);
  }

  next(): Promise<boolean> {
    return this.#manager.next();
  }
  back(): Promise<boolean> {
    return this.#manager.back();
  }
  /** Alias of `back()`. */
  prev(): Promise<boolean> {
    return this.back();
  }
  goTo(index: number): Promise<boolean> {
    if (this.#manager.isActive) {
      const problem = validateIndex(index, this.#manager.total, 'goTo');
      if (problem) {
        this.#warn([problem]);
        return Promise.resolve(false);
      }
    }
    return this.#manager.goTo(index);
  }
  complete(): boolean {
    return this.#manager.complete();
  }
  skip(): boolean {
    return this.#manager.skip();
  }
  close(): boolean {
    return this.#manager.close();
  }

  /** Re-renders the current step (e.g. after the target moved or content changed). */
  refresh(): void {
    const index = this.#manager.index;
    if (this.#manager.isActive && index >= 0) this.#renderStep(index, index, 1, false);
  }

  /** Typed event subscription. Returns an unsubscribe function. */
  on<K extends TourEventName>(
    type: K,
    listener: (event: CustomEvent<TourEventMap[K]>) => void,
  ): () => void {
    const handler = (event: Event) => {
      listener(event as CustomEvent<TourEventMap[K]>);
    };
    this.addEventListener(type, handler);
    return () => {
      this.removeEventListener(type, handler);
    };
  }

  // ---------------------------------------------------------------- lifecycle

  connectedCallback(): void {
    this.#attributeOptions = readAttributeOptions(this);
    this.#recomputeOptions();
    this.#connected = true;
    if (this.open && !this.#manager.isActive) this.#startWhenReady();
  }

  disconnectedCallback(): void {
    this.#connected = false;
    if (this.#manager.isActive) {
      this.#manager.reset();
      this.#unmount(false);
    }
  }

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null,
  ): void {
    if (oldValue === newValue) return;
    if (name === 'open') {
      this.#syncOpenAttribute(newValue !== null);
      return;
    }
    if ((CONTROL_ATTRIBUTES as readonly string[]).includes(name)) return;
    this.#attributeOptions = readAttributeOptions(this);
    this.#recomputeOptions();
  }

  // ------------------------------------------------------------ options & state

  #syncOpenAttribute(open: boolean): void {
    if (this.#reflectingOpen || !this.#connected) return;
    if (open && !this.#manager.isActive) void this.start();
    if (!open && this.#manager.isActive) this.close();
  }

  /** Waits for the parser so declarative `<tour-step>` children exist before starting. */
  #startWhenReady(): void {
    const run = () => {
      if (this.isConnected && this.open && !this.#manager.isActive) void this.start();
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else queueMicrotask(run);
  }

  #recomputeOptions(): void {
    this.#warn(validateOptions(this.#attributeOptions));
    this.#resolved = resolveOptions(this.#attributeOptions, this.#options);
    if (this.#manager.isActive) this.refresh();
  }

  #setOpenAttribute(open: boolean): void {
    this.#reflectingOpen = true;
    this.toggleAttribute('open', open);
    this.#reflectingOpen = false;
  }

  // -------------------------------------------------------------- diagnostics

  #emit<K extends TourEventName>(
    type: K,
    detail: TourEventMap[K],
    cancelable = false,
  ): boolean {
    return this.dispatchEvent(
      new CustomEvent(type, { detail, bubbles: true, composed: true, cancelable }),
    );
  }

  /** Logs each validation problem once per element. */
  #warn(errors: readonly TourGuideError[]): void {
    for (const error of errors) {
      if (this.#warned.has(error.message)) continue;
      this.#warned.add(error.message);
      logger.warn(error.message);
    }
  }

  /** Fires `tour-error`; logs to the console unless a listener called `preventDefault()`. */
  #reportError(error: TourErrorDetails): void {
    const index = error.stepIndex ?? this.#manager.index;
    const step = this.#manager.steps[index] ?? null;
    if (this.#emit('tour-error', { error, index, step }, true)) {
      logger.error(error.message, error.cause);
    }
  }

  // ------------------------------------------------------------ mount / unmount

  #ensureRenderer(): TourRenderer {
    if (this.#renderer) return this.#renderer;
    const shadow = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
    this.#renderer = new TourRenderer(
      shadow,
      {
        onClose: () => void this.close(),
        onBack: () => void this.back(),
        onSkip: () => void this.skip(),
        onPrimary: () => void this.next(),
        onBackdropClick: () => {
          if (this.#resolved.closeOnBackdropClick) this.close();
        },
        onContentError: (error) => {
          const index = this.#manager.index;
          this.#reportError(
            hookError(error, 'content', index, this.#manager.current?.id),
          );
        },
      },
      this.#resolved,
    );
    return this.#renderer;
  }

  #mount(index: number): void {
    const renderer = this.#ensureRenderer();
    this.#previousFocus = getDeepActiveElement();
    renderer.show();
    this.#setOpenAttribute(true);

    const reposition = () => {
      this.#scheduler.schedule();
    };
    this.#cleanups.push(
      listen(window, 'resize', reposition, { passive: true }),
      listen(window, 'scroll', reposition, { passive: true, capture: true }),
      listen(document, 'keydown', (event) => {
        this.#onKeydown(event);
      }),
    );
    // Mobile: on-screen keyboards and pinch-zoom change the visual viewport only.
    if (window.visualViewport) {
      this.#cleanups.push(
        listen(window.visualViewport, 'resize', reposition, { passive: true }),
        listen(window.visualViewport, 'scroll', reposition, { passive: true }),
      );
    }
    if (typeof ResizeObserver !== 'undefined') {
      this.#resizeObserver = new ResizeObserver(reposition);
      this.#resizeObserver.observe(renderer.popover);
    }
    this.#emit('tour-start', { index, total: this.#manager.total });
  }

  #unmount(restore: boolean): void {
    this.#scheduler.cancel();
    this.#stopScrollWait();
    this.#cleanups.forEach((cleanup) => {
      cleanup();
    });
    this.#cleanups = [];
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    this.#target = null;
    this.#renderer?.hide();
    this.#setOpenAttribute(false);
    if (restore && this.#resolved.restoreFocus) restoreFocus(this.#previousFocus);
    this.#previousFocus = null;
  }

  // ------------------------------------------------------------------ rendering

  #beforeChange(from: number, to: number): boolean {
    const step = this.#manager.steps[to];
    if (!step) return false;
    return this.#emit('tour-before-change', { from, to, step }, true);
  }

  #renderStep(
    index: number,
    previousIndex: number,
    direction: 1 | -1,
    announce = true,
  ): void {
    const context = this.#manager.context(index, direction);
    if (!context) return;
    const { step } = context;

    const target = resolveTarget(step.target, document, (error) => {
      this.#reportError(hookError(error, 'target', index, step.id));
    });
    if (announce && step.target && !target && this.#skipMissingTarget(context)) return;

    const renderer = this.#ensureRenderer();
    renderer.update({
      context,
      isFirst: this.#manager.isFirst,
      isLast: this.#manager.isLast,
      options: this.#resolved,
    });
    const scrolling = this.#trackTarget(target, step);
    const stepping = announce && previousIndex >= 0 && previousIndex !== index;
    // While the page scrolls the popover is hidden and animates in afterwards, so only glide
    // to the new target when it is already on screen.
    if (stepping) renderer.animateStep(direction, !scrolling);
    this.#updatePosition();
    if (stepping) renderer.settle();

    if (announce) this.#announce(context, previousIndex);
  }

  /**
   * Handles a step whose `target` matched nothing. With `missingTarget: 'skip'` it moves on in
   * the travel direction and returns `true`; otherwise it warns and the step is centred.
   */
  #skipMissingTarget({ step, index, direction }: StepContext): boolean {
    const where = describeStep(index, step.id);
    if (this.#resolved.missingTarget !== 'skip') {
      const selector =
        typeof step.target === 'string' ? ` ${JSON.stringify(step.target)}` : '';
      this.#warn([
        new TourGuideError(
          'TARGET_NOT_FOUND',
          `${where}: target${selector} was not found, so the step is centred. Set missingTarget: "skip" to skip such steps, or render the target before the step (e.g. in beforeShow).`,
          { stepIndex: index, ...(step.id ? { stepId: step.id } : {}) },
        ),
      ]);
      return false;
    }
    logger.debug(`${where}: target not found, skipping.`);
    if (direction === -1 && !this.#manager.isFirst) void this.back();
    else void this.next();
    return true;
  }

  /**
   * Observes the new target for size changes and scrolls it into view when it is off screen.
   * Returns `true` when a scroll started: the popover then stays hidden until it settles.
   */
  #trackTarget(target: Element | null, step: TourStep): boolean {
    if (this.#target && this.#target !== target) {
      this.#resizeObserver?.unobserve(this.#target);
    }
    this.#target = target;
    this.#stopScrollWait();
    if (!target) return false;
    this.#resizeObserver?.observe(target);
    if (!(step.scrollIntoView ?? this.#resolved.scrollIntoView)) return false;
    const behavior = resolveScrollBehavior(this.#resolved.scrollBehavior);
    // Scroll when the spotlight (target + padding) would be clipped by the viewport.
    const margin = step.spotlightPadding ?? this.#resolved.spotlightPadding;
    if (!scrollIntoViewIfNeeded(target, behavior, margin)) return false;
    this.#renderer?.setScrolling(true);
    this.#cancelScrollWait = waitForScrollEnd(target, () => {
      this.#cancelScrollWait = null;
      this.#renderer?.setScrolling(false);
      this.#updatePosition();
    });
    return true;
  }

  #stopScrollWait(): void {
    this.#cancelScrollWait?.();
    this.#cancelScrollWait = null;
    this.#renderer?.setScrolling(false);
  }

  /** Focuses the dialog, fires `tour-step-change` and runs `afterShow`. */
  #announce(context: StepContext, previousIndex: number): void {
    const { step, index } = context;
    this.#renderer?.focus();
    this.#emit('tour-step-change', {
      index,
      previousIndex,
      step,
      total: this.#manager.total,
    });
    const fail = (error: unknown) => {
      this.#reportError(hookError(error, 'afterShow', index, step.id));
    };
    try {
      const result: unknown = step.afterShow?.(context);
      if (result instanceof Promise) result.catch(fail);
    } catch (error) {
      fail(error);
    }
  }

  #updatePosition(): void {
    const renderer = this.#renderer;
    const step = this.#manager.current;
    if (!renderer || !step || !this.#manager.isActive) return;

    const options = this.#resolved;
    const viewport = getViewportSize();
    const padding = step.spotlightPadding ?? options.spotlightPadding;
    const target = this.#target?.isConnected ? this.#target : null;
    const raw = target ? toRect(target.getBoundingClientRect()) : null;
    const rect = raw && (raw.width > 0 || raw.height > 0) ? padRect(raw, padding) : null;

    renderer.setSpotlight(rect);
    if (isMobileViewport(viewport.width, options.mobileBreakpoint)) {
      this.#updateMobilePosition(rect);
      return;
    }
    renderer.setCompact(null);
    renderer.setPosition(
      computePosition({
        target: rect,
        popover: renderer.measurePopover(),
        viewport,
        placement: step.placement ?? options.placement,
        offset: options.offset,
        margin: options.viewportMargin,
      }),
    );
  }

  /**
   * Small screens: with `mobilePlacement: 'follow'` the popover is a screen-wide card above or
   * below the target; when neither fits (or for a fixed edge) it docks as a sheet.
   */
  #updateMobilePosition(rect: Rect | null): void {
    const renderer = this.#renderer;
    const step = this.#manager.current;
    if (!renderer || !step) return;
    const options = this.#resolved;
    const viewport = getViewportSize();

    if (options.mobilePlacement === 'follow') {
      renderer.setCompact(viewport.width - options.viewportMargin * 2);
      const position = computeMobilePosition({
        target: rect,
        popover: renderer.measurePopover(),
        viewport,
        placement: step.placement ?? options.placement,
        offset: options.offset,
        margin: options.viewportMargin,
      });
      if (position) {
        renderer.setPosition(position);
        return;
      }
    }
    renderer.setCompact(null);
    renderer.setMobile(resolveSheetEdge(rect, viewport.height, options.mobilePlacement));
  }

  // ------------------------------------------------------------------- keyboard

  #onKeydown(event: KeyboardEvent): void {
    if (!this.#manager.isActive || !this.#renderer || event.defaultPrevented) return;
    const options = this.#resolved;

    if (event.key === 'Escape' && options.closeOnEsc) {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key === 'Tab') {
      if (options.trapFocus) handleFocusTrap(event, this.#renderer.popover);
      return;
    }
    if (!options.keyboardNavigation || isEditable(getDeepActiveElement())) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      void this.next();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      void this.back();
    }
  }

  #end(reason: TourEndReason, index: number): void {
    const step = this.#manager.steps[index] ?? null;
    this.#unmount(true);
    const detail = { index, step };
    if (reason === 'complete') this.#emit('tour-complete', detail);
    else if (reason === 'skip') this.#emit('tour-skip', detail);
    else this.#emit('tour-close', detail);
    this.#emit('tour-end', { reason, index, step });
  }
}

/**
 * Registers the custom element. Safe to call many times and on the server.
 * A custom tag name registers a subclass, so several names can coexist.
 */
export function defineTourGuide(
  tagName: string = DEFAULT_TAG_NAME,
): typeof TourGuideElement | undefined {
  if (typeof customElements === 'undefined') return undefined;
  const existing = customElements.get(tagName);
  if (existing) return existing as typeof TourGuideElement;
  const constructor =
    tagName === DEFAULT_TAG_NAME ? TourGuideElement : class extends TourGuideElement {};
  customElements.define(tagName, constructor);
  return constructor;
}

declare global {
  interface HTMLElementTagNameMap {
    'tour-guide': TourGuideElement;
  }
}
