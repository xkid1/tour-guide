/**
 * Development-time validation of `steps` and `options`. Never throws: it returns a list of
 * `TourGuideError`s that `<tour-guide>` logs as warnings, so typos and wrong types are caught
 * early without breaking production.
 */
import type { TourOptions, TourStep } from '@types';
import { TourGuideError, describeStep, didYouMean } from '@utils';

import { DEFAULT_LABELS, DEFAULT_OPTIONS } from '../defaults/defaults';

const PLACEMENTS = ['auto', 'top', 'bottom', 'left', 'right', 'center'] as const;
const ENUM_OPTIONS: Partial<Record<keyof TourOptions, readonly string[]>> = {
  placement: PLACEMENTS,
  scrollBehavior: ['auto', 'smooth', 'instant'],
  missingTarget: ['center', 'skip'],
  mobilePlacement: ['follow', 'auto', 'top', 'bottom'],
};
const OPTION_KEYS = Object.keys(DEFAULT_OPTIONS);
const LABEL_KEYS = Object.keys(DEFAULT_LABELS);
const ICON_KEYS = ['close', 'back'];

const STEP_FIELDS: Record<
  keyof TourStep,
  'string' | 'boolean' | 'number' | 'function' | 'any'
> = {
  id: 'string',
  target: 'any',
  title: 'string',
  content: 'any',
  allowHtml: 'boolean',
  placement: 'string',
  showBack: 'boolean',
  showSkip: 'boolean',
  showClose: 'boolean',
  spotlightPadding: 'number',
  scrollIntoView: 'boolean',
  allowTargetInteraction: 'boolean',
  beforeShow: 'function',
  afterShow: 'function',
  beforeLeave: 'function',
  data: 'any',
};
const STEP_KEYS = Object.keys(STEP_FIELDS);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function isNode(value: unknown): boolean {
  return typeof Node !== 'undefined' && value instanceof Node;
}

/** True when `selector` parses as CSS. Without a DOM (SSR) every selector is accepted. */
export function isValidSelector(selector: string): boolean {
  if (typeof document === 'undefined') return true;
  try {
    document.createDocumentFragment().querySelector(selector);
    return true;
  } catch {
    return false;
  }
}

function checkEnum(
  value: unknown,
  allowed: readonly string[],
  what: string,
): string | undefined {
  if (typeof value === 'string' && allowed.includes(value)) return undefined;
  const hint = typeof value === 'string' ? didYouMean(value, allowed) : '';
  const list = allowed.map((v) => `"${v}"`).join(', ');
  return `${what} must be one of ${list}, got ${JSON.stringify(value)}.${hint}`;
}

// ------------------------------------------------------------------------------- steps

function validateTarget(
  step: Record<string, unknown>,
  where: string,
): string | undefined {
  const { target } = step;
  if (target === undefined) return undefined;
  if (typeof target === 'string') {
    if (target.trim() === '')
      return `${where}: "target" is an empty string. Remove it to centre the step.`;
    if (!isValidSelector(target))
      return `${where}: "target" ${JSON.stringify(target)} is not a valid CSS selector.`;
    return undefined;
  }
  if (typeof target === 'function') return undefined;
  if (typeof Element !== 'undefined' && target instanceof Element) return undefined;
  return `${where}: "target" must be a CSS selector, an Element or a function returning one, got ${typeOf(target)}.`;
}

function validateContent(
  step: Record<string, unknown>,
  where: string,
): string | undefined {
  const { content } = step;
  if (
    content === undefined ||
    typeof content === 'string' ||
    typeof content === 'function'
  )
    return undefined;
  if (isNode(content)) return undefined;
  return `${where}: "content" must be a string, a Node or a function returning one, got ${typeOf(content)}.`;
}

function validateStepFields(step: Record<string, unknown>, where: string): string[] {
  const problems: string[] = [];
  for (const [key, value] of Object.entries(step)) {
    if (!Object.hasOwn(STEP_FIELDS, key)) {
      problems.push(`${where}: unknown field "${key}".${didYouMean(key, STEP_KEYS)}`);
      continue;
    }
    const expected = STEP_FIELDS[key as keyof TourStep];
    if (value === undefined || expected === 'any') continue;
    if (typeof value !== expected) {
      problems.push(`${where}: "${key}" must be a ${expected}, got ${typeOf(value)}.`);
    }
  }
  if (typeof step.placement === 'string') {
    const message = checkEnum(step.placement, PLACEMENTS, `${where}: "placement"`);
    if (message) problems.push(message);
  }
  if (
    typeof step.spotlightPadding === 'number' &&
    !Number.isFinite(step.spotlightPadding)
  ) {
    problems.push(`${where}: "spotlightPadding" must be a finite number.`);
  }
  return problems;
}

