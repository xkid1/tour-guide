/**
 * Browser / Electron / WebView entry.
 * Importing this module registers `<tour-guide>` (side effect) and exposes an imperative helper.
 *
 *   import { createTour } from '@xkid1/tour-guide/browser';
 *   const tour = createTour({ steps: [...] });
 *   tour.start();
 *
 * This is also the entry of the IIFE bundle (`window.TourGuide`), so the native WebView bridge
 * is exported here too.
 */
import { defineTourGuide } from '@libs';

defineTourGuide();

export { createTour } from './create-tour';
export type { CreateTourOptions, TourHandle } from './create-tour';
export { connectNativeBridge } from '../android';

// Same public surface as the package root (src/index.ts). tests/exports.test.ts keeps them in sync.
export * from '@libs';
export { TourGuideError, computePosition, isTourGuideError, setLogLevel } from '@utils';
export type * from '@types';
