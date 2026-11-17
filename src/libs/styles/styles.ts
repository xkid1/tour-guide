/** Dark palette, shared by `theme="dark"` and `theme="auto"` (when the OS is dark). */
const DARK_TOKENS = /* css */ `
  --tg-popover-bg: #0f172a;
  --tg-popover-color: #e2e8f0;
  --tg-muted-color: #94a3b8;
  --tg-secondary-color: #cbd5e1;
  --tg-secondary-hover-bg: #1e293b;
  --tg-primary: #3b82f6;
  --tg-primary-hover: #60a5fa;
  --tg-backdrop-color: rgb(0 0 0 / 0.7);
`;

/**
 * Shadow-DOM styles. Everything is themable through `--tg-*` custom properties
 * (set them on `tour-guide` or any ancestor) and every piece exposes a `part`.
 */
export const TOUR_STYLES = /* css */ `
:host {
  --tg-z-index: 2147483000;
  --tg-font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --tg-font-size: 14px;
  --tg-line-height: 1.5;
  --tg-backdrop-color: rgb(15 23 42 / 0.6);
  --tg-popover-bg: #ffffff;
  --tg-popover-color: #1e293b;
  --tg-muted-color: #64748b;
  --tg-popover-radius: 12px;
  --tg-popover-width: 360px;
  --tg-popover-max-width: calc(100vw - 24px);
  --tg-popover-padding: 16px;
  --tg-popover-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.15), 0 8px 10px -6px rgb(0 0 0 / 0.1);
  --tg-title-size: 16px;
  --tg-title-weight: 600;
  --tg-primary: #2563eb;
  --tg-primary-hover: #1d4ed8;
  --tg-primary-contrast: #ffffff;
  --tg-secondary-color: #475569;
  --tg-secondary-hover-bg: #f1f5f9;
  --tg-button-radius: 8px;
  --tg-focus-ring: 0 0 0 3px rgb(37 99 235 / 0.45);
  --tg-spotlight-radius: 8px;
  --tg-spotlight-ring: 0 0 0 2px rgb(255 255 255 / 0.85);
  --tg-transition-duration: 200ms;
  --tg-animation-duration: 280ms;
  --tg-easing: cubic-bezier(0.22, 1, 0.36, 1);
  --tg-arrow-size: 12px;
  --tg-mobile-max-height: 70vh;
  display: contents;
}

:host([theme="dark"]) {
  ${DARK_TOKENS}
}

@media (prefers-color-scheme: dark) {
  :host([theme="auto"]) {
    ${DARK_TOKENS}
  }
}

[hidden] { display: none !important; }

.root {
  position: fixed;
  inset: 0;
  z-index: var(--tg-z-index);
  pointer-events: none;
  font-family: var(--tg-font-family);
  font-size: var(--tg-font-size);
  line-height: var(--tg-line-height);
  -webkit-tap-highlight-color: transparent;
}

.backdrop {
  position: fixed;
  inset: 0;
  pointer-events: auto;
  background: transparent;
  transition: background-color var(--tg-transition-duration) ease;
  animation: tg-fade-in var(--tg-animation-duration) ease backwards;
}
.root.no-target .backdrop { background: var(--tg-backdrop-color); }
.root.no-backdrop .backdrop { background: transparent; }
.root.allow-interaction .backdrop { pointer-events: none; }

.spotlight {
  position: fixed;
  border-radius: var(--tg-spotlight-radius);
  box-shadow: var(--tg-spotlight-ring), 0 0 0 200vmax var(--tg-backdrop-color);
  pointer-events: none;
  animation: tg-fade-in var(--tg-animation-duration) ease backwards;
}
.root.no-backdrop .spotlight { box-shadow: var(--tg-spotlight-ring); }

.popover {
  position: fixed;
  top: 0;
  left: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: var(--tg-popover-width);
  max-width: var(--tg-popover-max-width);
  max-height: calc(100vh - 24px);
  max-height: calc(100dvh - 24px);
  background: var(--tg-popover-bg);
  color: var(--tg-popover-color);
  border-radius: var(--tg-popover-radius);
  box-shadow: var(--tg-popover-shadow);
  pointer-events: auto;
  outline: none;
  /* Where the popover slides in from; set per placement below. */
  --tg-enter-x: 0px;
  --tg-enter-y: 0px;
  --tg-enter-scale: 0.96;
  animation: tg-popover-in var(--tg-animation-duration) var(--tg-easing) backwards;
}
.popover[data-placement="top"] { --tg-enter-y: 8px; }
.popover[data-placement="bottom"] { --tg-enter-y: -8px; }
.popover[data-placement="left"] { --tg-enter-x: 8px; }
.popover[data-placement="right"] { --tg-enter-x: -8px; }

.arrow {
  position: absolute;
  z-index: -1;
  width: var(--tg-arrow-size);
  height: var(--tg-arrow-size);
  background: var(--tg-popover-bg);
  transform: rotate(45deg);
}
.popover[data-placement="top"] .arrow { bottom: calc(var(--tg-arrow-size) / -2); margin-left: calc(var(--tg-arrow-size) / -2); }
.popover[data-placement="bottom"] .arrow { top: calc(var(--tg-arrow-size) / -2); margin-left: calc(var(--tg-arrow-size) / -2); }
.popover[data-placement="left"] .arrow { right: calc(var(--tg-arrow-size) / -2); margin-top: calc(var(--tg-arrow-size) / -2); }
.popover[data-placement="right"] .arrow { left: calc(var(--tg-arrow-size) / -2); margin-top: calc(var(--tg-arrow-size) / -2); }
.popover[data-placement="center"] .arrow,
.popover.is-mobile .arrow { display: none; }

.header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: var(--tg-popover-padding) var(--tg-popover-padding) 0;
}
.title {
  flex: 1;
  margin: 0;
  font-size: var(--tg-title-size);
  font-weight: var(--tg-title-weight);
  line-height: 1.3;
  padding-top: 5px;
}
.header-spacer { flex: 1; }

.body {
  padding: 8px var(--tg-popover-padding) 0;
  overflow: auto;
  overflow-wrap: anywhere;
}
.body:empty { display: none; }

.footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: var(--tg-popover-padding);
}
.progress { color: var(--tg-muted-color); font-size: 0.857em; }
.actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }

button {
  font: inherit;
  cursor: pointer;
  border: 0;
  margin: 0;
  -webkit-appearance: none;
  appearance: none;
  transition: background-color var(--tg-transition-duration) ease, color var(--tg-transition-duration) ease;
}
button:focus-visible { outline: none; box-shadow: var(--tg-focus-ring); }

.icon-button {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: var(--tg-button-radius);
  background: transparent;
  color: var(--tg-secondary-color);
}
.icon-button:hover { background: var(--tg-secondary-hover-bg); }
.icon-button svg { width: 18px; height: 18px; }

.button {
  min-height: 36px;
  padding: 8px 14px;
  border-radius: var(--tg-button-radius);
  font-weight: 500;
  line-height: 1.2;
}
.button-secondary { background: transparent; color: var(--tg-secondary-color); }
.button-secondary:hover { background: var(--tg-secondary-hover-bg); }
.button-primary { background: var(--tg-primary); color: var(--tg-primary-contrast); }
.button-primary:hover { background: var(--tg-primary-hover); }

/* Responsive: full-width sheet docked to the bottom (default) or top edge on small screens */
.popover.is-mobile {
  top: auto !important;
  left: 0 !important;
  right: 0;
  bottom: 0;
  width: 100%;
  max-width: 100%;
  max-height: var(--tg-mobile-max-height);
  border-radius: var(--tg-popover-radius) var(--tg-popover-radius) 0 0;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
}
.popover.is-mobile[data-placement="top-sheet"] {
  top: 0 !important;
  bottom: auto;
  border-radius: 0 0 var(--tg-popover-radius) var(--tg-popover-radius);
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: 0;
}
.popover.is-mobile .body { overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
.popover.is-mobile .button,
.popover.is-mobile .icon-button,
.popover.is-compact .button,
.popover.is-compact .icon-button { min-height: 44px; min-width: 44px; }
.popover.is-compact { max-height: calc(100vh - 2 * var(--tg-arrow-size) - 24px); max-height: calc(100dvh - 2 * var(--tg-arrow-size) - 24px); }

/* ---- Motion ------------------------------------------------------------------ */

@keyframes tg-fade-in { from { opacity: 0; } }
@keyframes tg-fade-out { to { opacity: 0; } }
@keyframes tg-popover-in {
  from {
    opacity: 0;
    transform: translate(var(--tg-enter-x), var(--tg-enter-y)) scale(var(--tg-enter-scale));
  }
}
@keyframes tg-popover-out {
  to {
    opacity: 0;
    transform: translate(var(--tg-enter-x), var(--tg-enter-y)) scale(var(--tg-enter-scale));
  }
}
@keyframes tg-step-in {
  from { opacity: 0; transform: translateX(var(--tg-step-x)); }
}

.popover.is-mobile { --tg-enter-x: 0px; --tg-enter-y: 100%; --tg-enter-scale: 1; }
.popover.is-mobile[data-placement="top-sheet"] { --tg-enter-y: -100%; }

/* Next / Back: the content slides in from the side it travels to */
.popover[data-direction="next"] { --tg-step-x: 16px; }
.popover[data-direction="back"] { --tg-step-x: -16px; }
.popover.is-stepping > :not(.arrow) {
  animation: tg-step-in var(--tg-animation-duration) var(--tg-easing) backwards;
}

/* Glide between targets during a step change (not while following scroll/resize) */
.root.is-moving .spotlight {
  transition: top var(--tg-animation-duration) var(--tg-easing),
    left var(--tg-animation-duration) var(--tg-easing),
    width var(--tg-animation-duration) var(--tg-easing),
    height var(--tg-animation-duration) var(--tg-easing);
}
.root.is-moving .popover {
  transition: top var(--tg-animation-duration) var(--tg-easing),
    left var(--tg-animation-duration) var(--tg-easing);
}
.root.is-moving .arrow {
  transition: top var(--tg-animation-duration) var(--tg-easing),
    left var(--tg-animation-duration) var(--tg-easing);
}

/* Page is scrolling to the target: hide the popover, it animates in once settled */
.root.is-scrolling .popover,
.root.is-scrolling .popover > * {
  animation: none;
}
.root.is-scrolling .popover { opacity: 0; pointer-events: none; }

/* Closing: play the exit animation, let clicks reach the page meanwhile */
.root.is-closing,
.root.is-closing * { pointer-events: none !important; }
.root.is-closing .backdrop,
.root.is-closing .spotlight {
  animation: tg-fade-out var(--tg-animation-duration) ease forwards;
}
.root.is-closing .popover {
  animation: tg-popover-out calc(var(--tg-animation-duration) * 0.75) ease-in forwards;
}

/* Very narrow screens: let the primary action take the full row */
@media (max-width: 360px) {
  .popover.is-mobile .actions { flex: 1 1 100%; }
  .popover.is-mobile .primary { flex: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .root, .root * { animation: none !important; transition: none !important; }
}

@media (forced-colors: active) {
  .popover { border: 1px solid CanvasText; }
  .spotlight { outline: 2px solid Highlight; }
}
`;

