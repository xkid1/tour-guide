import { describe, expect, it } from 'vitest';

import { resolveOptions } from './defaults';

describe('resolveOptions', () => {
  it('merges layers and ignores undefined', () => {
    const resolved = resolveOptions(
      { offset: 4, labels: { next: 'Go' } },
      { offset: undefined, labels: { skip: 'Later' } },
    );
    expect(resolved.offset).toBe(4);
    expect(resolved.labels.next).toBe('Go');
    expect(resolved.labels.skip).toBe('Later');
    expect(resolved.labels.back).toBe('Back');
  });
});
