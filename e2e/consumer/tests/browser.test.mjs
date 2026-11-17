/** Vanilla JS: `@xkid1/tour-guide/browser` and the plain `<tour-guide>` element. */
import './helpers/dom.mjs';

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import {
  TourGuideElement,
  createTour,
  defineTourGuide,
  isTourGuideError,
  setLogLevel,
} from '@xkid1/tour-guide/browser';
import { enableResume } from '@xkid1/tour-guide/resume';

import {
  assertCompletes,
  assertStepShown,
  assertUserJourney,
  demoSteps,
  fixture,
  flush,
  part,
} from './helpers/tour.mjs';

setLogLevel('silent');

let cleanup = () => undefined;
beforeEach(() => {
  cleanup = fixture();
});
afterEach(() => {
  cleanup();
  document.body.querySelectorAll('tour-guide, my-tour').forEach((node) => node.remove());
});

describe('@xkid1/tour-guide/browser', () => {
  it('registers <tour-guide> on import', () => {
    assert.equal(customElements.get('tour-guide'), TourGuideElement);
    assert.ok(document.createElement('tour-guide') instanceof TourGuideElement);
  });

  it('createTour(): full keyboard and mouse journey, then destroy()', async () => {
    const seen = [];
    const tour = createTour({
      steps: demoSteps(),
      theme: 'dark',
      on: { 'tour-end': (event) => seen.push(event.detail.reason) },
    });
    assert.equal(tour.element.isConnected, true);
    assert.equal(tour.element.getAttribute('theme'), 'dark');

    await assertUserJourney(tour.element, () => tour.start());
    assert.deepEqual(seen, ['close']);

    tour.destroy();
    assert.equal(tour.element.isConnected, false);
  });

  it('createTour(): completes and skips', async () => {
    const tour = createTour({ steps: demoSteps() });
    await tour.start();
    await assertCompletes(tour.element);

    await tour.start(1);
    await flush();
    part(tour.element, 'skip-button').click();
    await flush();
    assert.equal(tour.element.isActive, false);
    tour.destroy();
  });

  it('restores focus to the element that opened the tour', async () => {
    const opener = document.getElementById('opener');
    opener.focus();
    const tour = createTour({ steps: demoSteps() });
    await tour.start();
    await flush();
    tour.close();
    await flush();
    assert.equal(document.activeElement, opener);
    tour.destroy();
  });

  it('the highlighted target stays clickable unless allow-target-interaction="false"', async () => {
    const target = document.getElementById('anchor');
    target.getBoundingClientRect = () =>
      DOMRect.fromRect({ x: 40, y: 40, width: 80, height: 30 });
    document.body.insertAdjacentHTML(
      'beforeend',
      `<tour-guide id="clickable"><tour-step target="#anchor" title="Click me">Hi</tour-step></tour-guide>`,
    );
    const element = document.getElementById('clickable');
    await element.start();
    assert.match(part(element, 'backdrop').style.clipPath, /evenodd/);
    element.close();

    element.setAttribute('allow-target-interaction', 'false');
    await element.start();
    assert.equal(part(element, 'backdrop').style.clipPath, '');
    assert.equal(element.resolvedOptions.allowTargetInteraction, false);
    element.close();
  });

  it('@xkid1/tour-guide/resume: a skipped tour resumes at that step in a fresh element', async () => {
    const markup = `<tour-guide id="resumable"><tour-step title="One">1</tour-step><tour-step title="Two">2</tour-step><tour-step title="Three">3</tour-step></tour-guide>`;
    document.body.insertAdjacentHTML('beforeend', markup);
    let element = document.getElementById('resumable');
    let resume = enableResume(element, { key: 'e2e' });
    await element.start();
    await element.next();
    element.skip();
    resume.destroy();
    element.remove();

    document.body.insertAdjacentHTML('beforeend', markup);
    element = document.getElementById('resumable');
    resume = enableResume(element, { key: 'e2e' });
    assert.equal(resume.savedIndex, 1);
    await resume.start();
    assertStepShown(element, { title: 'Two' });
    element.close();
    resume.clear();
    assert.equal(resume.savedIndex, null);
    localStorage.clear();
  });

  it('declarative markup: <tour-guide open> with <tour-step> children', async () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<tour-guide id="declarative" open show-progress="false">
         <tour-step title="Welcome">Hello</tour-step>
         <tour-step target="#anchor" title="Anchored">There</tour-step>
         <tour-step title="Done">Bye</tour-step>
       </tour-guide>`,
    );
    await flush();
    const element = document.getElementById('declarative');
    assert.equal(element.total, 3);
    assertStepShown(element, { title: 'Welcome' });
    element.removeAttribute('open');
    await flush();
    assert.equal(element.isActive, false);
  });

  it('user-code errors become tour-error events, never crashes', async () => {
    const tour = createTour({
      steps: [
        {
          title: 'Broken',
          content: () => {
            throw new Error('boom');
          },
        },
      ],
    });
    let error = null;
    tour.element.addEventListener('tour-error', (event) => {
      event.preventDefault();
      error = event.detail;
    });
    await tour.start();
    await flush();
    assert.ok(error, 'tour-error fired');
    assert.ok(isTourGuideError(error.error), 'detail.error is a TourGuideError');
    assert.equal(error.error.code, 'HOOK_FAILED');
    assert.equal(error.error.cause.message, 'boom');
    assert.equal(tour.element.isActive, true, 'the tour keeps running');
    tour.destroy();
  });

  it('custom tag names coexist with <tour-guide>', async () => {
    const MyTour = defineTourGuide('my-tour');
    assert.notEqual(MyTour, TourGuideElement);
    const tour = createTour({ steps: demoSteps(), tagName: 'my-tour' });
    assert.equal(tour.element.localName, 'my-tour');
    assert.ok(tour.element instanceof TourGuideElement);
    await tour.start();
    await flush();
    assertStepShown(tour.element, { title: 'Welcome' });
    tour.destroy();
  });

  it('styles are applied inside the shadow root once the tour renders', async () => {
    const tour = createTour({ steps: demoSteps() });
    await tour.start();
    await flush();
    const shadow = tour.element.shadowRoot;
    const adopted = shadow.adoptedStyleSheets?.length ?? 0;
    const inline = shadow.querySelectorAll('style').length;
    assert.ok(adopted + inline > 0, 'a stylesheet is attached');
    tour.destroy();
  });
});
