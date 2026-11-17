# End-user (e2e) suite

Tests `@xkid1/tour-guide` the way people receive it: `run.mjs` packs the tarball (`npm pack`,
which runs `prepack` → `yarn build`), installs it into a fresh copy of [`consumer/`](consumer/)
next to the real frameworks, and imports it **only through the public `exports` map**. Nothing
here imports from `src/`. Unit and adapter tests against the sources live in `tests/` and
`src/**/*.test.ts`.

```bash
yarn e2e                                   # pack + every default suite
yarn e2e --suites react,vue                # a subset
yarn e2e --tarball ./xkid1-tour-guide-0.1.0.tgz   # test an existing tarball
yarn e2e --pm pnpm                         # install with pnpm (strict, symlinked)
yarn e2e --dep react@^18.3.0 --dep react-dom@^18.3.0   # override a consumer dependency
yarn e2e --browsers chromium,firefox,webkit             # + real browsers (Playwright)
yarn e2e --electron                        # + a real Electron window (Playwright)
yarn e2e:browsers                          # both of the above
yarn e2e --keep                            # keep the temp project to debug in it
```

`run.mjs` is plain Node (≥ 18) without dependencies, so CI runs it from a sparse checkout of
`e2e/`. Inside the temp project, each suite is a plain `node --test` file, so you can re-run
one there directly (`node --test tests/react.test.mjs`).

## Suites

| Suite           | What an end user does                                                                                     | Runs in                     |
| --------------- | --------------------------------------------------------------------------------------------------------- | --------------------------- |
| `exports`       | Zero dependencies, every `exports`/`unpkg`/`types` target exists, no leaked `@libs`-style aliases, deep imports blocked, one shared class across entries | Node                        |
| `ssr`           | Imports every entry with no DOM (Next.js, Nuxt, SvelteKit, Angular SSR); React/Vue/Svelte server rendering | Node                        |
| `types`         | Type-checks consumer code (incl. React JSX) with TypeScript 5.9, 6 and 7 × `bundler`/`node16`/`nodenext`  | `tsc`                       |
| `browser`       | `@xkid1/tour-guide/browser`: `createTour`, declarative `<tour-step>`, keyboard, focus restore, errors      | happy-dom                   |
| `electron`      | `@xkid1/tour-guide/electron` with a bundler: same surface as `/browser`, no Node APIs                     | happy-dom                   |
| `iife`          | `<script src=".../tour-guide.iife.js">`: `window.TourGuide`                                               | happy-dom                   |
| `android`       | `connectNativeBridge` with React Native WebView, Android `addJavascriptInterface`, iOS `WKWebView`        | happy-dom                   |
| `react`         | React 18/19 + `react-dom/client` in StrictMode: controlled `open`, `useTourGuide`, slots                  | happy-dom                   |
| `vue`           | Vue 3: `v-model:open`, template refs, deep reactivity, raw `<tour-guide>` with `isCustomElement`          | happy-dom                   |
| `svelte`        | A real `.svelte` file compiled by `svelte/compiler` (Svelte 4 and 5): `use:tourGuide`, controls           | happy-dom                   |
| `angular`       | Angular (standalone, zoneless, JIT): `CUSTOM_ELEMENTS_SCHEMA`, `provideAppInitializer`, `TourGuideController` | happy-dom               |
| `bundlers`      | Vite production builds: side-effect import still registers, adapters tree-shake, no framework is bundled  | Vite + happy-dom            |
| `real-browsers` | Opt-in. Real layout and scrolling, focus trap, strict CSP, phone viewport, `prefers-reduced-motion`, native ESM from `dist/` | Chromium, Firefox, WebKit |
| `electron-app`  | Opt-in. A sandboxed `BrowserWindow` (`contextIsolation`, no `nodeIntegration`) loading the IIFE          | Electron                    |

Every DOM suite drives the same user journey ([`tests/helpers/tour.mjs`](consumer/tests/helpers/tour.mjs)):
open → Next (click) → `ArrowRight` → `ArrowLeft` → Back (click) → `Escape`. It checks the
dialog's ARIA, text-only content, `part` names and the event order through the public API only.

Suites skip themselves on a Node version their tooling doesn't support (happy-dom needs ≥ 20,
Angular 22 needs `^22.22 || ^24.15 || >=26`, Vite 8 needs ≥ 20.19). On Node 18 that leaves
`exports`, `ssr` and `types`. Set `E2E_FAIL_ON_SKIP=1` to make any skip fail the run (CI does
this from Node 22 on).

## Known issues (tracked as `todo`)

`node --test` reports these as `todo`: they run and print their failure, but don't fail the
suite. Remove the `todo` option when the library is fixed, and the test becomes a regression
guard.

- **Strict CSP** (`real-browsers`): `applyStyles()` always appends an empty
  `<style data-tg-custom>` next to the adopted stylesheet, so a `style-src` without
  `'unsafe-inline'` reports a violation on every render (and custom CSS can't apply).
- **React 18 `className`** (`react`, `ssr`): the adapter forwards `className` unchanged, and
  React 18 renders it on custom elements as a literal `className` attribute. React 19 maps it
  to `class`.

## Adding a suite

1. Add `consumer/tests/<name>.test.mjs` (import `./helpers/dom.mjs` **first** if it needs a DOM).
2. Register it in `SUITES` in [`run.mjs`](run.mjs) with its Node requirement.
3. Add any new consumer dependency to [`consumer/package.json`](consumer/package.json).
