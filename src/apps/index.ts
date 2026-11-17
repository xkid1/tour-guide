/**
 * `@apps` barrel: the framework adapters, without side effects.
 * The self-registering browser entry (./browser/index.ts) is deliberately not re-exported here;
 * it is a separate package entry point (`@xkid1/tour-guide/browser`).
 */
export {
  connectNativeBridge,
  detectNativeChannel,
  parseCommand,
  runCommand,
  serializeEvent,
} from './android';
export { registerTourGuide, TourGuideController } from './angular';
export { createTour } from './browser/create-tour';
export type { CreateTourOptions, TourHandle } from './browser/create-tour';
export { createReactTourGuide } from './react';
export type {
  ReactLike,
  TourGuideComponent,
  TourGuideControls,
  TourGuideReactProps,
  TourGuideRef,
} from './react';
export { createVueTourGuide } from './vue';
export type { TourGuideVueProps, VueLike } from './vue';
export { createSvelteTourGuide, tourGuide } from './svelte';
export type {
  SvelteTourGuideControls,
  TourGuideAction,
  TourGuideActionParams,
  TourGuideActionReturn,
} from './svelte';
export { enableResume } from './resume';
export type { ResumeController, ResumeOptions } from './resume';
