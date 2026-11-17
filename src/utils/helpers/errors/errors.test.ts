import { describe, expect, it } from 'vitest';

import {
  TourGuideError,
  describeStep,
  didYouMean,
  editDistance,
  hookError,
  isTourGuideError,
  suggest,
} from './errors';

describe('TourGuideError', () => {
  it('carries a code, a name and only the context it was given', () => {
    const error = new TourGuideError('INVALID_INDEX', 'bad index', { stepIndex: 4 });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('TourGuideError');
    expect(error.code).toBe('INVALID_INDEX');
    expect(error.message).toBe('bad index');
    expect(error.stepIndex).toBe(4);
    expect('phase' in error).toBe(false);
    expect('cause' in error).toBe(false);
  });

  it('isTourGuideError recognises instances and look-alikes from other realms', () => {
    expect(isTourGuideError(new TourGuideError('NO_STEPS', 'x'))).toBe(true);
    const foreign = Object.assign(new Error('x'), {
      name: 'TourGuideError',
      code: 'NO_STEPS',
    });
    expect(isTourGuideError(foreign)).toBe(true);
    expect(isTourGuideError(new Error('x'))).toBe(false);
    expect(isTourGuideError('TourGuideError')).toBe(false);
  });
});

describe('hookError', () => {
  it('names the hook and step, keeps the cause and explains the outcome', () => {
    const cause = new Error('network down');
    const error = hookError(cause, 'beforeShow', 2, 'billing');
    expect(error.code).toBe('HOOK_FAILED');
    expect(error.phase).toBe('beforeShow');
    expect(error.stepIndex).toBe(2);
    expect(error.stepId).toBe('billing');
    expect(error.cause).toBe(cause);
    expect(error.message).toContain(
      'beforeShow() of step 2 ("billing") threw: network down',
    );
    expect(error.message).toContain('previous step stays visible');
  });

  it('describes non-Error throws', () => {
    expect(hookError('oops', 'content', 0).message).toContain('threw: oops');
    expect(hookError({ a: 1 }, 'target', 0).message).toContain('threw: {"a":1}');
    expect(hookError(undefined, 'afterShow', 0).message).toContain('threw: undefined');
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(hookError(circular, 'afterShow', 1).message).toContain('[object Object]');
  });

  it('omits the step when there is none', () => {
    expect(hookError(new Error('x'), 'beforeChange', -1).message).toMatch(
      /^beforeChange\(\) threw/,
    );
  });
});

describe('suggestions', () => {
  it('computes edit distance', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('same', 'same')).toBe(0);
  });

  it('suggests the closest candidate, case-insensitively, or nothing', () => {
    const keys = ['closeOnEsc', 'placement', 'backdrop'];
    expect(suggest('clsoeOnEsc', keys)).toBe('closeOnEsc');
    expect(suggest('PLACEMNT', keys)).toBe('placement');
    expect(suggest('zzzzzz', keys)).toBeUndefined();
    expect(didYouMean('backdorp', keys)).toBe(' Did you mean "backdrop"?');
    expect(didYouMean('zzzzzz', keys)).toBe('');
  });

  it('describes steps with and without ids', () => {
    expect(describeStep(1)).toBe('step 1');
    expect(describeStep(1, 'intro')).toBe('step 1 ("intro")');
  });
});
