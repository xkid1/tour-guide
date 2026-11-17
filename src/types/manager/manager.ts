import type { TourErrorDetails } from '../errors/errors';

export type TourStatus = 'idle' | 'active' | 'completed' | 'skipped' | 'closed';
export type TourEndReason = 'complete' | 'skip' | 'close';

/** Callbacks the DOM-free `TourManager` uses to notify its host. */
export interface TourManagerCallbacks {
  /** The first step passed its hooks and is about to render. */
  onStart?: (index: number) => void;
  /** Return `false` to cancel the transition. */
  onBeforeChange?: (from: number, to: number) => boolean | Promise<boolean>;
  onChange?: (index: number, previousIndex: number, direction: 1 | -1) => void;
  onEnd?: (reason: TourEndReason, index: number) => void;
  /** A hook threw or rejected. The transition is cancelled and the tour stays usable. */
  onError?: (error: TourErrorDetails) => void;
}
