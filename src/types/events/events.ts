import type { TourErrorDetails } from '../errors/errors';
import type { TourEndReason } from '../manager/manager';
import type { TourStep } from '../step/step';

/** Detail payload of every `tour-*` CustomEvent dispatched by `<tour-guide>`. */
export interface TourEventMap {
  'tour-start': { index: number; total: number };
  'tour-before-change': { from: number; to: number; step: TourStep };
  'tour-step-change': {
    index: number;
    previousIndex: number;
    step: TourStep;
    total: number;
  };
  'tour-complete': { index: number; step: TourStep | null };
  'tour-skip': { index: number; step: TourStep | null };
  'tour-close': { index: number; step: TourStep | null };
  'tour-end': { reason: TourEndReason; index: number; step: TourStep | null };
  /**
   * User code (a hook, `content()` or `target()`) threw. The tour stays usable.
   * Cancelable: call `preventDefault()` to stop the built-in console error.
   */
  'tour-error': { error: TourErrorDetails; index: number; step: TourStep | null };
}

export type TourEventName = keyof TourEventMap;
export type TourEvent<K extends TourEventName> = CustomEvent<TourEventMap[K]>;