/** Returns one error per problem found in `steps` (empty when everything looks right). */
export function validateSteps(steps: unknown): TourGuideError[] {
  if (!Array.isArray(steps)) {
    return [
      new TourGuideError(
        'INVALID_STEPS',
        `"steps" must be an array, got ${typeOf(steps)}.`,
      ),
    ];
  }
  const errors: TourGuideError[] = [];
  const seenIds = new Map<string, number>();

  steps.forEach((step: unknown, index) => {
    if (!isPlainObject(step)) {
      errors.push(
        new TourGuideError(
          'INVALID_STEPS',
          `${describeStep(index)} must be an object, got ${typeOf(step)}.`,
          {
            stepIndex: index,
          },
        ),
      );
      return;
    }
    const id = typeof step.id === 'string' ? step.id : undefined;
    const init = { stepIndex: index, ...(id ? { stepId: id } : {}) };
    const where = describeStep(index, id);

    if (id !== undefined) {
      const first = seenIds.get(id);
      if (first === undefined) seenIds.set(id, index);
      else
        errors.push(
          new TourGuideError(
            'DUPLICATE_STEP_ID',
            `${where} reuses the id of ${describeStep(first)}. Ids must be unique because they name the slot "step-${id}".`,
            init,
          ),
        );
    }
    const targetProblem = validateTarget(step, where);
    if (targetProblem) {
      const code =
        typeof step.target === 'string' && step.target.trim() !== ''
          ? 'INVALID_SELECTOR'
          : 'INVALID_STEP';
      errors.push(new TourGuideError(code, targetProblem, init));
    }
    const contentProblem = validateContent(step, where);
    if (contentProblem)
      errors.push(new TourGuideError('INVALID_STEP', contentProblem, init));
    for (const problem of validateStepFields(step, where)) {
      errors.push(new TourGuideError('INVALID_STEP', problem, init));
    }
  });
  return errors;
}

// ----------------------------------------------------------------------------- options

function validateNested(
  value: unknown,
  name: 'labels' | 'icons',
  keys: readonly string[],
): TourGuideError[] {
  if (value === undefined) return [];
  if (!isPlainObject(value)) {
    return [
      new TourGuideError(
        'INVALID_OPTION',
        `"${name}" must be an object, got ${typeOf(value)}.`,
        { option: name },
      ),
    ];
  }
  const errors: TourGuideError[] = [];
  for (const [key, entry] of Object.entries(value)) {
    const option = `${name}.${key}`;
    if (!keys.includes(key)) {
      errors.push(
        new TourGuideError(
          'UNKNOWN_OPTION',
          `Unknown option "${option}".${didYouMean(key, keys)}`,
          { option },
        ),
      );
      continue;
    }
    const expected = key === 'progress' ? 'function' : 'string';
    if (entry !== undefined && typeof entry !== expected) {
      errors.push(
        new TourGuideError(
          'INVALID_OPTION',
          `"${option}" must be a ${expected}, got ${typeOf(entry)}.`,
          { option },
        ),
      );
    }
  }
  return errors;
}

function validateOptionValue(key: keyof TourOptions, value: unknown): string | undefined {
  const allowed = ENUM_OPTIONS[key];
  if (allowed) return checkEnum(value, allowed, `"${key}"`);

  const expected = typeof DEFAULT_OPTIONS[key];
  if (typeof value !== expected)
    return `"${key}" must be a ${expected}, got ${typeOf(value)}.`;
  if (typeof value === 'number' && (!Number.isFinite(value) || value < 0)) {
    return `"${key}" must be a finite number ≥ 0, got ${String(value)}.`;
  }
  return undefined;
}

/** Returns one error per unknown or mistyped option (empty when everything looks right). */
export function validateOptions(options: unknown): TourGuideError[] {
  if (options === undefined || options === null) return [];
  if (!isPlainObject(options)) {
    return [
      new TourGuideError(
        'INVALID_OPTION',
        `"options" must be an object, got ${typeOf(options)}.`,
      ),
    ];
  }
  const errors: TourGuideError[] = [];
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined) continue;
    if (key === 'labels') errors.push(...validateNested(value, 'labels', LABEL_KEYS));
    else if (key === 'icons') errors.push(...validateNested(value, 'icons', ICON_KEYS));
    else if (!OPTION_KEYS.includes(key)) {
      errors.push(
        new TourGuideError(
          'UNKNOWN_OPTION',
          `Unknown option "${key}".${didYouMean(key, OPTION_KEYS)}`,
          {
            option: key,
          },
        ),
      );
    } else {
      const problem = validateOptionValue(key as keyof TourOptions, value);
      if (problem)
        errors.push(new TourGuideError('INVALID_OPTION', problem, { option: key }));
    }
  }
  return errors;
}

/** Validates a requested step index against the number of steps. */
export function validateIndex(
  index: unknown,
  total: number,
  method: string,
): TourGuideError | null {
  if (total === 0) {
    return new TourGuideError(
      'NO_STEPS',
      `${method}() was called but the tour has no steps. Set "steps" or add <tour-step> children first.`,
    );
  }
  if (typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < total)
    return null;
  return new TourGuideError(
    'INVALID_INDEX',
    `${method}(${JSON.stringify(index)}) is out of range. Use an integer from 0 to ${total - 1}.`,
    typeof index === 'number' ? { stepIndex: index } : {},
  );
}
