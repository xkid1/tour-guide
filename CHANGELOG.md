# Changelog

All notable changes to this project are documented here. This project follows [Semantic Versioning](https://semver.org).

## 0.1.0

First public release.

- `<tour-guide>` custom element with header (title + close), footer (back icon, skip, next/complete), spotlight, responsive bottom sheet, focus trap, keyboard navigation, theming via CSS variables / parts / slots, declarative `<tour-step>` children.
- Adapters: browser (`createTour`), React, Vue, Angular, Android / React Native WebView guide.
- Builds: ESM + d.ts, IIFE/ES single-file bundles, Custom Elements Manifest.

### Added

- `tour-error` event and `TourGuideError` (stable `code`, `phase`, `stepIndex`, `stepId`, `cause`). Hooks, `content()` and `target()` that throw no longer break the tour.
- Development warnings for unknown/mistyped options and step fields (with "did you mean" hints), duplicate step ids, invalid selectors, missing targets and out-of-range indexes. `validateSteps()`, `validateOptions()`, `isTourGuideError()` and `setLogLevel()` are exported.
- `mobilePlacement` option / `mobile-placement` attribute: the mobile sheet docks to the top when the target is in the lower half of the screen (`auto`, default), or to a fixed edge.
- Attributes for `offset`, `viewport-margin`, `spotlight-padding`, `missing-target`, `scroll-behavior`, `allow-html`, `scroll-into-view`, `restore-focus`. `<tour-step>` accepts `show-back`, `show-skip`, `show-close`, `scroll-into-view`.
- Svelte adapter (`@xkid1/tour-guide/svelte`): a zero-dependency `use:tourGuide` action for Svelte 3–5 / SvelteKit, plus `createSvelteTourGuide()` controls.
- Animations: enter and exit animations, a direction-aware content slide on Next / Back, and the popover and spotlight glide between targets. Tunable with the new `--tg-animation-duration` and `--tg-easing` CSS variables. Disabled under `prefers-reduced-motion`.
- `allowTargetInteraction` option (default `true`), `allow-target-interaction` attribute and step field: the highlighted target stays clickable through the spotlight (e.g. to open a menu or modal mid-tour) while the rest of the page stays blocked.
- `mobilePlacement: 'follow'` (new default): on small screens the popover stays next to its target as a screen-wide card (minus `viewportMargin`) with its arrow, above or below the target. It docks as a sheet only when neither side has room. Use `auto` / `top` / `bottom` for the previous sheet layout.
- `@xkid1/tour-guide/resume` entry (opt-in): `enableResume(element, { key, on, autoStart })` saves the step where the tour was skipped or closed in `localStorage` and resumes there on the next visit. Completing the tour clears it.
- Off-screen targets (e.g. in the footer) scroll into view smoothly. The popover is hidden while the page scrolls and animates in once scrolling settles. Smooth scrolling becomes instant under `prefers-reduced-motion`.
- `@xkid1/tour-guide/electron` and `@xkid1/tour-guide/android` entries. `connectNativeBridge()` (also `TourGuide.connectNativeBridge` in the IIFE) for React Native, Android and iOS WebViews.

### Fixed

- Works under a strict CSP (`style-src 'self'`, no `'unsafe-inline'`) without violation reports: an empty inline `<style>` was always added to the shadow root. CSS from the `styles` option now also goes through a constructable stylesheet, created only when there is CSS. Older WebViews without constructable stylesheets still fall back to `<style>`.
- Cancelling or failing the first step (via `tour-before-change` or a hook) left an empty overlay and listeners behind. `tour-start` now fires only once the first step is accepted.
- The logger crashed in browsers and WebViews (it read `process` unguarded).
- The popover could be clamped underneath a classic scrollbar. The viewport size now excludes it.
- The spotlight no longer lags behind its target while the page scrolls (its position transition now runs only during step changes).
- Repositions on `visualViewport` changes (on-screen keyboard, pinch zoom). Popover height uses `dvh` where supported. Sheets respect all safe-area insets.
