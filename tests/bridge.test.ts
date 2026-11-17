import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  connectNativeBridge,
  detectNativeChannel,
  parseCommand,
  serializeEvent,
} from '@apps';
import { defineTourGuide } from '@libs';
import type { TourGuideElement } from '@libs';

defineTourGuide();

type NativeGlobals = Record<string, unknown>;
const globals = window as unknown as NativeGlobals;

function mount(): TourGuideElement {
  const element = document.createElement('tour-guide');
  element.steps = [{ id: 'one', title: 'One' }, { title: 'Two' }, { title: 'Three' }];
  document.body.append(element);
  return element;
}

afterEach(() => {
  delete globals.ReactNativeWebView;
  delete globals.AndroidTour;
  delete globals.webkit;
  document.body.innerHTML = '';
});

describe('native bridge', () => {
  it('detects React Native, Android and iOS channels in that order', () => {
    expect(detectNativeChannel()).toBeNull();

    const ios = vi.fn();
    globals.webkit = { messageHandlers: { tourGuide: { postMessage: ios } } };
    detectNativeChannel()?.('ios');
    expect(ios).toHaveBeenCalledWith('ios');

    const android = vi.fn();
    globals.AndroidTour = { onTourEvent: android };
    detectNativeChannel()?.('android');
    expect(android).toHaveBeenCalledWith('android');

    const rn = vi.fn();
    globals.ReactNativeWebView = { postMessage: rn };
    detectNativeChannel()?.('rn');
    expect(rn).toHaveBeenCalledWith('rn');
  });

  it('serializes event details without functions or nodes', () => {
    const message = serializeEvent('tour-step-change', {
      index: 1,
      previousIndex: 0,
      total: 3,
      step: { id: 'x', content: () => document.createElement('p') },
    });
    expect(message).toEqual({
      source: 'tour-guide',
      type: 'tour-step-change',
      index: 1,
      previousIndex: 0,
      total: 3,
      stepId: 'x',
    });
    expect(
      serializeEvent('tour-end', { reason: 'skip', index: 2, step: null }),
    ).toMatchObject({
      reason: 'skip',
    });
  });

  it('parses only whitelisted commands', () => {
    expect(parseCommand('{"command":"goTo","index":2}')).toEqual({
      command: 'goTo',
      index: 2,
    });
    expect(parseCommand({ command: 'next' })).toEqual({ command: 'next' });
    expect(parseCommand('{"command":"remove"}')).toBeNull();
    expect(parseCommand('not json')).toBeNull();
    expect(parseCommand(42)).toBeNull();
    expect(parseCommand({ command: 'goTo', index: 'x' })).toEqual({ command: 'goTo' });
  });

  it('posts events to the host and runs incoming commands', async () => {
    const posted: { type: string; index?: number; reason?: string }[] = [];
    const element = mount();
    const disconnect = connectNativeBridge(element, {
      post: (json) => posted.push(JSON.parse(json) as (typeof posted)[number]),
    });

    window.dispatchEvent(new MessageEvent('message', { data: '{"command":"start"}' }));
    await Promise.resolve();
    expect(element.currentIndex).toBe(0);
    // React Native on Android posts to document.
    document.dispatchEvent(
      new MessageEvent('message', { data: { command: 'goTo', index: 2 } }),
    );
    await Promise.resolve();
    expect(element.currentIndex).toBe(2);
    window.dispatchEvent(new MessageEvent('message', { data: '{"command":"back"}' }));
    await Promise.resolve();
    expect(element.currentIndex).toBe(1);
    window.dispatchEvent(new MessageEvent('message', { data: '{"command":"next"}' }));
    window.dispatchEvent(new MessageEvent('message', { data: '{"command":"refresh"}' }));
    window.dispatchEvent(new MessageEvent('message', { data: '{"command":"skip"}' }));
    expect(element.status).toBe('skipped');

    expect(posted.map((message) => message.type)).toContain('tour-start');
    expect(posted.at(-1)).toMatchObject({ type: 'tour-end', reason: 'skip' });

    disconnect();
    const count = posted.length;
    window.dispatchEvent(new MessageEvent('message', { data: '{"command":"start"}' }));
    await Promise.resolve();
    expect(element.isActive).toBe(false);
    expect(posted).toHaveLength(count);
  });

  it('supports complete/close, goTo without index and an acceptMessage filter', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const element = mount();
    const accept = vi.fn(
      (event: MessageEvent) => event.origin !== 'https://evil.example',
    );
    const disconnect = connectNativeBridge(element, {
      post: () => undefined,
      acceptMessage: accept,
    });

    window.dispatchEvent(
      new MessageEvent('message', {
        data: '{"command":"start"}',
        origin: 'https://evil.example',
      }),
    );
    expect(element.isActive).toBe(false);

    await element.start();
    window.dispatchEvent(new MessageEvent('message', { data: '{"command":"goTo"}' }));
    expect(String(warn.mock.calls[0]?.[1])).toContain('needs an "index"');
    window.dispatchEvent(new MessageEvent('message', { data: '{"command":"complete"}' }));
    expect(element.status).toBe('completed');
    await element.start();
    window.dispatchEvent(new MessageEvent('message', { data: '{"command":"close"}' }));
    expect(element.status).toBe('closed');
    disconnect();
  });

  it('auto-detects the channel and can ignore commands', async () => {
    const postMessage = vi.fn();
    globals.ReactNativeWebView = { postMessage };
    const element = mount();
    const disconnect = connectNativeBridge(element, { commands: false });
    window.dispatchEvent(new MessageEvent('message', { data: '{"command":"start"}' }));
    expect(element.isActive).toBe(false);
    await element.start();
    expect(postMessage).toHaveBeenCalledWith(
      expect.stringContaining('"type":"tour-start"'),
    );
    disconnect();
  });

  it('logs at debug level when no channel exists', async () => {
    const element = mount();
    const disconnect = connectNativeBridge(element, { commands: false });
    await element.start();
    expect(element.isActive).toBe(true);
    disconnect();
  });
});
