import type { ResolvedTourOptions } from '../options/options';
import type { StepContext } from '../step/step';

/** UI actions the `TourRenderer` forwards to `<tour-guide>`. */
export interface RendererHandlers {
  onClose: () => void;
  onBack: () => void;
  onSkip: () => void;
  onPrimary: () => void;
  onBackdropClick: () => void;
  /** A step `content()` function threw; the body renders empty. */
  onContentError?: (error: unknown) => void;
}

/** Everything the `TourRenderer` needs to draw one step. */
export interface RenderState {
  context: StepContext;
  isFirst: boolean;
  isLast: boolean;
  options: ResolvedTourOptions;
}
