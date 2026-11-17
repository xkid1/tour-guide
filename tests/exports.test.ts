import { describe, expect, it } from 'vitest';

import * as apps from '@apps';

import * as browser from '../src/apps/browser/index';
import * as electron from '../src/apps/electron/index';
import * as root from '../src/index';

describe('package entry points', () => {
  it('the browser entry re-exports the whole root API', () => {
    expect(Object.keys(browser)).toEqual(expect.arrayContaining(Object.keys(root)));
    expect(browser.createTour).toBe(apps.createTour);
    expect(browser.connectNativeBridge).toBe(apps.connectNativeBridge);
  });

  it('the electron entry is the browser entry', () => {
    expect(Object.keys(electron).sort()).toEqual(Object.keys(browser).sort());
  });

  it('the browser entry registers <tour-guide> on import', () => {
    expect(customElements.get(root.DEFAULT_TAG_NAME)).toBe(root.TourGuideElement);
  });

  it('the root API does not leak layer-internal modules', () => {
    expect(Object.keys(root).sort()).toEqual([
      'DEFAULT_ICONS',
      'DEFAULT_LABELS',
      'DEFAULT_OPTIONS',
      'DEFAULT_TAG_NAME',
      'TOUR_STYLES',
      'TourGuideElement',
      'TourGuideError',
      'TourManager',
      'computePosition',
      'defineTourGuide',
      'isTourGuideError',
      'resolveOptions',
      'setLogLevel',
      'validateOptions',
      'validateSteps',
    ]);
  });
});
