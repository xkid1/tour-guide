/**
 * Native WebView bridge (Android WebView, React Native WebView, iOS WKWebView).
 * Also bundled in the IIFE build as `TourGuide.connectNativeBridge`.
 *
 *   const disconnect = connectNativeBridge(document.querySelector('tour-guide'));
 *
 * - Tour events go to the host as JSON (`BridgeEventMessage`).
 * - The host drives the tour by posting `{ "command": "next" }` / `{ "command": "goTo", "index": 2 }`.
 *   Only the whitelisted commands are accepted; anything else is ignored.
 */
import type { TourGuideElement } from '@libs';
import type {
  BridgeCommand,
  BridgeCommandMessage,
  BridgeEventMessage,
  NativeBridgeOptions,
  TourEventMap,
  TourEventName,
} from '@types';
import { logger } from '@utils';

const EVENTS: readonly TourEventName[] = [
  'tour-start',
  'tour-before-change',
  'tour-step-change',
  'tour-complete',
  'tour-skip',
  'tour-close',
  'tour-end',
  'tour-error',
];

const COMMANDS: readonly BridgeCommand[] = [
  'start',
  'next',
  'back',
  'goTo',
  'skip',
  'complete',
  'close',
  'refresh',
];

interface NativeWindow {
  ReactNativeWebView?: { postMessage: (message: string) => void };
  webkit?: {
    messageHandlers?: Record<
      string,
      { postMessage: (message: string) => void } | undefined
    >;
  };
  [androidInterface: string]: unknown;
}

/** Picks the first available native channel, or `null` (then events are only logged at debug). */
export function detectNativeChannel(
  options: Pick<NativeBridgeOptions, 'androidInterface' | 'iosHandler'> = {},
): ((json: string) => void) | null {
  if (typeof window === 'undefined') return null;
  const native = window as unknown as NativeWindow;
  const reactNative = native.ReactNativeWebView;
  if (reactNative)
    return (json) => {
      reactNative.postMessage(json);
    };

  const android = native[options.androidInterface ?? 'AndroidTour'] as
    { onTourEvent?: (json: string) => void } | undefined;
  if (typeof android?.onTourEvent === 'function') {
    return (json) => {
      android.onTourEvent?.(json);
    };
  }

  const ios = native.webkit?.messageHandlers?.[options.iosHandler ?? 'tourGuide'];
  if (ios)
    return (json) => {
      ios.postMessage(json);
    };
  return null;
}

/** Reduces an event detail to JSON-safe fields (no functions, no DOM nodes). */
export function serializeEvent<K extends TourEventName>(
  type: K,
  detail: TourEventMap[K],
): BridgeEventMessage {
  const message: BridgeEventMessage = { source: 'tour-guide', type };
  const record = detail as Partial<Record<string, unknown>>;
  for (const key of ['index', 'total', 'previousIndex', 'from', 'to'] as const) {
    const value = record[key];
    if (typeof value === 'number') message[key] = value;
  }
  if (typeof record.reason === 'string')
    message.reason = record.reason as BridgeEventMessage['reason'];
  const step = record.step as { id?: unknown } | null | undefined;
  if (typeof step?.id === 'string') message.stepId = step.id;
  const error = record.error as { message?: unknown } | undefined;
  if (typeof error?.message === 'string') message.message = error.message;
  return message;
}

/** Parses an incoming command; `null` when it is not a valid tour command. */
export function parseCommand(data: unknown): BridgeCommandMessage | null {
  let value: unknown = data;
  if (typeof data === 'string') {
    try {
      value = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (typeof value !== 'object' || value === null) return null;
  const { command, index } = value as { command?: unknown; index?: unknown };
  if (typeof command !== 'string' || !(COMMANDS as readonly string[]).includes(command))
    return null;
  const message: BridgeCommandMessage = { command: command as BridgeCommand };
  if (typeof index === 'number' && Number.isFinite(index)) message.index = index;
  return message;
}

/** Runs a parsed command on the element. */
export function runCommand(
  element: TourGuideElement,
  message: BridgeCommandMessage,
): void {
  switch (message.command) {
    case 'start':
      void element.start(message.index);
      break;
    case 'goTo':
      if (message.index === undefined) logger.warn('bridge: "goTo" needs an "index".');
      else void element.goTo(message.index);
      break;
    case 'next':
      void element.next();
      break;
    case 'back':
      void element.back();
      break;
    case 'skip':
      element.skip();
      break;
    case 'complete':
      element.complete();
      break;
    case 'close':
      element.close();
      break;
    case 'refresh':
      element.refresh();
      break;
  }
}

/**
 * Connects a `<tour-guide>` to the native host. Returns a function that disconnects it.
 */
export function connectNativeBridge(
  element: TourGuideElement,
  options: NativeBridgeOptions = {},
): () => void {
  const post = options.post ?? detectNativeChannel(options);
  if (!post) {
    logger.debug(
      'bridge: no native channel found (ReactNativeWebView, AndroidTour, webkit).',
    );
  }
  const offs = EVENTS.map((type) =>
    element.on(type, (event) => {
      const json = JSON.stringify(serializeEvent(type, event.detail));
      if (post) post(json);
      else logger.debug('bridge event', json);
    }),
  );

  if (options.commands !== false && typeof window !== 'undefined') {
    const onMessage = (event: Event) => {
      if (!(event instanceof MessageEvent)) return;
      if (options.acceptMessage && !options.acceptMessage(event)) return;
      const command = parseCommand(event.data);
      if (command) runCommand(element, command);
    };
    // React Native WebView posts to `document` on Android and to `window` on iOS.
    window.addEventListener('message', onMessage);
    document.addEventListener('message', onMessage);
    offs.push(() => {
      window.removeEventListener('message', onMessage);
      document.removeEventListener('message', onMessage);
    });
  }

  return () => {
    offs.splice(0).forEach((off) => {
      off();
    });
  };
}
