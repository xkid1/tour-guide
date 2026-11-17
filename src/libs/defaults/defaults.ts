import type { ResolvedTourOptions, TourIcons, TourLabels, TourOptions } from '@types';

export const DEFAULT_TAG_NAME = 'tour-guide';

export const DEFAULT_LABELS: TourLabels = {
  back: 'Back',
  next: 'Next',
  skip: 'Skip',
  complete: 'Complete',
  close: 'Close tour',
  progress: (current, total) => `${current} of ${total}`,
};

const SVG_ATTRS =
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';

export const DEFAULT_ICONS: TourIcons = {
  close: `<svg ${SVG_ATTRS}><path d="M18 6 6 18M6 6l12 12"/></svg>`,
  back: `<svg ${SVG_ATTRS}><path d="m15 18-6-6 6-6"/></svg>`,
};

export const DEFAULT_OPTIONS: ResolvedTourOptions = {
  labels: DEFAULT_LABELS,
  icons: DEFAULT_ICONS,
  backdrop: true,
  allowInteraction: false,
  allowTargetInteraction: true,
  closeOnEsc: true,
  closeOnBackdropClick: false,
  keyboardNavigation: true,
  showProgress: true,
  showBack: true,
  showSkip: true,
  showClose: true,
  allowHtml: false,
  placement: 'auto',
  offset: 12,
  viewportMargin: 12,
  spotlightPadding: 6,
  scrollIntoView: true,
  scrollBehavior: 'smooth',
  mobileBreakpoint: 640,
  mobilePlacement: 'follow',
  trapFocus: true,
  restoreFocus: true,
  ariaLabel: 'Guided tour',
  styles: '',
  missingTarget: 'center',
};

function definedOnly<T extends object>(value: T | undefined): Partial<T> {
  if (!value) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

/** Merges option layers left-to-right on top of the defaults. `undefined` never overrides. */
export function resolveOptions(
  ...layers: (TourOptions | undefined)[]
): ResolvedTourOptions {
  let result: ResolvedTourOptions = { ...DEFAULT_OPTIONS };
  for (const layer of layers) {
    const { labels, icons, ...rest } = definedOnly(layer);
    result = {
      ...result,
      ...rest,
      labels: { ...result.labels, ...definedOnly(labels) },
      icons: { ...result.icons, ...definedOnly(icons) },
    };
  }
  return result;
}
