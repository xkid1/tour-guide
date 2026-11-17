import type { Placement, ResolvedPlacement } from '../placement/placement';

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Input of `computePosition()`. */
export interface PositionInput {
  /** Spotlight rect in viewport coordinates, or `null` to centre. */
  target: Rect | null;
  popover: Size;
  viewport: Size;
  placement: Placement;
  offset: number;
  margin: number;
}

/** Output of `computePosition()`. */
export interface PositionResult {
  top: number;
  left: number;
  placement: ResolvedPlacement;
  /** Arrow offset along the popover edge facing the target; `null` hides the arrow. */
  arrow: { top: number } | { left: number } | null;
}
