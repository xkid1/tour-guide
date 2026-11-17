import type { TourEndReason } from '../manager/manager';

/** Commands a native host (Android, iOS, React Native) can send into the WebView. */
export type BridgeCommand =
  'start' | 'next' | 'back' | 'goTo' | 'skip' | 'complete' | 'close' | 'refresh';

/** JSON message a native host posts to drive the tour: `{ "command": "goTo", "index": 2 }`. */
export interface BridgeCommandMessage {
  command: BridgeCommand;
  index?: number;
}

/**
 * JSON-safe event payload sent to the native host. Functions and DOM nodes from the step are
 * dropped; only ids and indexes cross the bridge.
 */
export interface BridgeEventMessage {
  source: 'tour-guide';
  type: string;
  index?: number;
  total?: number;
  previousIndex?: number;
  from?: number;
  to?: number;
  reason?: TourEndReason;
  stepId?: string;
  message?: string;
}

export interface NativeBridgeOptions {
  /**
   * Sends a serialized message to the host. Defaults to the first one available:
   * `window.ReactNativeWebView.postMessage`, `window[androidInterface].onTourEvent`,
   * `window.webkit.messageHandlers[iosHandler].postMessage`.
   */
  post?: (json: string) => void;
  /** Name of the Android `@JavascriptInterface` object. Default `AndroidTour`. */
  androidInterface?: string;
  /** Name of the iOS `WKScriptMessageHandler`. Default `tourGuide`. */
  iosHandler?: string;
  /** Listen for `{ command }` messages posted into the page. Default `true`. */
  commands?: boolean;
  /** Extra filter for incoming messages, e.g. an origin check. Default: accept all. */
  acceptMessage?: (event: MessageEvent) => boolean;
}
