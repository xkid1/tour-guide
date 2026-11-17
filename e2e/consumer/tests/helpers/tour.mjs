/**
 * Shared end-user assertions. Everything here goes through the public surface only:
 * element methods/properties, `part` names, ARIA attributes and DOM events.
 */
import assert from 'node:assert/strict';

/** Three steps: centred welcome, one anchored to #anchor, a final one. */
export function demoSteps() {
  return [
    { id: 'welcome', title: 'Welcome', content: 'Hello from the tour' },
    { id: 'anchor', target: '#anchor', title: 'Anchored', content: '<b>not html</b>' },
    { id: 'done', title: 'Done', content: 'Bye' },
  ];
}

/** Adds the light-DOM fixture the steps point at, and returns a cleanup function. */
export function fixture() {
  const host = document.createElement('main');
  host.innerHTML =
    '<button id="opener">Take the tour</button><button id="anchor">Anchor</button>';
  document.body.append(host);
  return () => host.remove();
}

/** `[part~=name]` in the element's shadow root. */
export function part(element, name) {
  const node = element.shadowRoot?.querySelector(`[part~="${name}"]`);
  assert.ok(node, `shadow part "${name}" exists`);
  return node;
}

/** Lets microtasks, timers and one animation frame run. */
export async function flush(times = 2) {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    await new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
}

export function press(key) {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  );
}

/** Records every tour event dispatched by `element`. */
export function recordEvents(element) {
  const names = [
    'tour-start',
    'tour-before-change',
    'tour-step-change',
    'tour-complete',
    'tour-skip',
    'tour-close',
    'tour-end',
    'tour-error',
  ];
  const log = [];
  for (const name of names) {
    element.addEventListener(name, (event) => {
      log.push({ type: name, detail: event.detail });
    });
  }
  return log;
}

/** The popover the user sees for the active step. */
export function assertStepShown(element, { title, progress }) {
  assert.equal(element.isActive, true, 'tour is active');
  assert.equal(element.hasAttribute('open'), true, 'open attribute is reflected');
  const root = part(element, 'root');
  assert.equal(root.hidden, false, 'root part is visible');
  assert.equal(part(element, 'title').textContent, title);
  if (progress) assert.equal(part(element, 'progress').textContent, progress);

  const popover = part(element, 'popover');
  assert.equal(popover.getAttribute('role'), 'dialog');
  assert.equal(popover.getAttribute('aria-modal'), 'true');
  const labelledBy = popover.getAttribute('aria-labelledby');
  assert.ok(labelledBy, 'popover is labelled');
  assert.equal(element.shadowRoot.getElementById(labelledBy)?.textContent, title);
}

/**
 * The full journey a user takes, driven by clicks and the keyboard:
 * start → Next (click) → ArrowRight → ArrowLeft → Back (click) → Escape.
 * `start` is how the adapter under test opens the tour.
 */
export async function assertUserJourney(element, start) {
  const events = recordEvents(element);
  await start();
  await flush();

  assertStepShown(element, { title: 'Welcome', progress: '1 of 3' });
  assert.equal(part(element, 'back-button').hidden, true, 'no Back on the first step');

  part(element, 'next-button').click();
  await flush();
  assertStepShown(element, { title: 'Anchored', progress: '2 of 3' });
  assert.equal(
    part(element, 'body').textContent.includes('<b>not html</b>'),
    true,
    'string content renders as text, not HTML',
  );
  assert.equal(element.shadowRoot.querySelector('b'), null);

  press('ArrowRight');
  await flush();
  assertStepShown(element, { title: 'Done', progress: '3 of 3' });
  assert.ok(
    part(element, 'primary-button').getAttribute('part').includes('complete-button'),
    'last step shows the complete button',
  );

  press('ArrowLeft');
  await flush();
  assert.equal(element.currentIndex, 1);

  part(element, 'back-button').click();
  await flush();
  assert.equal(element.currentIndex, 0);

  press('Escape');
  await flush();
  assert.equal(element.isActive, false, 'Escape closes the tour');
  assert.equal(element.hasAttribute('open'), false);
  assert.equal(part(element, 'root').hidden, true);

  const types = events.map((event) => event.type);
  // The first step is cancelable too, so tour-before-change can precede tour-start.
  const started = types.indexOf('tour-start');
  assert.ok(started >= 0, 'tour-start fired');
  assert.ok(
    started < types.indexOf('tour-step-change'),
    'tour-start precedes the first step-change',
  );
  assert.equal(
    types.filter((type) => type === 'tour-start').length,
    1,
    'tour-start fired once',
  );
  assert.ok(types.includes('tour-before-change'));
  assert.deepEqual(types.slice(-2), ['tour-close', 'tour-end']);
  assert.equal(events.at(-1).detail.reason, 'close');
  return events;
}

/** Completing via the last button fires tour-complete then tour-end(reason: complete). */
export async function assertCompletes(element) {
  const events = recordEvents(element);
  await element.goTo(element.total - 1);
  await flush();
  part(element, 'primary-button').click();
  await flush();
  assert.equal(element.isActive, false);
  assert.deepEqual(
    events.slice(-2).map((event) => event.type),
    ['tour-complete', 'tour-end'],
  );
  assert.equal(events.at(-1).detail.reason, 'complete');
}
