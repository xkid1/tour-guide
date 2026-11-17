/**
 * Vue 3 adapter. Vue is injected so the package stays zero-dependency.
 *
 *   import * as Vue from 'vue';
 *   import { createVueTourGuide } from '@xkid1/tour-guide/vue';
 *   export const TourGuide = createVueTourGuide(Vue);
 *
 *   <TourGuide v-model:open="open" :steps="steps" @complete="done" />
 *
 * Using the raw `<tour-guide>` tag in templates instead? Add
 * `compilerOptions.isCustomElement: (tag) => tag === 'tour-guide'` to your Vue/Vite config.
 */
import { DEFAULT_TAG_NAME, defineTourGuide } from '@libs';
import type { TourGuideElement } from '@libs';
import type { TourEventName, TourOptions, TourStep } from '@types';

/* eslint-disable @typescript-eslint/no-explicit-any -- structural stand-in for the injected Vue module */
export interface VueLike {
  defineComponent: (...args: any[]) => any;
  h: (...args: any[]) => any;
  ref: (...args: any[]) => any;
  watch: (...args: any[]) => any;
  onMounted: (...args: any[]) => any;
  onBeforeUnmount: (...args: any[]) => any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface TourGuideVueProps {
  steps: TourStep[];
  options?: TourOptions;
  open?: boolean;
  startAt?: number;
  theme?: 'light' | 'dark' | 'auto';
}

/** DOM event → Vue emit name. */
const EVENTS = {
  'tour-start': 'start',
  'tour-before-change': 'before-change',
  'tour-step-change': 'step-change',
  'tour-complete': 'complete',
  'tour-skip': 'skip',
  'tour-close': 'close',
  'tour-end': 'end',
  'tour-error': 'error',
} as const satisfies Record<TourEventName, string>;

interface SetupContext {
  emit: (event: string, ...args: unknown[]) => void;
  slots: Record<string, (() => unknown) | undefined>;
  expose: (exposed: Record<string, unknown>) => void;
}

export function createVueTourGuide(
  vue: VueLike,
  tagName: string = DEFAULT_TAG_NAME,
): unknown {
  defineTourGuide(tagName);

  return vue.defineComponent({
    name: 'TourGuide',
    props: {
      steps: { type: Array, required: true },
      options: { type: Object, default: undefined },
      open: { type: Boolean, default: undefined },
      startAt: { type: Number, default: undefined },
      theme: { type: String, default: undefined },
    },
    emits: [...Object.values(EVENTS), 'update:open'],
    setup(props: TourGuideVueProps, { emit, slots, expose }: SetupContext) {
      const elementRef = vue.ref(null) as { value: TourGuideElement | null };
      const offs: (() => void)[] = [];

      const syncOpen = () => {
        const element = elementRef.value;
        if (!element || props.open === undefined) return;
        if (props.open && !element.isActive) void element.start(props.startAt);
        else if (!props.open && element.isActive) element.close();
      };

      vue.onMounted(() => {
        const element = elementRef.value;
        if (!element) return;
        element.options = props.options ?? {};
        element.steps = props.steps;
        for (const [type, name] of Object.entries(EVENTS) as [TourEventName, string][]) {
          offs.push(
            element.on(type, (event) => {
              emit(name, event);
            }),
          );
        }
        offs.push(
          element.on('tour-start', () => {
            emit('update:open', true);
          }),
        );
        offs.push(
          element.on('tour-end', () => {
            emit('update:open', false);
          }),
        );
        syncOpen();
      });

      vue.onBeforeUnmount(() => {
        offs.splice(0).forEach((off) => {
          off();
        });
      });

      vue.watch(
        () => props.steps,
        (steps: TourStep[]) => {
          if (elementRef.value) elementRef.value.steps = steps;
        },
        { deep: true },
      );
      vue.watch(
        () => props.options,
        (options: TourOptions | undefined) => {
          if (elementRef.value) elementRef.value.options = options ?? {};
        },
        { deep: true },
      );
      vue.watch(() => props.open, syncOpen);

      expose({
        start: (index?: number) => elementRef.value?.start(index),
        next: () => elementRef.value?.next(),
        back: () => elementRef.value?.back(),
        goTo: (index: number) => elementRef.value?.goTo(index),
        skip: () => elementRef.value?.skip(),
        complete: () => elementRef.value?.complete(),
        close: () => elementRef.value?.close(),
        element: () => elementRef.value,
      });

      return () =>
        vue.h(
          tagName,
          { ref: elementRef, theme: props.theme },
          slots.default?.(),
        ) as unknown;
    },
  });
}

export type { TourGuideElement };
