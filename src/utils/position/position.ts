import type {
  MobilePlacement,
  Placement,
  PositionInput,
  PositionResult,
  Rect,
  ResolvedPlacement,
  Size,
} from '@types';

type Side = Exclude<ResolvedPlacement, 'center'>;

const SIDES: readonly Side[] = ['bottom', 'top', 'right', 'left'];
const OPPOSITE: Record<Side, Side> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};
const ARROW_INSET = 16;

export function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

/** Converts a DOMRect-like object into a plain Rect. */
export function toRect(rect: {
  top: number;
  left: number;
  width: number;
  height: number;
}): Rect {
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

export function padRect(rect: Rect, padding: number): Rect {
  return {
    top: rect.top - padding,
    left: rect.left - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

export function isMobileViewport(width: number, breakpoint: number): boolean {
  return width < breakpoint;
}

/**
 * Edge a mobile sheet docks to. With `auto`, a target whose centre is in the lower half of the
 * viewport gets a top sheet so the sheet does not cover it.
 */
export function resolveSheetEdge(
  target: Rect | null,
  viewportHeight: number,
  preference: MobilePlacement,
): 'top' | 'bottom' {
  if (preference === 'top' || preference === 'bottom') return preference;
  if (!target) return 'bottom';
  return target.top + target.height / 2 > viewportHeight / 2 ? 'top' : 'bottom';
}

function center(input: PositionInput): PositionResult {
  const { popover, viewport, margin } = input;
  return {
    top: clamp(
      (viewport.height - popover.height) / 2,
      margin,
      viewport.height - popover.height - margin,
    ),
    left: clamp(
      (viewport.width - popover.width) / 2,
      margin,
      viewport.width - popover.width - margin,
    ),
    placement: 'center',
    arrow: null,
  };
}

function availableSpace(
  target: Rect,
  viewport: Size,
  margin: number,
): Record<Side, number> {
  return {
    top: target.top - margin,
    bottom: viewport.height - (target.top + target.height) - margin,
    left: target.left - margin,
    right: viewport.width - (target.left + target.width) - margin,
  };
}

function candidateOrder(preferred: Placement, space: Record<Side, number>): Side[] {
  if (preferred === 'auto' || preferred === 'center') {
    return [...SIDES].sort((a, b) => space[b] - space[a]);
  }
  const rest = SIDES.filter((side) => side !== preferred && side !== OPPOSITE[preferred]);
  return [preferred, OPPOSITE[preferred], ...rest];
}

/**
 * Pure positioning algorithm: picks a side that fits (preferred → opposite → others),
 * then clamps the popover inside the viewport and computes the arrow offset.
 */
export function computePosition(input: PositionInput): PositionResult {
  const { target, popover, viewport, offset, margin } = input;
  if (!target || input.placement === 'center') return center(input);

  const space = availableSpace(target, viewport, margin);
  const required: Record<Side, number> = {
    top: popover.height + offset,
    bottom: popover.height + offset,
    left: popover.width + offset,
    right: popover.width + offset,
  };
  const order = candidateOrder(input.placement, space);
  const fallback =
    [...SIDES].sort((a, b) => space[b] - required[b] - (space[a] - required[a]))[0] ??
    'bottom';
  const side =
    order.find((candidate) => space[candidate] >= required[candidate]) ?? fallback;

  const targetCenterX = target.left + target.width / 2;
  const targetCenterY = target.top + target.height / 2;
  let top: number;
  let left: number;

  switch (side) {
    case 'top':
      top = target.top - offset - popover.height;
      left = targetCenterX - popover.width / 2;
      break;
    case 'bottom':
      top = target.top + target.height + offset;
      left = targetCenterX - popover.width / 2;
      break;
    case 'left':
      top = targetCenterY - popover.height / 2;
      left = target.left - offset - popover.width;
      break;
    case 'right':
      top = targetCenterY - popover.height / 2;
      left = target.left + target.width + offset;
      break;
  }

  top = clamp(top, margin, viewport.height - popover.height - margin);
  left = clamp(left, margin, viewport.width - popover.width - margin);

  const arrow =
    side === 'top' || side === 'bottom'
      ? { left: clamp(targetCenterX - left, ARROW_INSET, popover.width - ARROW_INSET) }
      : { top: clamp(targetCenterY - top, ARROW_INSET, popover.height - ARROW_INSET) };

  return { top, left, placement: side, arrow };
}

/**
 * Mobile `follow` layout: a screen-wide popover goes above or below the target (never beside
 * it, there is no room). Prefers the step's `top`/`bottom` placement, otherwise the roomier
 * side. Returns `null` when neither side fits, so the caller can fall back to a sheet.
 */
export function computeMobilePosition(input: PositionInput): PositionResult | null {
  const { target, popover, viewport, offset, margin } = input;
  if (!target || input.placement === 'center') return center(input);
  const space = availableSpace(target, viewport, margin);
  const required = popover.height + offset;
  const roomier: Side = space.bottom >= space.top ? 'bottom' : 'top';
  const preferred: Side =
    input.placement === 'top' || input.placement === 'bottom' ? input.placement : roomier;
  const side = [preferred, OPPOSITE[preferred]].find((s) => space[s] >= required);
  return side ? computePosition({ ...input, placement: side }) : null;
}
