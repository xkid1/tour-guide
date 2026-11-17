import { afterEach, describe, expect, it } from 'vitest';

import { enableResume } from '@apps';
import { defineTourGuide } from '@libs';
import type { TourGuideElement } from '@libs';

defineTourGuide();

const flush = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

/** A fresh declarative tour, like the one a page renders on every load. */
function mount(): TourGuideElement {
  document.body.insertAdjacentHTML(
    'beforeend',
    `<tour-guide>
       <tour-step step-id="one" title="One">1</tour-step>
       <tour-step step-id="two" title="Two">2</tour-step>
       <tour-step title="Three">3</tour-step>
     </tour-guide>`,
  );
  return document.querySelector('tour-guide')!;
}

afterEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
});

describe('enableResume (@xkid1/tour-guide/resume)', () => {
  it('resumes at the skipped step after a "reload", and forgets it on completion', async () => {
    const first = mount();
    const resume = enableResume(first, { key: 'demo' });
    expect(resume.savedIndex).toBeNull();
    await first.start();
    await first.next();
    first.skip();
    expect(JSON.parse(localStorage.getItem('tour-guide:demo')!)).toEqual({
      index: 1,
      stepId: 'two',
    });
    resume.destroy();
    first.remove();

    const second = mount();
    const again = enableResume(second, { key: 'demo' });
    expect(again.savedIndex).toBe(1); // read from <tour-step step-id> before start
    await again.start();
    expect(second.currentIndex).toBe(1);
    await second.next();
    await second.next(); // completes
    expect(localStorage.getItem('tour-guide:demo')).toBeNull();
    expect(again.savedIndex).toBeNull();
  });

  it('saves on close by default, only on the configured endings otherwise', async () => {
    const element = mount();
    const resume = enableResume(element, { key: 'demo' });
    await element.start(2);
    element.close();
    expect(resume.savedIndex).toBe(2);
    resume.clear();
    expect(resume.savedIndex).toBeNull();
    resume.destroy();

    const skipOnly = enableResume(element, { key: 'demo', on: ['skip'] });
    await element.start(1);
    element.close();
    expect(skipOnly.savedIndex).toBeNull();
    await element.start(1);
    element.skip();
    expect(skipOnly.savedIndex).toBe(1);
  });

  it('starts from the beginning when nothing is saved', async () => {
    const element = mount();
    await enableResume(element, { key: 'demo' }).start();
    expect(element.currentIndex).toBe(0);
  });

  it('autoStart reopens a saved tour once the element is defined', async () => {
    localStorage.setItem('tour-guide:demo', JSON.stringify({ index: 0, stepId: 'two' }));
    const element = mount();
    enableResume(element, { key: 'demo', autoStart: true });
    await flush();
    expect(element.isActive).toBe(true);
    expect(element.currentIndex).toBe(1);
  });

  it('autoStart does nothing without a saved step', async () => {
    const element = mount();
    enableResume(element, { key: 'demo', autoStart: true });
    await flush();
    expect(element.isActive).toBe(false);
  });
});
