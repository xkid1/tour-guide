/**
 * React adapter (React 18 / 19, Next.js, React Native Web, Electron).
 *
 * Zero-dependency: React is injected instead of imported, so this package never
 * pulls in or duplicates React.
 *
 *   import * as React from 'react';
 *   import { createReactTourGuide } from '@xkid1/tour-guide/react';
 *   export const { TourGuide, useTourGuide } = createReactTourGuide(React);
 */
import { DEFAULT_TAG_NAME, defineTourGuide } from '@libs';
import type { TourGuideElement } from '@libs';
import type { TourEvent, TourEventName, TourOptions, TourStep } from '@types';

/* eslint-disable @typescript-eslint/no-explicit-any -- structural stand-in for the injected React module */
export interface ReactLike {
  createElement: (...args: any[]) => any;
  forwardRef: (...args: any[]) => any;
  useRef: (...args: any[]) => any;
  useEffect: (...args: any[]) => any;
  useImperativeHandle: (...args: any[]) => any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export type TourGuideRef =
  { current: TourGuideElement | null } | ((element: TourGuideElement | null) => void);

export interface TourGuideReactProps {
  steps: TourStep[];
  options?: TourOptions;
  /** Controlled open state. Sync it back with `onEnd`. */
  open?: boolean;
  startAt?: number;
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
  style?: Record<string, string | number>;
  /** Light-DOM content, e.g. `<div slot="step-welcome">…</div>`. */
  children?: unknown;
  ref?: TourGuideRef;
  onStart?: (event: TourEvent<'tour-start'>) => void;
  onBeforeChange?: (event: TourEvent<'tour-before-change'>) => void;
  onStepChange?: (event: TourEvent<'tour-step-change'>) => void;
  onComplete?: (event: TourEvent<'tour-complete'>) => void;
  onSkip?: (event: TourEvent<'tour-skip'>) => void;
  onClose?: (event: TourEvent<'tour-close'>) => void;
  onEnd?: (event: TourEvent<'tour-end'>) => void;
  /** A hook, `content()` or `target()` threw. `preventDefault()` silences the console log. */
  onError?: (event: TourEvent<'tour-error'>) => void;
}

const EVENT_PROPS = {
  onStart: 'tour-start',
  onBeforeChange: 'tour-before-change',
  onStepChange: 'tour-step-change',
  onComplete: 'tour-complete',
  onSkip: 'tour-skip',
  onClose: 'tour-close',
  onEnd: 'tour-end',
  onError: 'tour-error',
} as const satisfies Record<string, TourEventName>;

type EventProp = keyof typeof EVENT_PROPS;

export interface TourGuideControls {
  ref: { current: TourGuideElement | null };
  start: (index?: number) => Promise<boolean>;
  next: () => Promise<boolean>;
  back: () => Promise<boolean>;
  goTo: (index: number) => Promise<boolean>;
  skip: () => boolean;
  complete: () => boolean;
  close: () => boolean;
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- any keeps the component valid as a JSX element type for every React version */
export type TourGuideComponent = (props: TourGuideReactProps) => any;

export function createReactTourGuide(
  React: ReactLike,
  tagName: string = DEFAULT_TAG_NAME,
): { TourGuide: TourGuideComponent; useTourGuide: () => TourGuideControls } {
  defineTourGuide(tagName);

  const TourGuide = React.forwardRef(
    (props: TourGuideReactProps, forwardedRef: unknown) => {
      const elementRef = React.useRef(null) as { current: TourGuideElement | null };
      const latestProps = React.useRef(props) as { current: TourGuideReactProps };
      latestProps.current = props;

      React.useImperativeHandle(forwardedRef, () => elementRef.current, []);

      // Subscribe once; always call the latest handler.
      React.useEffect(() => {
        const element = elementRef.current;
        if (!element) return undefined;
        const offs = (Object.keys(EVENT_PROPS) as EventProp[]).map((prop) =>
          element.on(EVENT_PROPS[prop], (event) => {
            const handler = latestProps.current[prop] as
              ((e: CustomEvent) => void) | undefined;
            handler?.(event);
          }),
        );
        return () => {
          offs.forEach((off) => {
            off();
          });
        };
      }, []);

      React.useEffect(() => {
        if (elementRef.current) elementRef.current.steps = props.steps;
      }, [props.steps]);

      React.useEffect(() => {
        if (elementRef.current) elementRef.current.options = props.options ?? {};
      }, [props.options]);

      React.useEffect(() => {
        const element = elementRef.current;
        if (!element || props.open === undefined) return;
        if (props.open && !element.isActive) void element.start(props.startAt);
        else if (!props.open && element.isActive) element.close();
      }, [props.open]);

      return React.createElement(
        tagName,
        {
          ref: elementRef,
          theme: props.theme,
          className: props.className,
          style: props.style,
        },
        props.children,
      ) as unknown;
    },
  ) as TourGuideComponent;

  function useTourGuide(): TourGuideControls {
    const ref = React.useRef(null) as { current: TourGuideElement | null };
    return {
      ref,
      start: (index) => ref.current?.start(index) ?? Promise.resolve(false),
      next: () => ref.current?.next() ?? Promise.resolve(false),
      back: () => ref.current?.back() ?? Promise.resolve(false),
      goTo: (index) => ref.current?.goTo(index) ?? Promise.resolve(false),
      skip: () => ref.current?.skip() ?? false,
      complete: () => ref.current?.complete() ?? false,
      close: () => ref.current?.close() ?? false,
    };
  }

  return { TourGuide, useTourGuide };
}

export type { TourGuideElement };
