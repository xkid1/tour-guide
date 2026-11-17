import type {
  StepContext,
  TourEndReason,
  TourErrorPhase,
  TourManagerCallbacks,
  TourStatus,
  TourStep,
} from '@types';
import { hookError } from '@utils';

const END_STATUS: Record<TourEndReason, TourStatus> = {
  complete: 'completed',
  skip: 'skipped',
  close: 'closed',
};

type Direction = 1 | -1;
type MaybePromise<T> = T | PromiseLike<T>;

function isPromiseLike<T>(value: MaybePromise<T>): value is PromiseLike<T> {
  return typeof (value as PromiseLike<T> | null)?.then === 'function';
}

/**
 * Framework- and DOM-agnostic tour state machine.
 * Handles step order, async hooks and race conditions; rendering lives elsewhere.
 *
 * Every transition gets a token. When a newer transition (or an end/reset) starts while an
 * async hook is pending, the older one is dropped once its hook settles.
 *
 * Errors thrown by hooks never escape: they are reported through `onError` and cancel the
 * transition, so the tour stays on the step it was showing.
 */
export class TourManager {
  #steps: TourStep[] = [];
  #index = -1;
  #status: TourStatus = 'idle';
  #transition = 0;
  readonly #callbacks: TourManagerCallbacks;

  constructor(callbacks: TourManagerCallbacks = {}) {
    this.#callbacks = callbacks;
  }

  // ------------------------------------------------------------------------ state

  get steps(): readonly TourStep[] {
    return this.#steps;
  }
  get index(): number {
    return this.#index;
  }
  get status(): TourStatus {
    return this.#status;
  }
  get total(): number {
    return this.#steps.length;
  }
  get current(): TourStep | null {
    return this.#steps[this.#index] ?? null;
  }
  get isActive(): boolean {
    return this.#status === 'active';
  }
  get isFirst(): boolean {
    return this.#index <= 0;
  }
  get isLast(): boolean {
    return this.#index === this.#steps.length - 1;
  }

  setSteps(steps: readonly TourStep[]): void {
    this.#steps = [...steps];
    if (this.isActive && this.#index >= this.#steps.length) {
      this.#index = this.#steps.length - 1;
    }
  }

  context(index = this.#index, direction: Direction = 1): StepContext | null {
    const step = this.#steps[index];
    return step ? { step, index, total: this.total, direction } : null;
  }

  // ------------------------------------------------------------------- navigation

  /** Starts at `index` (clamped into range). `onStart` fires once the first step is accepted. */
  async start(index = 0): Promise<boolean> {
    if (this.#steps.length === 0) return false;
    const target = Math.min(Math.max(Math.trunc(index) || 0, 0), this.#steps.length - 1);
    this.#transition++;
    this.#status = 'active';
    this.#index = -1;
    const ok = await this.goTo(target);
    // The first step was rejected (hook, listener or newer call): nothing is shown, go idle.
    if (!ok && this.#index === -1 && this.isActive) this.reset();
    return ok;
  }

  async goTo(index: number): Promise<boolean> {
    if (!this.isActive || !this.#inRange(index)) return false;
    if (index === this.#index) return true;

    const token = ++this.#transition;
    const from = this.#index;
    const direction: Direction = index > from ? 1 : -1;
    const stillValid = () => token === this.#transition && this.isActive;

    const checks = [
      () => this.#canLeave(from, direction),
      () => this.#canChange(from, index),
      () => this.#prepare(index, direction),
    ];
    for (const check of checks) {
      // Only await real promises so hook-free steps switch synchronously.
      const result = check();
      const ok = isPromiseLike(result) ? await result : result;
      if (!ok || !stillValid()) return false;
    }

    this.#index = index;
    if (from === -1) this.#callbacks.onStart?.(index);
    this.#callbacks.onChange?.(index, from, direction);
    return true;
  }

  /** Next step, or completes the tour when on the last step. */
  async next(): Promise<boolean> {
    if (!this.isActive) return false;
    if (this.isLast) return this.complete();
    return this.goTo(this.#index + 1);
  }

  async back(): Promise<boolean> {
    if (!this.isActive || this.isFirst) return false;
    return this.goTo(this.#index - 1);
  }

  complete(): boolean {
    return this.#end('complete');
  }
  skip(): boolean {
    return this.#end('skip');
  }
  close(): boolean {
    return this.#end('close');
  }

  /** Silently returns to idle without firing callbacks (used on unmount). */
  reset(): void {
    this.#transition++;
    this.#status = 'idle';
    this.#index = -1;
  }

  // -------------------------------------------------------------------- internals

  #inRange(index: number): boolean {
    return Number.isInteger(index) && index >= 0 && index < this.#steps.length;
  }

  /** Runs the leaving step's `beforeLeave`. `false` (or a throw) cancels. */
  #canLeave(from: number, direction: Direction): MaybePromise<boolean> {
    const leaving = this.context(from, direction);
    const hook = leaving?.step.beforeLeave;
    if (!leaving || !hook) return true;
    return this.#guard(
      'beforeLeave',
      from,
      () => hook(leaving),
      (r) => r !== false,
    );
  }

  #canChange(from: number, to: number): MaybePromise<boolean> {
    const callback = this.#callbacks.onBeforeChange;
    if (!callback) return true;
    return this.#guard('beforeChange', to, () => callback(from, to), Boolean);
  }

  /** Runs the entering step's `beforeShow`. Only a throw cancels. */
  #prepare(index: number, direction: Direction): MaybePromise<boolean> {
    const entering = this.context(index, direction);
    const hook = entering?.step.beforeShow;
    if (!entering || !hook) return true;
    return this.#guard(
      'beforeShow',
      index,
      () => hook(entering),
      () => true,
    );
  }

  /**
   * Runs user code and maps its result to "continue?". A throw or rejection is reported
   * through `onError` and treated as "cancel". Synchronous hooks stay synchronous.
   */
  #guard<T>(
    phase: TourErrorPhase,
    index: number,
    run: () => MaybePromise<T>,
    toBoolean: (result: T) => boolean,
  ): MaybePromise<boolean> {
    const fail = (error: unknown) => {
      this.#callbacks.onError?.(hookError(error, phase, index, this.#steps[index]?.id));
      return false;
    };
    try {
      const result = run();
      return isPromiseLike(result)
        ? Promise.resolve(result).then(toBoolean, fail)
        : toBoolean(result);
    } catch (error) {
      return fail(error);
    }
  }

  #end(reason: TourEndReason): boolean {
    if (!this.isActive) return false;
    this.#transition++;
    this.#status = END_STATUS[reason];
    this.#callbacks.onEnd?.(reason, this.#index);
    return true;
  }
}
