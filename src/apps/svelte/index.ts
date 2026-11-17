/**
 * Svelte adapter (Svelte 3, 4 and 5, SvelteKit). Built on a Svelte **action**, which is a plain
 * function, so Svelte is neither imported nor injected and the package stays zero-dependency.
 * Actions run only in the browser, so this is SSR-safe in SvelteKit.
 *
 *   <script>
 *     import { tourGuide } from '@xkid1/tour-guide/svelte';
 *     let open = $state(true); // Svelte 4: `let open = true;`
 *   </script>
 *
 *   <tour-guide use:tourGuide={{ steps, open, onEnd: () => (open = false) }}>
 *     <div slot="step-welcome">Custom <b>Svelte</b> markup</div>
 *   </tour-guide>
 *
 * Need imperative controls without `bind:this`? Use `createSvelteTourGuide()`.
 */
import { DEFAULT_TAG_NAME, defineTourGuide } from '@libs';
import type { TourGuideElement } from '@libs';
import type { TourEvent, TourEventName, TourOptions, TourStep } from '@types';

export interface TourGuideActionParams {
  steps?: TourStep[];
  options?: TourOptions;
  /** Controlled open state. Sync it back with `onEnd`. */
  open?: boolean;
  startAt?: number;
  theme?: 'light' | 'dark' | 'auto';
  onStart?: (event: TourEvent<'tour-start'>) => void;
  onBeforeChange?: (event: TourEvent<'tour-before-change'>) => void;
  onStepChange?: (event: TourEvent<'tour-step-change'>) => void;
  onComplete?: (event: TourEvent<'tour-complete'>) => void;
  onSkip?: (event: TourEvent<'tour-skip'>) => void;
  onClose?: (event: TourEvent<'tour-close'>) => void;
  onEnd?: (event: TourEvent<'tour-end'>) => void;
  /** A hook, `content()` or `target()` threw. `preventDefault()` silences the console log. */
  onError?: (event: TourEvent<'tour-error'>) => void;
}

/** Return type of the action, as Svelte expects it (`ActionReturn` without importing Svelte). */
export interface TourGuideActionReturn {
  update: (params?: TourGuideActionParams) => void;
  destroy: () => void;
}

export type TourGuideAction = (
  node: HTMLElement,
  params?: TourGuideActionParams,
) => TourGuideActionReturn;

export interface SvelteTourGuideControls {
  /** Use as `use:tourGuide={…}` on one `<tour-guide>` element. */
  tourGuide: TourGuideAction;
  /** The element the action is attached to, or `null` before mount / after destroy. */
  element: () => TourGuideElement | null;
  start: (index?: number) => Promise<boolean>;
  next: () => Promise<boolean>;
  back: () => Promise<boolean>;
  goTo: (index: number) => Promise<boolean>;
  skip: () => boolean;
  complete: () => boolean;
  close: () => boolean;
}

const EVENT_PARAMS = {
  onStart: 'tour-start',
  onBeforeChange: 'tour-before-change',
  onStepChange: 'tour-step-change',
  onComplete: 'tour-complete',
  onSkip: 'tour-skip',
  onClose: 'tour-close',
  onEnd: 'tour-end',
  onError: 'tour-error',
} as const satisfies Record<string, TourEventName>;

type EventParam = keyof typeof EVENT_PARAMS;

/** Makes sure `node` is a registered, upgraded `<tour-guide>` (it may predate the definition). */
function upgrade(node: HTMLElement): TourGuideElement {
  if (!node.localName.includes('-')) {
    throw new TypeError(
      `use:tourGuide must be placed on a <${DEFAULT_TAG_NAME}> element (or a custom tag name), not <${node.localName}>.`,
    );
  }
  defineTourGuide(node.localName);
  if (typeof customElements !== 'undefined') customElements.upgrade(node);
  return node as TourGuideElement;
}

function attach(
  node: HTMLElement,
  initial: TourGuideActionParams,
  onMount: (element: TourGuideElement | null) => void,
): TourGuideActionReturn {
  const element = upgrade(node);
  let params: TourGuideActionParams = {};

  // Subscribe once; always call the latest handler.
  const offs = (Object.keys(EVENT_PARAMS) as EventParam[]).map((param) =>
    element.on(EVENT_PARAMS[param], (event) => {
      const handler = params[param] as ((event: CustomEvent) => void) | undefined;
      handler?.(event);
    }),
  );

  const apply = (next: TourGuideActionParams) => {
    const previous = params;
    params = next;
    // Only reassign on identity change: setting `steps`/`options` re-renders an active tour.
    if (next.theme !== previous.theme) {
      if (next.theme) element.setAttribute('theme', next.theme);
      else element.removeAttribute('theme');
    }
    if (next.options !== previous.options) element.options = next.options ?? {};
    if (next.steps !== previous.steps && next.steps !== undefined)
      element.steps = next.steps;
    if (next.open === undefined || next.open === previous.open) return;
    if (next.open && !element.isActive) void element.start(next.startAt);
    else if (!next.open && element.isActive) element.close();
  };

  apply(initial);
  onMount(element);

  return {
    update: (next = {}) => {
      apply(next);
    },
    destroy: () => {
      offs.splice(0).forEach((off) => {
        off();
      });
      if (element.isActive) element.close();
      onMount(null);
    },
  };
}

/**
 * Svelte action for `<tour-guide>`. Syncs `steps`, `options`, `theme` and `open`, and forwards
 * every tour event to the matching `on*` callback.
 */
export const tourGuide: TourGuideAction = (node, params = {}) =>
  attach(node, params, () => undefined);

/**
 * Creates an action plus imperative controls bound to the element it is attached to.
 * Use one instance per tour.
 *
 *   const tour = createSvelteTourGuide();
 *   <tour-guide use:tour.tourGuide={{ steps }} />
 *   <button onclick={() => tour.start()}>Take the tour</button>
 */
export function createSvelteTourGuide(
  tagName: string = DEFAULT_TAG_NAME,
): SvelteTourGuideControls {
  defineTourGuide(tagName);
  let current: TourGuideElement | null = null;
  const setCurrent = (element: TourGuideElement | null) => {
    current = element;
  };

  return {
    tourGuide: (node, params = {}) => attach(node, params, setCurrent),
    element: () => current,
    start: (index) => current?.start(index) ?? Promise.resolve(false),
    next: () => current?.next() ?? Promise.resolve(false),
    back: () => current?.back() ?? Promise.resolve(false),
    goTo: (index) => current?.goTo(index) ?? Promise.resolve(false),
    skip: () => current?.skip() ?? false,
    complete: () => current?.complete() ?? false,
    close: () => current?.close() ?? false,
  };
}

export type { TourGuideElement };
