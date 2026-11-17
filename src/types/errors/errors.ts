/**
 * Where an error thrown by user code was caught:
 * - `beforeLeave` / `beforeShow` / `afterShow`: a step hook
 * - `beforeChange`: the manager's `onBeforeChange` callback
 * - `content`: a step `content()` function
 * - `target`: a step `target()` resolver function
 */
export type TourErrorPhase =
  'beforeLeave' | 'beforeShow' | 'afterShow' | 'beforeChange' | 'content' | 'target';

/**
 * Stable, machine-readable error codes. Safe to `switch` on; messages may change.
 * - `HOOK_FAILED`: user code (hook, content, target function) threw or rejected
 * - `INVALID_STEPS`: `steps` is not an array, or a step is not an object
 * - `INVALID_STEP`: a step field has the wrong type or value
 * - `DUPLICATE_STEP_ID`: two steps share an `id` (slot names would collide)
 * - `INVALID_OPTION`: an option has the wrong type or value
 * - `UNKNOWN_OPTION`: an option key is not recognised (often a typo)
 * - `INVALID_SELECTOR`: a string `target` is not a valid CSS selector
 * - `TARGET_NOT_FOUND`: a step `target` matched nothing
 * - `INVALID_INDEX`: `start()` / `goTo()` received an out-of-range or non-integer index
 * - `NO_STEPS`: `start()` was called without any steps
 */
export type TourErrorCode =
  | 'HOOK_FAILED'
  | 'INVALID_STEPS'
  | 'INVALID_STEP'
  | 'DUPLICATE_STEP_ID'
  | 'INVALID_OPTION'
  | 'UNKNOWN_OPTION'
  | 'INVALID_SELECTOR'
  | 'TARGET_NOT_FOUND'
  | 'INVALID_INDEX'
  | 'NO_STEPS';

/** Shape of `TourGuideError` (declared here so types stay free of runtime classes). */
export interface TourErrorDetails extends Error {
  readonly code: TourErrorCode;
  /** Set for `HOOK_FAILED`. */
  readonly phase?: TourErrorPhase;
  /** Index of the step involved, when there is one. */
  readonly stepIndex?: number;
  /** `id` of the step involved, when it has one. */
  readonly stepId?: string;
  /** Option key involved, for option errors. */
  readonly option?: string;
  /** The original thrown value, for `HOOK_FAILED`. */
  readonly cause?: unknown;
}
