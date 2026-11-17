import { describe, expect, it } from 'vitest';

import {
  OBSERVED_ATTRIBUTES,
  parseBoolean,
  parseNumber,
  readAttributeOptions,
  readDeclarativeSteps,
} from './attributes';

function element(html: string): Element {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host.firstElementChild!;
}

describe('attribute parsing', () => {
  it('parses booleans and numbers', () => {
    expect(parseBoolean(null)).toBeUndefined();
    expect(parseBoolean('')).toBe(true);
    expect(parseBoolean('true')).toBe(true);
    expect(parseBoolean(' FALSE ')).toBe(false);
    expect(parseNumber(null)).toBeUndefined();
    expect(parseNumber(' ')).toBeUndefined();
    expect(parseNumber('abc')).toBeUndefined();
    expect(parseNumber('12.5')).toBe(12.5);
  });

  it('observes every option attribute plus open/start-at', () => {
    expect(OBSERVED_ATTRIBUTES).toEqual(
      expect.arrayContaining([
        'open',
        'start-at',
        'backdrop',
        'mobile-placement',
        'label-next',
        'offset',
      ]),
    );
  });

  it('reads options of every kind', () => {
    const options = readAttributeOptions(
      element(
        '<tour-guide backdrop="false" trap-focus offset="20" offset-x="1" mobile-breakpoint="x" placement=" top " mobile-placement="bottom" missing-target="skip" label-next="Go" aria-label="Help"></tour-guide>',
      ),
    );
    expect(options).toEqual({
      backdrop: false,
      trapFocus: true,
      offset: 20,
      placement: 'top',
      mobilePlacement: 'bottom',
      missingTarget: 'skip',
      ariaLabel: 'Help',
      labels: { next: 'Go' },
    });
  });

  it('reads allow-target-interaction', () => {
    expect(
      readAttributeOptions(
        element('<tour-guide allow-target-interaction="false"></tour-guide>'),
      ),
    ).toEqual({ allowTargetInteraction: false });
  });

  it('returns an empty layer when nothing is set', () => {
    expect(readAttributeOptions(element('<tour-guide></tour-guide>'))).toEqual({});
  });
});

describe('readDeclarativeSteps', () => {
  it('reads <tour-step> children and ignores other elements', () => {
    const host = element(`
      <tour-guide>
        <tour-step step-id="a" target="#a" title="A" placement="left" spotlight-padding="4" show-skip="false" allow-target-interaction="false">Hello <b>world</b></tour-step>
        <div>not a step</div>
        <tour-step>Plain</tour-step>
      </tour-guide>`);
    const steps = readDeclarativeSteps(host);
    expect(steps).toHaveLength(2);
    const [first, second] = steps;
    expect(first).toMatchObject({
      id: 'a',
      target: '#a',
      title: 'A',
      placement: 'left',
      spotlightPadding: 4,
      showSkip: false,
      allowTargetInteraction: false,
    });
    expect('showBack' in first!).toBe(false);
    expect(second?.id).toBeUndefined();

    const content = first?.content as () => DocumentFragment;
    const fragment = content();
    expect(fragment.textContent).toBe('Hello world');
    expect(fragment.querySelector('b')).not.toBeNull();
    // Each render gets a fresh clone, so the source stays intact.
    expect(content()).not.toBe(fragment);
    expect(host.querySelector('tour-step b')).not.toBeNull();
  });
});
