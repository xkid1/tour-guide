/**
 * Opt-in "resume where you left off" (`@xkid1/tour-guide/resume`).
 *
 * Remembers the step a user skipped or closed the tour on, in `localStorage`, so the tour can
 * pick up there on their next visit. Completing the tour forgets it. It lives in its own entry
 * so apps that don't need persistence don't ship it.
 *
 *   import { enableResume } from '@xkid1/tour-guide/resume';
 *   const resume = enableResume(tour, { key: 'onboarding', autoStart: true });
 *   resume.savedIndex;   // step to resume at, or null
 *   resume.start();      // resumes (or starts from the beginning)
 *   resume.clear();      // forget the saved step
 */
import type { TourGuideElement } from '@libs';
import type { TourEndReason, TourEventMap } from '@types';
import { clearProgress, readProgress, resolveProgressIndex, writeProgress } from '@utils';

export interface ResumeOptions {
  /** Storage key; saved as `tour-guide:<key>` in `localStorage`. */
  key: string;
  /** Which endings save the position. Default `['skip', 'close']`. */
  on?: readonly Exclude<TourEndReason, 'complete'>[];
  /** Start right away when there is a saved position (e.g. on page load). Default `false`. */
  autoStart?: boolean;
}

export interface ResumeController {
  /** Step index the tour would resume at, or `null` when there is nothing to resume. */
  readonly savedIndex: number | null;
  /** Starts at the saved step, or from the beginning when nothing is saved. */
  start: () => Promise<boolean>;
  /** Forgets the saved step. */
  clear: () => void;
  /** Stops tracking the tour (the saved step is kept). */
  destroy: () => void;
}

/** Step ids of the tour: from `steps`, or from declarative `<tour-step step-id>` children. */
function stepIds(element: TourGuideElement): { id?: string }[] {
  const steps = (element as Partial<TourGuideElement>).steps ?? [];
  if (steps.length > 0) return steps;
  return Array.from(element.children)
    .filter((child) => child.localName === 'tour-step')
    .map((child) => {
      const id = child.getAttribute('step-id');
      return id ? { id } : {};
    });
}

export function enableResume(
  element: TourGuideElement,
  { key, on = ['skip', 'close'], autoStart = false }: ResumeOptions,
): ResumeController {
  const onEnd = (event: Event) => {
    const { reason, index, step } = (event as CustomEvent<TourEventMap['tour-end']>)
      .detail;
    if (reason === 'complete') clearProgress(key);
    else if ((on as readonly string[]).includes(reason)) {
      writeProgress(key, step?.id ? { index, stepId: step.id } : { index });
    }
  };
  element.addEventListener('tour-end', onEnd);

  const controller: ResumeController = {
    get savedIndex() {
      return resolveProgressIndex(readProgress(key), stepIds(element));
    },
    start: () => element.start(controller.savedIndex ?? undefined),
    clear: () => {
      clearProgress(key);
    },
    destroy: () => {
      element.removeEventListener('tour-end', onEnd);
    },
  };

  if (autoStart && typeof customElements !== 'undefined') {
    // The element may not be upgraded yet (script before the definition): wait for it.
    void customElements.whenDefined(element.localName).then(() => {
      if (controller.savedIndex !== null && !element.isActive) void controller.start();
    });
  }
  return controller;
}
