/**
 * Native WebViews: Android WebView (`addJavascriptInterface`), React Native WebView and iOS
 * WKWebView. The host channels are faked exactly as each platform injects them.
 */
import './helpers/dom.mjs';

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import {
  connectNativeBridge,
  detectNativeChannel,
  parseCommand,
} from '@xkid1/tour-guide/android';
import { setLogLevel } from '@xkid1/tour-guide/browser';

import { demoSteps, fixture, flush } from './helpers/tour.mjs';

setLogLevel('silent');

let cleanup = () => undefined;
let element;
let disconnect = () => undefined;

beforeEach(() => {
  cleanup = fixture();
  element = document.createElement('tour-guide');
  element.steps = demoSteps();
  document.body.append(element);
});

afterEach(() => {
  disconnect();
  element.remove();
  cleanup();
  delete window.ReactNativeWebView;
  delete window.AndroidTour;
  delete window.MyBridge;
  delete window.webkit;
});

/** What the native side does to drive the tour. */
function hostSends(target, data) {
  target.dispatchEvent(new MessageEvent('message', { data }));
}

async function assertTwoWay(received, target = window) {
  hostSends(target, JSON.stringify({ command: 'start' }));
  await flush();
  assert.equal(element.isActive, true);
  hostSends(target, JSON.stringify({ command: 'next' }));
  await flush();
  assert.equal(element.currentIndex, 1);
  hostSends(target, { command: 'goTo', index: 2 }); // objects are accepted too
  await flush();
  assert.equal(element.currentIndex, 2);
  hostSends(target, JSON.stringify({ command: 'complete' }));
  await flush();
  assert.equal(element.isActive, false);

  const messages = received.map((json) => JSON.parse(json));
  for (const message of messages) assert.equal(message.source, 'tour-guide');
  const start = messages.find((m) => m.type === 'tour-start');
  assert.deepEqual(start, {
    source: 'tour-guide',
    type: 'tour-start',
    index: 0,
    total: 3,
  });
  const change = messages.find((m) => m.type === 'tour-step-change' && m.index === 1);
  assert.equal(change.stepId, 'anchor');
  const end = messages.at(-1);
  assert.equal(end.type, 'tour-end');
  assert.equal(end.reason, 'complete');
}

describe('@xkid1/tour-guide/android', () => {
  it('React Native WebView: window.ReactNativeWebView.postMessage', async () => {
    const received = [];
    window.ReactNativeWebView = { postMessage: (json) => received.push(json) };
    disconnect = connectNativeBridge(element);
    // RN WebView posts host → page messages on `document` on Android.
    await assertTwoWay(received, document);
  });

  it('Android WebView: addJavascriptInterface(…, "AndroidTour").onTourEvent', async () => {
    const received = [];
    window.AndroidTour = { onTourEvent: (json) => received.push(json) };
    disconnect = connectNativeBridge(element);
    await assertTwoWay(received);
  });

  it('Android WebView with a custom interface name', async () => {
    const received = [];
    window.MyBridge = { onTourEvent: (json) => received.push(json) };
    disconnect = connectNativeBridge(element, { androidInterface: 'MyBridge' });
    await assertTwoWay(received);
  });

  it('iOS WKWebView: webkit.messageHandlers.tourGuide.postMessage', async () => {
    const received = [];
    window.webkit = {
      messageHandlers: { tourGuide: { postMessage: (j) => received.push(j) } },
    };
    disconnect = connectNativeBridge(element);
    await assertTwoWay(received);
  });

  it('events are JSON-safe (no functions or DOM nodes)', async () => {
    const received = [];
    disconnect = connectNativeBridge(element, { post: (json) => received.push(json) });
    await element.start();
    await flush();
    for (const json of received) {
      const value = JSON.parse(json);
      assert.deepEqual(JSON.parse(JSON.stringify(value)), value);
    }
  });

  it('ignores unknown commands and rejected origins', async () => {
    disconnect = connectNativeBridge(element, {
      post: () => undefined,
      acceptMessage: (event) => event.origin === '' || event.origin === 'app://trusted',
    });
    hostSends(window, '{"command":"eval","code":"alert(1)"}');
    hostSends(window, 'not json');
    await flush();
    assert.equal(element.isActive, false);
    assert.equal(parseCommand({ command: '__proto__' }), null);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: '{"command":"start"}',
        origin: 'https://evil.test',
      }),
    );
    await flush();
    assert.equal(element.isActive, false);
  });

  it('disconnect() stops both directions', async () => {
    const received = [];
    disconnect = connectNativeBridge(element, { post: (json) => received.push(json) });
    disconnect();
    hostSends(window, '{"command":"start"}');
    await flush();
    assert.equal(element.isActive, false);
    await element.start();
    assert.equal(received.length, 0);
    element.close();
  });

  it('detectNativeChannel() returns null in a plain browser', () => {
    assert.equal(detectNativeChannel(), null);
  });
});
