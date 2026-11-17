/**
 * Consumer code type-checked against the published .d.ts files (never run).
 * Every subpath, the main types and each adapter's typed surface.
 */
import {
  DEFAULT_TAG_NAME,
  TourGuideElement,
  TourManager,
  computePosition,
  defineTourGuide,
  isTourGuideError,
  setLogLevel,
  validateSteps,
} from '@xkid1/tour-guide';
import type {
  BridgeEventMessage,
  TourEventMap,
  TourOptions,
  TourProgress,
  TourStep,
  StepContext,
  PositionResult,
} from '@xkid1/tour-guide';
import { registerTourGuide, TourGuideController } from '@xkid1/tour-guide/angular';
import {
  connectNativeBridge,
  parseCommand,
  serializeEvent,
} from '@xkid1/tour-guide/android';
import { createTour } from '@xkid1/tour-guide/browser';
import type { CreateTourOptions, TourHandle } from '@xkid1/tour-guide/browser';
import * as electron from '@xkid1/tour-guide/electron';
import { createReactTourGuide } from '@xkid1/tour-guide/react';
import { enableResume } from '@xkid1/tour-guide/resume';
import type { ResumeController } from '@xkid1/tour-guide/resume';
import type { TourGuideReactProps } from '@xkid1/tour-guide/react';
import { createSvelteTourGuide, tourGuide } from '@xkid1/tour-guide/svelte';
import type { TourGuideActionParams } from '@xkid1/tour-guide/svelte';
import { createVueTourGuide } from '@xkid1/tour-guide/vue';
import * as React from 'react';
import * as Vue from 'vue';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const expectType = <T extends true>(_value?: T): void => undefined;

// ------------------------------------------------------------------ core
const steps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    content: (context: StepContext) => `Step ${context.index + 1} of ${context.total}`,
    target: () => document.querySelector('#anchor'),
    placement: 'bottom',
    beforeShow: async () => undefined,
    beforeLeave: () => false,
    allowTargetInteraction: true,
  },
];
const options: TourOptions = {
  closeOnEsc: true,
  keyboardNavigation: true,
  allowTargetInteraction: false,
};

const element: TourGuideElement = document.createElement('tour-guide');
element.steps = steps;
element.options = options;
const started: Promise<boolean> = element.start(0);
const progress: TourProgress = { index: 1, stepId: 'welcome' };
void progress;
const resume: ResumeController = enableResume(element, {
  key: 'onboarding',
  on: ['skip'],
});
const saved: number | null = resume.savedIndex;
void saved;
void started;
element.on('tour-end', (event) => {
  expectType<Equal<typeof event.detail, TourEventMap['tour-end']>>(true);
  const reason: 'complete' | 'skip' | 'close' = event.detail.reason;
  void reason;
});
element.on('tour-step-change', (event) => {
  const index: number = event.detail.index;
  void index;
});
const tag: string = DEFAULT_TAG_NAME;
const Ctor: typeof TourGuideElement | undefined = defineTourGuide('my-tour');
void tag;
void Ctor;

const position: PositionResult = computePosition({
  target: { top: 0, left: 0, width: 10, height: 10 },
  popover: { width: 100, height: 50 },
  viewport: { width: 800, height: 600 },
  placement: 'auto',
  offset: 8,
  margin: 8,
});
void position;
const errors = validateSteps(steps);
if (errors[0] && isTourGuideError(errors[0])) void errors[0].code;
new TourManager().setSteps(steps);
setLogLevel('warn');

// @ts-expect-error placement is a closed union
const bad: TourStep = { placement: 'middle' };
void bad;

// --------------------------------------------------------------- browser
const config: CreateTourOptions = {
  steps,
  theme: 'dark',
  on: { 'tour-complete': (event) => void event.detail.index },
};
const handle: TourHandle = createTour(config);
handle.destroy();
expectType<Equal<typeof electron.createTour, typeof createTour>>(true);

// ----------------------------------------------------------------- react
const { TourGuide, useTourGuide } = createReactTourGuide(React);
const props: TourGuideReactProps = {
  steps,
  open: true,
  onEnd: (e) => void e.detail.reason,
};
const node: React.ReactElement = React.createElement(TourGuide, props);
void node;
void useTourGuide;

// ------------------------------------------------------------------- vue
const VueTour = createVueTourGuide(Vue);
void Vue.h(VueTour as Vue.Component, { steps });

// ---------------------------------------------------------------- svelte
const params: TourGuideActionParams = {
  steps,
  open: true,
  onStepChange: (e) => void e.detail,
};
const action = tourGuide(document.createElement('tour-guide'), params);
action.update({ open: false });
action.destroy();
const controls = createSvelteTourGuide();
const maybe: TourGuideElement | null = controls.element();
void maybe;

// --------------------------------------------------------------- angular
registerTourGuide();
const controller = new TourGuideController(element)
  .setSteps(steps)
  .on('tour-start', (detail) => void detail.total);
controller.destroy();

// --------------------------------------------------------------- android
const disconnect: () => void = connectNativeBridge(element, {
  androidInterface: 'AndroidTour',
});
disconnect();
const message: BridgeEventMessage = serializeEvent('tour-start', { index: 0, total: 1 });
void message;
void parseCommand('{"command":"next"}');
