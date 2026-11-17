/**
 * `@libs` barrel: the public surface of the component layer.
 * Layer-internal modules (tour-renderer, applyStyles, attributes) are imported relatively
 * inside libs/ only.
 */
export {
  DEFAULT_ICONS,
  DEFAULT_LABELS,
  DEFAULT_OPTIONS,
  DEFAULT_TAG_NAME,
  resolveOptions,
} from './defaults/defaults';
export { TOUR_STYLES } from './styles/styles';
export { TourGuideElement, defineTourGuide } from './tour-element/tour-element';
export { TourManager } from './tour-manager/tour-manager';
export { validateOptions, validateSteps } from './validate/validate';
