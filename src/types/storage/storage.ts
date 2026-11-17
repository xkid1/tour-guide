/** Saved position of a tour that was skipped or closed (see the `resumeKey` option). */
export interface TourProgress {
  /** Step index the tour was on. */
  index: number;
  /** That step's `id`, used to find it again if the steps were reordered. */
  stepId?: string;
}
