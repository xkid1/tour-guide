/**
 * HTML attribute ↔ option mapping for `<tour-guide>` and declarative `<tour-step>` children.
 * Attribute names are public API: renaming one is a breaking change.
 */
import type { Placement, TourLabels, TourOptions, TourStep } from '@types';

/** Boolean attributes: `""`/`"true"` → true, `"false"` → false. */
export const BOOLEAN_ATTRIBUTES = {
  'backdrop': 'backdrop',
  'allow-interaction': 'allowInteraction',
  'allow-target-interaction': 'allowTargetInteraction',
  'allow-html': 'allowHtml',
  'close-on-esc': 'closeOnEsc',
  'close-on-backdrop-click': 'closeOnBackdropClick',
  'keyboard-navigation': 'keyboardNavigation',
  'show-progress': 'showProgress',
  'show-back': 'showBack',
  'show-skip': 'showSkip',
  'show-close': 'showClose',
  'scroll-into-view': 'scrollIntoView',
  'trap-focus': 'trapFocus',
  'restore-focus': 'restoreFocus',
} as const satisfies Record<string, keyof TourOptions>;

/** Numeric attributes (px values). Invalid numbers are ignored. */
export const NUMBER_ATTRIBUTES = {
  'mobile-breakpoint': 'mobileBreakpoint',
  'offset': 'offset',
  'viewport-margin': 'viewportMargin',
  'spotlight-padding': 'spotlightPadding',
} as const satisfies Record<string, keyof TourOptions>;

/** String/enum attributes copied as-is (validation reports bad values). */
export const STRING_ATTRIBUTES = {
  'placement': 'placement',
  'mobile-placement': 'mobilePlacement',
  'missing-target': 'missingTarget',
  'scroll-behavior': 'scrollBehavior',
  'aria-label': 'ariaLabel',
} as const satisfies Record<string, keyof TourOptions>;

export const LABEL_ATTRIBUTES = {
  'label-back': 'back',
  'label-next': 'next',
  'label-skip': 'skip',
  'label-complete': 'complete',
  'label-close': 'close',
} as const satisfies Record<string, Exclude<keyof TourLabels, 'progress'>>;

/** Attributes that are not options. */
export const CONTROL_ATTRIBUTES = ['open', 'start-at'] as const;

export const OBSERVED_ATTRIBUTES: readonly string[] = [
  ...CONTROL_ATTRIBUTES,
  ...Object.keys(BOOLEAN_ATTRIBUTES),
  ...Object.keys(NUMBER_ATTRIBUTES),
  ...Object.keys(STRING_ATTRIBUTES),
  ...Object.keys(LABEL_ATTRIBUTES),
];

/** `""`/`"true"` → true, `"false"` → false, missing → undefined (use default). */
export function parseBoolean(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  return value.trim().toLowerCase() !== 'false';
}

/** Finite number, or undefined for missing / empty / invalid values. */
export function parseNumber(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Builds the attribute options layer (defaults ← **attributes** ← `options` property). */
export function readAttributeOptions(element: Element): TourOptions {
  const options: Record<string, unknown> = {};

  for (const [attribute, key] of Object.entries(BOOLEAN_ATTRIBUTES)) {
    const value = parseBoolean(element.getAttribute(attribute));
    if (value !== undefined) options[key] = value;
  }
  for (const [attribute, key] of Object.entries(NUMBER_ATTRIBUTES)) {
    const value = parseNumber(element.getAttribute(attribute));
    if (value !== undefined) options[key] = value;
  }
  for (const [attribute, key] of Object.entries(STRING_ATTRIBUTES)) {
    const value = element.getAttribute(attribute);
    if (value) options[key] = value.trim();
  }

  const labels: Partial<TourLabels> = {};
  for (const [attribute, key] of Object.entries(LABEL_ATTRIBUTES)) {
    const value = element.getAttribute(attribute);
    if (value !== null) labels[key] = value;
  }
  if (Object.keys(labels).length > 0) options.labels = labels;

  return options;
}

/** Clones a `<tour-step>`'s children each time the step renders. */
function cloneChildren(source: Element): () => DocumentFragment {
  return () => {
    const fragment = document.createDocumentFragment();
    source.childNodes.forEach((node) => {
      fragment.append(node.cloneNode(true));
    });
    return fragment;
  };
}

/** Converts one `<tour-step>` element into a `TourStep`. */
export function readStepElement(element: Element): TourStep {
  const step: TourStep = { content: cloneChildren(element) };
  const id = element.getAttribute('step-id');
  const target = element.getAttribute('target');
  const title = element.getAttribute('title');
  const placement = element.getAttribute('placement');
  const padding = parseNumber(element.getAttribute('spotlight-padding'));
  const booleans = {
    showBack: parseBoolean(element.getAttribute('show-back')),
    showSkip: parseBoolean(element.getAttribute('show-skip')),
    showClose: parseBoolean(element.getAttribute('show-close')),
    scrollIntoView: parseBoolean(element.getAttribute('scroll-into-view')),
    allowTargetInteraction: parseBoolean(
      element.getAttribute('allow-target-interaction'),
    ),
  };

  if (id) step.id = id;
  if (target) step.target = target;
  if (title) step.title = title;
  if (placement) step.placement = placement as Placement;
  if (padding !== undefined) step.spotlightPadding = padding;
  for (const [key, value] of Object.entries(booleans)) {
    if (value !== undefined) step[key as keyof typeof booleans] = value;
  }
  return step;
}

/**
 * Reads direct `<tour-step>` children:
 * `<tour-step target="#id" title="…" placement="top">Content</tour-step>`.
 */
export function readDeclarativeSteps(host: Element): TourStep[] {
  return Array.from(host.children)
    .filter((child) => child.localName === 'tour-step')
    .map(readStepElement);
}
