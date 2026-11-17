import { describe, expect, it } from 'vitest';

import { uid } from './id';

describe('uid', () => {
  it('is unique', () => {
    expect(uid()).not.toBe(uid());
    expect(uid('x')).toMatch(/^x-/);
  });
});
