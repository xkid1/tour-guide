/** Handle returned by `rafThrottle()`. */
export interface Scheduler {
  schedule(): void;
  cancel(): void;
}
