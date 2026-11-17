# Contributing to @xkid1/tour-guide

Thanks for your interest in improving `@xkid1/tour-guide`! Bug reports, documentation
fixes, tests and features are all welcome. This guide explains how the project is
organised and what a pull request needs to get merged.

By taking part you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md). Report
security issues privately, as described in [SECURITY.md](SECURITY.md), never in public
issues.

## Contents

- [Ways to contribute](#ways-to-contribute)
- [Development setup](#development-setup)
- [Project layout](#project-layout)
- [Ground rules](#ground-rules)
- [Making a change](#making-a-change)
- [Testing](#testing)
- [Pull requests](#pull-requests)
- [Releasing (maintainers)](#releasing-maintainers)

## Ways to contribute

- **Report a bug.** Use the bug report template and include a minimal reproduction: a
  small HTML page, a CodeSandbox/StackBlitz, or a repository. Mention the package version,
  the browser or WebView, and the entry point you import (`/browser`, `/react`, the
  IIFE…).
- **Suggest a feature.** Use the feature request template and describe the problem before
  the solution. For larger changes, open an issue to agree on the API **before** writing
  code. The customization surface (options, attributes, events, CSS variables, parts) is
  public API and hard to change later.
- **Improve the docs.** Typos, unclear explanations and missing examples in the README are
  great first contributions.
- **Report accessibility problems.** See
  [ACCESSIBILITY.md](ACCESSIBILITY.md#reporting-an-accessibility-issue).

Not sure where to start? Documentation fixes, extra tests and small bugs are great first
contributions. Comment on an issue to say you're working on it.

## Development setup

**Requirements:** Node.js 22 or newer (the repository pins the exact version in `.nvmrc`),
and Yarn 4 via Corepack.

```bash
git clone https://github.com/xkid1/tour-guide.git
cd tour-guide
corepack enable          # Node 25+: run `npm i -g corepack` first
yarn install
yarn demo                # http://localhost:5173/demo/
```

The demo page (`demo/index.html`) loads the source directly through Vite, so your changes
appear on save. It has a main tour, contextual menu and modal tours, a footer step (smooth
scrolling), a theme switcher and an event log. Use it to check your change by hand.

### Commands

| Command             | What it does                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------- |
| `yarn demo`         | Vite dev server for the demo page                                                         |
| `yarn test`         | Unit and integration tests (Vitest + happy-dom)                                           |
| `yarn coverage`     | Tests with coverage thresholds (80% statements/lines/functions, 70% branches)             |
| `yarn lint`         | ESLint                                                                                    |
| `yarn typecheck`    | `tsc --noEmit`                                                                            |
| `yarn format`       | Prettier                                                                                  |
| `yarn build`        | ESM + `.d.ts`, browser bundles and the Custom Elements Manifest                           |
| `yarn size`         | Gzip size budgets for `dist/` (run after `yarn build`)                                    |
| `yarn bench`        | Runtime benchmarks (`bench/README.md`)                                                    |
| `yarn e2e`          | Packs the tarball and tests it in a fresh consumer project (`e2e/README.md`)              |
| `yarn e2e:browsers` | Also runs real Chromium, Firefox, WebKit and an Electron app (Playwright)                 |
| `yarn check:deps`   | Fails if the package gains a runtime dependency                                           |
| **`yarn check`**    | Deps guard, format, lint, typecheck, coverage, build and size. **Run it before every PR** |

## Project layout

```text
src/
  types/   Types only, one folder per domain. No runtime code.
  utils/   Pure, DOM-light helpers (positioning, focus, motion, storage…). No imports from libs/.
  libs/    The component: tour-manager (state), tour-renderer (shadow DOM), tour-element
           (<tour-guide>), styles, defaults, attributes, validate.
  apps/    Thin entry points and framework adapters: browser, react, vue, svelte, angular,
           electron, android (native bridge), resume.
  index.ts Public barrel.
tests/     Cross-module and adapter tests.
e2e/       The end-user suite: installs the packed tarball in a fresh project.
demo/      The demo page.
bench/     Benchmarks and size budgets.
scripts/   Build scripts (alias rewriting, browser bundles, Custom Elements Manifest).
```

Data flows one way: **public API → `TourManager` (state) → callbacks → `TourGuideElement`
→ `TourRenderer` (DOM)**. The manager knows nothing about the DOM, and the renderer holds
no tour state.

## Ground rules

These are checked in review, and most of them by tooling too.

1. **Zero runtime dependencies.** `dependencies` and `peerDependencies` stay empty.
   Adapters receive the framework as an argument (`createReactTourGuide(React)`). Never
   import `react`, `vue`, `svelte` or `@angular/*` in `src/`.
2. **Imports.** Across layers, import the barrel alias (`@apps`, `@libs`, `@types`,
   `@utils`). Inside a layer, import siblings relatively, without a file extension
   (`'../styles/styles'`). Never use `../../`, deep alias paths or `.js`/`.ts` extensions.
   ESLint enforces this. If you add an alias, keep `tsconfig.json`, `.swcrc` and
   `scripts/aliases.mjs` in sync.
3. **Type-only imports** use `import type` (`verbatimModuleSyntax` is on).
4. **SSR-safe.** No DOM access at module top level. Guard with `isBrowser()` or
   `typeof X !== 'undefined'`.
5. **Secure by default.** Strings render as text. HTML only goes in through `allowHtml` or
   trusted icon markup. No `eval`, and no CSS selectors built from user input.
6. **Accessible.** Keep `role="dialog"`, `aria-modal`, the accessible name, the focus
   trap, focus restore, keyboard support and `prefers-reduced-motion`. See
   [ACCESSIBILITY.md](ACCESSIBILITY.md#checklist-for-contributors).
7. **User code must never break a tour.** Catch errors from hooks, `content()` and
   `target()`, wrap them with `hookError()` and report them through the `tour-error`
   event. Validation problems are warnings (logged once), never `throw`s.
8. **The customization surface is public API.** Renaming an option, attribute, event, CSS
   variable or `part` is a breaking change.
9. **Small, focused modules** (aim for under 300 lines). New pure logic goes in `utils/`
   with unit tests.

## Making a change

1. **Fork and branch** from `main`: `git switch -c fix/popover-flip`.
2. **Write the change.** Put types in `src/types/<domain>/`, not next to the code that
   uses them.
3. **Add tests** (see [Testing](#testing)). Every behaviour change needs one.
4. **Update the docs** for anything users can see:
   - `README.md`: the options, step, events, attributes or CSS variables tables, and
     examples
   - `scripts/custom-elements-manifest.mjs`: new attributes, events or parts
   - `CHANGELOG.md`: an entry under **Unreleased** (Added / Changed / Fixed)
5. **Extend the e2e suite** when you add an entry point, adapter, option or event
   (`e2e/consumer/`). It's the contract with end users: it only goes through the `exports`
   map.
6. **Run `yarn check`** and, for packaging or adapter changes, `yarn e2e`.

### Adding an option, attribute or event

Follow the existing path for a similar feature, end to end:

1. The type in `src/types/options/options.ts` (and `step/step.ts` for a per-step override)
2. The default in `src/libs/defaults/defaults.ts`. Validation infers the type from it; add
   enum values to `ENUM_OPTIONS` in `src/libs/validate/validate.ts`.
3. The attribute mapping in `src/libs/attributes/attributes.ts` (`<tour-step>` parsing
   too, if it applies)
4. The behaviour in the manager, renderer or element
5. Styles in `src/libs/styles/styles.ts`, as `--tg-*` variables with a `part` where
   styling applies
6. Tests, README tables, manifest, CHANGELOG and e2e

### Bundle size

`yarn size` enforces gzip budgets for the browser bundles and the ESM tree
(`bench/size.mjs`). If your change needs more room, raise the budget **in the same PR**,
with a comment explaining why, so size growth is always a reviewed decision. Features that
most users don't need belong in their own entry point (like `/resume`), so the core bundle
stays small.

## Testing

- **Unit tests** for `libs/` and `utils/` sit next to the module:
  `src/<layer>/<name>/<name>.test.ts`, importing `./<name>`.
- **Cross-module and adapter tests** live in `tests/`.
- **happy-dom has no layout engine**: `getBoundingClientRect()` returns zeros. Stub it
  with `vi.spyOn(el, 'getBoundingClientRect')` when a test needs geometry. For elements
  created later (like the popover), stub the prototype.
- happy-dom runs no CSS animations, so animated code paths complete synchronously in
  tests. Test the waiting logic by stubbing `getAnimations()` (see
  `src/utils/motion/motion.test.ts`).
- **React** tests use `React.act` and `IS_REACT_ACT_ENVIRONMENT`. **Vue** tests use
  `nextTick`.
- Test behaviour through the public API (`element.start()`, events, the shadow DOM
  `part`s), not private fields.
- **Real browsers:** for positioning, scrolling, animation and focus changes, check the
  demo in at least Chromium and Firefox, and run `yarn e2e:browsers` if you can.

## Pull requests

- **Title:** [Conventional Commits](https://www.conventionalcommits.org/), checked by CI.
  It becomes the squash-merge commit and the release-notes entry. Allowed types: `feat`,
  `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore` and `revert`. A scope
  is optional.

  ```text
  feat(mobile): follow the target on small screens
  fix(position): flip when the preferred side is clipped
  docs(readme): document the resume entry
  ```

  Use `feat!:` or a `BREAKING CHANGE:` footer for breaking changes.

- **Keep it focused.** One concern per PR. Separate refactors from behaviour changes.
- **Fill in the template**: summary, change type, and how you verified it. Screenshots or
  a short recording help a lot for visual changes.
- **CI must pass**: lint, typecheck, tests, build and size, e2e, CodeQL and the PR title
  check. Labels are applied automatically from the files you change.
- A maintainer will review it as soon as they can. Expect questions about the public API,
  accessibility and bundle size. That's normal, not a rejection.

By contributing, you agree that your contributions are licensed under the project's
[MIT License](LICENSE).

## Releasing (maintainers)

1. Move the **Unreleased** CHANGELOG entries under a new `## X.Y.Z` heading, and bump
   `version` in `package.json` to match.
2. Run `yarn check` and `yarn e2e`, then merge to `main`.
3. Push the tag: `git tag vX.Y.Z && git push origin vX.Y.Z`.
4. `publish.yml` checks that the tag, `package.json` and CHANGELOG agree, runs
   `yarn check` and the e2e suite, publishes the tested tarball with provenance to
   **npmjs.com** and to **GitHub Packages**, and creates the GitHub Release with generated
   notes. Don't create the release by hand.

A version with a hyphen (`1.2.0-beta.1`) goes to the `next` dist-tag as a pre-release. See
[.github/CI_BUILD_STRATEGY.md](.github/CI_BUILD_STRATEGY.md) for every CI check, npm
authentication, and the one-time repository settings.

Version numbers follow [Semantic Versioning](https://semver.org). Before 1.0, breaking
changes bump the minor version.