let sharedSheet: CSSStyleSheet | null = null;

function supportsAdoptedStyleSheets(): boolean {
  return (
    typeof ShadowRoot !== 'undefined' &&
    'adoptedStyleSheets' in ShadowRoot.prototype &&
    typeof CSSStyleSheet !== 'undefined' &&
    'replaceSync' in CSSStyleSheet.prototype
  );
}

/**
 * Applies the base styles (shared constructable stylesheet when supported, `<style>` fallback
 * for older WebViews) plus optional per-instance custom CSS.
 */
export function applyStyles(shadow: ShadowRoot, extraCss = ''): HTMLStyleElement {
  const custom = document.createElement('style');
  custom.setAttribute('data-tg-custom', '');
  custom.textContent = extraCss;

  if (supportsAdoptedStyleSheets()) {
    try {
      sharedSheet ??= new CSSStyleSheet();
      // CSSStyleSheet#replaceSync is a DOM API, not a blocking Node call.
      // eslint-disable-next-line n/no-sync
      if (sharedSheet.cssRules.length === 0) sharedSheet.replaceSync(TOUR_STYLES);
      // eslint-disable-next-line no-param-reassign -- adopting sheets is done by assignment
      shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, sharedSheet];
      shadow.append(custom);
      return custom;
    } catch {
      // fall through to <style>
    }
  }
  const base = document.createElement('style');
  base.textContent = TOUR_STYLES;
  shadow.append(base, custom);
  return custom;
}
