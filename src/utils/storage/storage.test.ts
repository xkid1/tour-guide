import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearProgress,
  readProgress,
  resolveProgressIndex,
  writeProgress,
} from './storage';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('tour progress storage', () => {
  it('round-trips the saved position under a prefixed key', () => {
    writeProgress('onboarding', { index: 3, stepId: 'team' });
    expect(localStorage.getItem('tour-guide:onboarding')).toBe(
      '{"index":3,"stepId":"team"}',
    );
    expect(readProgress('onboarding')).toEqual({ index: 3, stepId: 'team' });
    writeProgress('plain', { index: 1 });
    expect(readProgress('plain')).toEqual({ index: 1 });
    clearProgress('onboarding');
    expect(readProgress('onboarding')).toBeNull();
  });

  it('ignores an empty key', () => {
    writeProgress('', { index: 2 });
    clearProgress('');
    expect(localStorage.length).toBe(0);
    expect(readProgress('')).toBeNull();
  });

  it('rejects corrupt or invalid data', () => {
    for (const raw of [
      'not json',
      'null',
      '"x"',
      '{"index":-1}',
      '{"index":1.5}',
      '{}',
    ]) {
      localStorage.setItem('tour-guide:bad', raw);
      expect(readProgress('bad')).toBeNull();
    }
  });

  it('never throws when storage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => {
      writeProgress('k', { index: 1 });
      clearProgress('k');
    }).not.toThrow();
    expect(readProgress('k')).toBeNull();

    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    vi.stubGlobal('localStorage', throwing);
    expect(() => {
      writeProgress('k', { index: 1 });
      clearProgress('k');
    }).not.toThrow();
    expect(readProgress('k')).toBeNull();
  });

  it('resolves the index by step id first, then by index when in range', () => {
    const steps = [{ id: 'a' }, { id: 'b' }, {}];
    expect(resolveProgressIndex(null, steps)).toBeNull();
    expect(resolveProgressIndex({ index: 0, stepId: 'b' }, steps)).toBe(1);
    expect(resolveProgressIndex({ index: 2, stepId: 'gone' }, steps)).toBe(2);
    expect(resolveProgressIndex({ index: 5 }, steps)).toBeNull();
  });
});
