/** Preferred side of the target where the popover is placed. */
export type Placement = 'auto' | 'top' | 'bottom' | 'left' | 'right' | 'center';

/** Placement after auto/flip resolution. */
export type ResolvedPlacement = Exclude<Placement, 'auto'>;
