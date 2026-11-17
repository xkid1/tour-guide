import type { Placement } from '../placement/placement';

/**
 * How a step finds its highlighted element:
 * - CSS selector string (resolved with `document.querySelector`)
 * - an Element reference
 * - a function returning an Element (resolved lazily, every time the step is shown)
 */
export type TargetResolver = string | Element | (() => Element | null | undefined);

/** Context passed to step hooks and content functions. */
export interface StepContext {
  step: TourStep;
  index: number;
  total: number;
  /** 1 when moving forward, -1 when moving back. */
  direction: 1 | -1;
}

/** Content rendered in the popover body. */
export type StepContent = string | Node | ((context: StepContext) => string | Node);

export interface TourStep {
  /** Stable id. Also used for the slot name `step-<id>` so frameworks can project content. */
  id?: string;
  /** Element to highlight. When omitted (or not found) the popover is centred on screen. */
  target?: TargetResolver;
  /** Header title. */
  title?: string;
  /** Body content. Strings are rendered as text unless `allowHtml` is true. */
  content?: StepContent;
  /** Treat string content as HTML. Only enable for trusted / sanitized content. */
  allowHtml?: boolean;
  placement?: Placement;
  showBack?: boolean;
  showSkip?: boolean;
  showClose?: boolean;
  spotlightPadding?: number;
  scrollIntoView?: boolean;
  /** Per-step override of the `allowTargetInteraction` option. */
  allowTargetInteraction?: boolean;
  /** Runs before the step is shown. Awaited, so you can open menus, fetch data, route, etc. */
  beforeShow?: (context: StepContext) => void | Promise<void>;
  /** Runs right after the step has been rendered and positioned. */
  afterShow?: (context: StepContext) => void;
  /** Runs before leaving the step. Return `false` to cancel navigation. */
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- allow hooks that return nothing
  beforeLeave?: (context: StepContext) => boolean | void | Promise<boolean | void>;
  /** Free-form data for your own use. */
  data?: Record<string, unknown>;
}
