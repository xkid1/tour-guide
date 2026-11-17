/** Imperative helper behind the `@xkid1/tour-guide/browser` entry. Free of side effects. */
import { DEFAULT_TAG_NAME, defineTourGuide } from '@libs';
import type { TourGuideElement } from '@libs';
import type { TourEventMap, TourEventName, TourOptions, TourStep } from '@types';

export interface CreateTourOptions extends TourOptions {
  steps: TourStep[];
  /** Where the element is appended. Default `document.body`. */
  container?: HTMLElement;
  /** `light` (default), `dark` or `auto`. */
  theme?: 'light' | 'dark' | 'auto';
  /** Tag name to use. Default `tour-guide`. */
  tagName?: string;
  on?: { [K in TourEventName]?: (event: CustomEvent<TourEventMap[K]>) => void };
}

export interface TourHandle {
  element: TourGuideElement;
  start: (index?: number) => Promise<boolean>;
  next: () => Promise<boolean>;
  back: () => Promise<boolean>;
  goTo: (index: number) => Promise<boolean>;
  skip: () => boolean;
  complete: () => boolean;
  close: () => boolean;
  /** Closes the tour, removes listeners and the element. */
  destroy: () => void;
}

export function createTour(config: CreateTourOptions): TourHandle {
  const { steps, container, theme, tagName = DEFAULT_TAG_NAME, on, ...options } = config;
  defineTourGuide(tagName);
  const element = document.createElement(tagName) as TourGuideElement;
  if (theme) element.setAttribute('theme', theme);
  element.options = options;
  element.steps = steps;

  const unsubscribers: (() => void)[] = [];
  if (on) {
    for (const [type, handler] of Object.entries(on)) {
      if (typeof handler === 'function') {
        unsubscribers.push(
          element.on(type as TourEventName, handler as (event: CustomEvent) => void),
        );
      }
    }
  }
  (container ?? document.body).append(element);

  return {
    element,
    start: (index) => element.start(index),
    next: () => element.next(),
    back: () => element.back(),
    goTo: (index) => element.goTo(index),
    skip: () => element.skip(),
    complete: () => element.complete(),
    close: () => element.close(),
    destroy: () => {
      element.close();
      unsubscribers.forEach((off) => {
        off();
      });
      element.remove();
    },
  };
}
