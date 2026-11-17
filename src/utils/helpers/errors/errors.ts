import type { TourErrorCode, TourErrorDetails, TourErrorPhase } from '@types';

export interface TourGuideErrorInit {
  phase?: TourErrorPhase;
  stepIndex?: number;
  stepId?: string;
  option?: string;
  cause?: unknown;
}

/**
 * The error type used for everything `<tour-guide>` reports: hook failures, validation
 * warnings and bad API calls. `code` is stable and safe to branch on; `message` explains what
 * went wrong and how to fix it.
 *
 * ```ts
 * tour.on('tour-error', ({ detail }) => {
 *   if (detail.error.code === 'HOOK_FAILED') report(detail.error.cause);
 * });
 * ```
 */
export class TourGuideError extends Error implements TourErrorDetails {
  readonly code: TourErrorCode;
  // `declare` keeps absent fields absent (no own `undefined` properties in logs).
  declare readonly phase?: TourErrorPhase;
  declare readonly stepIndex?: number;
  declare readonly stepId?: string;
  declare readonly option?: string;
  declare readonly cause?: unknown;

  constructor(code: TourErrorCode, message: string, init: TourGuideErrorInit = {}) {
    super(message);
    this.name = 'TourGuideError';
    this.code = code;
    // Assign only what was given, so logged objects stay small.
    if (init.phase !== undefined) this.phase = init.phase;
    if (init.stepIndex !== undefined) this.stepIndex = init.stepIndex;
    if (init.stepId !== undefined) this.stepId = init.stepId;
    if (init.option !== undefined) this.option = init.option;
    if (init.cause !== undefined) this.cause = init.cause;
  }
}

/** Type guard that also works across realms (iframes, duplicated bundles). */
export function isTourGuideError(value: unknown): value is TourGuideError {
  return (
    value instanceof TourGuideError ||
    (value instanceof Error && value.name === 'TourGuideError' && 'code' in value)
  );
}

/** Human-readable label for a step: `step 2 ("welcome")` or `step 2`. Indexes are 0-based. */
export function describeStep(index: number, id?: string): string {
  return id ? `step ${index} ("${id}")` : `step ${index}`;
}

function describeThrown(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    // JSON.stringify returns undefined for undefined, functions and symbols.
    const json = JSON.stringify(error) as string | undefined;
    return json ?? String(error);
  } catch {
    return String(error);
  }
}

const PHASE_HINT: Record<TourErrorPhase, string> = {
  beforeLeave: 'Navigation was cancelled; the current step stays visible.',
  beforeShow: 'Navigation was cancelled; the previous step stays visible.',
  beforeChange: 'Navigation was cancelled; the previous step stays visible.',
  afterShow: 'The step is visible, but your afterShow() did not finish.',
  content: 'The step is shown without body content.',
  target: 'The step is shown centred, as if it had no target.',
};

/** Wraps anything thrown by user code in a `HOOK_FAILED` error that says where it happened. */
export function hookError(
  error: unknown,
  phase: TourErrorPhase,
  stepIndex: number,
  stepId?: string,
): TourGuideError {
  const where = stepIndex >= 0 ? ` of ${describeStep(stepIndex, stepId)}` : '';
  return new TourGuideError(
    'HOOK_FAILED',
    `${phase}()${where} threw: ${describeThrown(error)}. ${PHASE_HINT[phase]}`,
    { phase, stepIndex, ...(stepId ? { stepId } : {}), cause: error },
  );
}

/** Levenshtein distance, capped for short identifiers (used for "did you mean" hints). */
export function editDistance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0] ?? 0;
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j] ?? 0;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      previous[j] = Math.min(above + 1, (previous[j - 1] ?? 0) + 1, diagonal + cost);
      diagonal = above;
    }
  }
  return previous[b.length] ?? 0;
}

/** Closest candidate to `input`, or `undefined` when nothing is reasonably close. */
export function suggest(
  input: string,
  candidates: readonly string[],
): string | undefined {
  const lower = input.toLowerCase();
  let best: string | undefined;
  let bestScore = Math.max(2, Math.floor(input.length / 3)) + 1;
  for (const candidate of candidates) {
    const score = editDistance(lower, candidate.toLowerCase());
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

/** ` Did you mean "x"?` or an empty string. */
export function didYouMean(input: string, candidates: readonly string[]): string {
  const match = suggest(input, candidates);
  return match ? ` Did you mean "${match}"?` : '';
}
