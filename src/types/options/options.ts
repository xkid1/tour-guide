import type { Placement } from '../placement/placement';

export interface TourLabels {
  back: string;
  next: string;
  skip: string;
  complete: string;
  close: string;
  progress: (current: number, total: number) => string;
}

/** SVG markup used for the icon buttons. Must be trusted markup. */
export interface TourIcons {
  close: string;
  back: string;
}

export type MissingTargetBehavior = 'center' | 'skip';

/**
 * Mobile layout. `follow` (default): a screen-wide card anchored above or below the target, like
 * on desktop. `auto` / `top` / `bottom`: a sheet docked to a screen edge.
 */
export type MobilePlacement = 'follow' | 'auto' | 'top' | 'bottom';

export interface TourOptions {
  labels?: Partial<TourLabels>;
  icons?: Partial<TourIcons>;
  /** Dim the page behind the spotlight. Default `true`. */
  backdrop?: boolean;
  /** Let pointer events pass through the backdrop to the page. Default `false`. */
  allowInteraction?: boolean;
  /**
   * Let clicks reach the highlighted target through the spotlight (e.g. to open a menu or a
   * modal mid-tour). The rest of the page stays blocked. Default `true`.
   */
  allowTargetInteraction?: boolean;
  closeOnEsc?: boolean;
  closeOnBackdropClick?: boolean;
  /** ArrowLeft / ArrowRight navigation. Default `true`. */
  keyboardNavigation?: boolean;
  showProgress?: boolean;
  showBack?: boolean;
  showSkip?: boolean;
  showClose?: boolean;
  allowHtml?: boolean;
  placement?: Placement;
  /** Gap between target and popover in px. */
  offset?: number;
  /** Minimum distance between popover and viewport edge in px. */
  viewportMargin?: number;
  spotlightPadding?: number;
  scrollIntoView?: boolean;
  scrollBehavior?: ScrollBehavior;
  /** Below this viewport width (px) the popover becomes a sheet docked to a screen edge. */
  mobileBreakpoint?: number;
  /**
   * Below `mobileBreakpoint`: `follow` (default) keeps the popover next to its target as a card
   * as wide as the screen (minus `viewportMargin`), falling back to a sheet when neither above
   * nor below the target has room. `auto` docks a sheet to the top when the target sits in the
   * lower half of the screen (so the sheet never covers it), `top` / `bottom` to a fixed edge.
   */
  mobilePlacement?: MobilePlacement;
  trapFocus?: boolean;
  restoreFocus?: boolean;
  /** Accessible name for the dialog when the step has no title. */
  ariaLabel?: string;
  /** Extra CSS injected into the shadow root (after the built-in styles). */
  styles?: string;
  missingTarget?: MissingTargetBehavior;
}

export interface ResolvedTourOptions extends Required<
  Omit<TourOptions, 'labels' | 'icons'>
> {
  labels: TourLabels;
  icons: TourIcons;
}
