import type { TourProgress } from '@types';

const PREFIX = 'tour-guide:';

/** `localStorage`, or `null` when unavailable (SSR, privacy mode, sandboxed iframes...). */
function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Accessing localStorage throws when storage is blocked.
    return null;
  }
}

/** Reads the saved position of the tour stored under `key`. Never throws. */
export function readProgress(key: string): TourProgress | null {
  if (!key) return null;
  try {
    const raw = storage()?.getItem(PREFIX + key);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const { index, stepId } = value as Record<string, unknown>;
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) return null;
    return typeof stepId === 'string' ? { index, stepId } : { index };
  } catch {
    return null;
  }
}

/** Saves the tour position under `key`. Silently does nothing when storage is unavailable. */
export function writeProgress(key: string, progress: TourProgress): void {
  if (!key) return;
  try {
    storage()?.setItem(PREFIX + key, JSON.stringify(progress));
  } catch {
    // Quota exceeded or storage blocked: resuming is best-effort.
  }
}

export function clearProgress(key: string): void {
  if (!key) return;
  try {
    storage()?.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

/**
 * Index to resume at: the saved step's `id` wins when it still exists (steps may have been
 * reordered), otherwise the saved index if it is in range. `null` when there is nothing to resume.
 */
export function resolveProgressIndex(
  progress: TourProgress | null,
  steps: readonly { id?: string }[],
): number | null {
  if (!progress) return null;
  if (progress.stepId) {
    const byId = steps.findIndex((step) => step.id === progress.stepId);
    if (byId !== -1) return byId;
  }
  return progress.index < steps.length ? progress.index : null;
}
