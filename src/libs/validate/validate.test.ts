import { describe, expect, it } from 'vitest';

import {
  isValidSelector,
  validateIndex,
  validateOptions,
  validateSteps,
} from './validate';

const codes = (errors: { code: string }[]) => errors.map((error) => error.code);

describe('validateSteps', () => {
  it('accepts a well-formed tour', () => {
    const target = document.createElement('div');
    expect(
      validateSteps([
        { id: 'a', target: '#a', title: 'A', content: 'text', placement: 'top' },
        { target, content: document.createElement('p'), beforeShow: () => undefined },
        { target: () => null, content: () => 'fn', data: { any: 1 } },
      ]),
    ).toEqual([]);
  });

  it('rejects non-arrays and non-object steps', () => {
    expect(codes(validateSteps('nope'))).toEqual(['INVALID_STEPS']);
    expect(validateSteps('nope')[0]?.message).toContain('got string');
    const [error] = validateSteps([null]);
    expect(error?.code).toBe('INVALID_STEPS');
    expect(error?.stepIndex).toBe(0);
  });

  it('reports duplicate ids with both positions', () => {
    const [error] = validateSteps([{ id: 'x' }, { id: 'y' }, { id: 'x' }]);
    expect(error?.code).toBe('DUPLICATE_STEP_ID');
    expect(error?.message).toContain('step 2 ("x") reuses the id of step 0');
    expect(error?.stepId).toBe('x');
  });

  it('reports invalid selectors and target types', () => {
    expect(codes(validateSteps([{ target: '##bad' }]))).toEqual(['INVALID_SELECTOR']);
    expect(codes(validateSteps([{ target: '  ' }]))).toEqual(['INVALID_STEP']);
    expect(validateSteps([{ target: 42 } as never])[0]?.message).toContain('got number');
  });

  it('reports bad content, field types, placements and typos', () => {
    const messages = validateSteps([
      { content: 42 } as never,
      { title: 7 } as never,
      { placement: 'botom' } as never,
      { titel: 'Hi' } as never,
      { spotlightPadding: Number.NaN },
    ]).map((error) => error.message);
    expect(messages).toEqual([
      expect.stringContaining('"content" must be a string, a Node or a function'),
      expect.stringContaining('"title" must be a string, got number'),
      expect.stringContaining('Did you mean "bottom"?'),
      expect.stringContaining('unknown field "titel". Did you mean "title"?'),
      expect.stringContaining('"spotlightPadding" must be a finite number'),
    ]);
  });
});

describe('validateOptions', () => {
  it('accepts valid options and nothing at all', () => {
    expect(validateOptions(undefined)).toEqual([]);
    expect(validateOptions(null)).toEqual([]);
    expect(
      validateOptions({
        backdrop: false,
        placement: 'left',
        offset: 0,
        labels: { next: 'Weiter', progress: (a: number, b: number) => `${a}/${b}` },
        icons: { close: '<svg></svg>' },
        mobilePlacement: 'top',
        ariaLabel: undefined,
      }),
    ).toEqual([]);
  });

  it('suggests the right name for typos', () => {
    const [error] = validateOptions({ clsoeOnEsc: false });
    expect(error?.code).toBe('UNKNOWN_OPTION');
    expect(error?.option).toBe('clsoeOnEsc');
    expect(error?.message).toBe(
      'Unknown option "clsoeOnEsc". Did you mean "closeOnEsc"?',
    );
  });

  it('reports wrong types, enum values and negative numbers', () => {
    const messages = validateOptions({
      backdrop: 'yes',
      placement: 'middle',
      offset: -4,
      scrollBehavior: 'fast',
    }).map((error) => error.message);
    expect(messages).toEqual([
      '"backdrop" must be a boolean, got string.',
      expect.stringContaining('"placement" must be one of'),
      '"offset" must be a finite number ≥ 0, got -4.',
      expect.stringContaining('"scrollBehavior" must be one of'),
    ]);
  });

  it('checks labels and icons', () => {
    const errors = validateOptions({
      labels: { nxt: 'Go', progress: 'x', back: 1 },
      icons: 'svg',
    });
    expect(errors.map((error) => [error.code, error.option])).toEqual([
      ['UNKNOWN_OPTION', 'labels.nxt'],
      ['INVALID_OPTION', 'labels.progress'],
      ['INVALID_OPTION', 'labels.back'],
      ['INVALID_OPTION', 'icons'],
    ]);
    expect(errors[0]?.message).toContain('Did you mean "next"?');
    expect(codes(validateOptions({ icons: { arrow: '' } }))).toEqual(['UNKNOWN_OPTION']);
    expect(codes(validateOptions([]))).toEqual(['INVALID_OPTION']);
  });
});

describe('validateIndex', () => {
  it('accepts in-range integers', () => {
    expect(validateIndex(0, 3, 'goTo')).toBeNull();
    expect(validateIndex(2, 3, 'goTo')).toBeNull();
  });

  it('explains empty tours and bad indexes', () => {
    expect(validateIndex(0, 0, 'start')?.code).toBe('NO_STEPS');
    const error = validateIndex(5, 3, 'goTo');
    expect(error?.code).toBe('INVALID_INDEX');
    expect(error?.message).toBe('goTo(5) is out of range. Use an integer from 0 to 2.');
    expect(validateIndex(1.5, 3, 'goTo')?.code).toBe('INVALID_INDEX');
    expect(validateIndex('1', 3, 'goTo')?.stepIndex).toBeUndefined();
  });
});

describe('isValidSelector', () => {
  it('parses CSS selectors', () => {
    expect(isValidSelector('#a > .b[data-x="1"]')).toBe(true);
    expect(isValidSelector('[unclosed')).toBe(false);
  });
});
