/**
 * Angular (standalone, zoneless, JIT): CUSTOM_ELEMENTS_SCHEMA, [steps] / (tour-*) bindings,
 * provideAppInitializer(registerTourGuide) and TourGuideController.
 *
 * Plain JS, so decorators are applied as functions: `Component({...})(class)` is exactly what
 * the TypeScript decorator emits.
 */
import './helpers/dom.mjs';
import '@angular/compiler'; // JIT

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import {
  CUSTOM_ELEMENTS_SCHEMA,
  Component,
  VERSION,
  ViewChild,
  provideAppInitializer,
  provideZonelessChangeDetection,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';

import { setLogLevel } from '@xkid1/tour-guide';
import { TourGuideController, registerTourGuide } from '@xkid1/tour-guide/angular';

import { assertUserJourney, demoSteps, fixture, flush, part } from './helpers/tour.mjs';

setLogLevel('silent');

class AppComponent {
  steps = demoSteps();
  log = [];
  /** @type {TourGuideController | undefined} */
  tour;
  tourRef;

  ngAfterViewInit() {
    this.tour = new TourGuideController(this.tourRef.nativeElement).on('tour-start', () =>
      this.log.push('controller:start'),
    );
  }

  ngOnDestroy() {
    this.tour?.destroy();
  }

  onStep(event) {
    this.log.push(`step:${event.detail.index}`);
  }

  onEnd(event) {
    this.log.push(`end:${event.detail.reason}`);
  }
}

ViewChild('tour')(AppComponent.prototype, 'tourRef');
Component({
  selector: 'app-root',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <button id="opener" (click)="tour?.start()">Take the tour</button>
    <tour-guide
      #tour
      theme="dark"
      [steps]="steps"
      (tour-step-change)="onStep($event)"
      (tour-end)="onEnd($event)"
    >
      <div slot="step-welcome" id="ng-slot">Projected by Angular</div>
    </tour-guide>
  `,
})(AppComponent);

let appRef = null;
let cleanup = () => undefined;

beforeEach(async () => {
  cleanup = fixture();
  document.body.append(document.createElement('app-root'));
  appRef = await bootstrapApplication(AppComponent, {
    providers: [
      provideZonelessChangeDetection(),
      provideAppInitializer(registerTourGuide),
    ],
  });
  await appRef.whenStable();
  await flush();
});

afterEach(() => {
  appRef?.destroy();
  appRef = null;
  document.querySelector('app-root')?.remove();
  cleanup();
});

const app = () => appRef.components[0].instance;
const tourElement = () => document.querySelector('app-root tour-guide');

describe(`@xkid1/tour-guide/angular with Angular ${VERSION.full}`, () => {
  it('registerTourGuide() as an app initializer upgrades <tour-guide>', () => {
    const element = tourElement();
    assert.equal(customElements.get('tour-guide') !== undefined, true);
    assert.equal(typeof element.start, 'function');
    assert.equal(element.getAttribute('theme'), 'dark');
    assert.equal(element.total, 3, '[steps] binds the DOM property');
  });

  it('a template (click) handler + TourGuideController runs the user journey', async () => {
    const element = tourElement();
    await assertUserJourney(element, async () => {
      document.querySelector('app-root #opener').click();
      await flush();
    });
    assert.deepEqual(app().log.slice(0, 2), ['controller:start', 'step:0']);
    assert.equal(app().log.at(-1), 'end:close');
  });

  it('(tour-*) output bindings receive the CustomEvent', async () => {
    await app().tour.start();
    await flush();
    part(tourElement(), 'skip-button').click();
    await flush();
    assert.equal(app().log.at(-1), 'end:skip');
  });

  it('content projection reaches the step slot', async () => {
    await app().tour.start();
    await flush();
    assert.equal(document.getElementById('ng-slot').parentElement, tourElement());
    assert.ok(tourElement().shadowRoot.querySelector('slot[name="step-welcome"]'));
  });

  it('destroying the app closes the tour (ngOnDestroy → controller.destroy)', async () => {
    const element = tourElement();
    await app().tour.start();
    await flush();
    assert.equal(element.isActive, true);
    appRef.destroy();
    appRef = null;
    assert.equal(element.isActive, false);
  });
});
