# CI, release and repository automation

How the GitHub Actions workflows for `@xkid1/tour-guide` fit together, what each check
runs, and the one-time repository settings they rely on.

## Principles

- **Zero runtime dependencies.** The package ships nothing users have to install.
  Framework adapters receive the framework as an argument (`createReactTourGuide(React)`),
  so `react`, `vue`, `svelte` and friends are **devDependencies** only, used by the
  adapter tests. `yarn check:deps` (`scripts/check-zero-deps.mjs`) fails if
  `dependencies`, `peerDependencies`, `optionalDependencies` or `bundleDependencies` gets
  an entry.
- **Test what users install.** The e2e suite packs the package exactly as `npm publish`
  would and installs the tarball in a fresh project, reaching it only through the
  `exports` map. The release job publishes **that same tested tarball**.
- **Same commands locally and in CI.** Every check is a `yarn` script, so `yarn check` and
  `yarn e2e` reproduce CI on your machine.
- **Least privilege.** Workflows default to `contents: read`. Jobs request write scopes
  only where they need them, and `pull_request_target` workflows never check out PR code.

## Shared building blocks

| Action                    | What it does                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.github/actions/setup`   | Node from `.nvmrc`, Yarn 4 through Corepack, a Yarn cache keyed on `yarn.lock`, `yarn install --immutable`                                                                                       |
| `.github/actions/changes` | Outputs `code=false` when a PR or push only changes docs/config (`*.md`, `*.yml` outside `.github/`, `docs/`), so expensive jobs skip themselves. Workflow and action edits always count as code |

Skipped jobs count as passed for required status checks, so docs-only PRs can still merge.

## Build output

`yarn build` (also run by `prepack`) produces:

- `dist/**/*.js` + `.d.ts`: ESM compiled by SWC, declarations by `tsc`. Source imports use
  the `@apps`/`@libs`/`@types`/`@utils` aliases and extensionless paths;
  `scripts/resolve-aliases.mjs` rewrites them to real relative `.js` paths. `yarn e2e`
  fails if an alias leaks into the package.
- `dist/browser/tour-guide.iife.js` and `.es.js`: single-file bundles (`window.TourGuide`
  for the IIFE).
- `dist/custom-elements.json`: the Custom Elements Manifest, for IDE and framework
  tooling.

When adding an alias, update `tsconfig.json`, `.swcrc` and `scripts/aliases.mjs` (used by
Vite and Vitest).

## Pull request checks

Every pull request, and every push to `main`, runs these. Each job has a short, stable
name so it can be marked as a required check:

| Workflow                | Check name          | Runs                                                                                                         | Required           |
| ----------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------ |
| `ci.yml`                | `Lint`              | `yarn lint`                                                                                                  | yes                |
| `ci.yml`                | `Typecheck`         | `yarn typecheck`                                                                                             | yes                |
| `ci.yml`                | `Format`            | `yarn format:check`                                                                                          | optional           |
| `test.yml`              | `Test`              | `yarn coverage`: tests plus coverage thresholds; a coverage summary in the job summary                       | yes                |
| `build.yml`             | `Build`             | `yarn build`                                                                                                 | optional           |
| `build.yml`             | `Package`           | `yarn check:deps`: the zero-runtime-dependency guard                                                         | yes                |
| `bench.yml`             | `Size`              | `yarn size`: gzip budgets for `dist/` (`bench/size.mjs`)                                                     | yes                |
| `bench.yml`             | `Bench`             | `yarn bench` on the base and the head, compared in the job summary                                           | no (informational) |
| `e2e.yml`               | `E2E`               | The packed tarball on Node 18–26, pnpm, React 18, Svelte 4, real Chromium/Firefox/WebKit and an Electron app | yes                |
| `codeql.yml`            | `Analyze (…)`       | CodeQL for TypeScript/JavaScript and for the workflows themselves                                            | recommended        |
| `dependency-review.yml` | `Dependency review` | Fails when a PR adds a dependency version with a known moderate+ vulnerability                               | yes                |
| `pr-title.yml`          | `PR title`          | Conventional Commits title (it becomes the release-notes entry)                                              | optional           |

### End-user suite (`e2e.yml`)

1. **Pack**: `npm pack` (runs `prepack` → `yarn build`), uploaded as the `package-tarball`
   artifact.
2. **Matrix**: the suites in `e2e/consumer/tests` (exports, SSR, TypeScript in several
   module modes, vanilla, IIFE, Electron, WebView bridge, React, Vue, Svelte, Angular,
   bundlers) on Node 18, 20, 22, 24 and 26, plus pnpm, React 18 and Svelte 4 variants.
   Suites that need a newer Node skip themselves, but from Node 22 on a skip fails the job
   (`E2E_FAIL_ON_SKIP`), so a skip can't hide a failure.
3. **Real browsers**: layout, scrolling, focus and the mobile layout in Chromium, Firefox
   and WebKit (Playwright).
4. **Electron app**: a real Electron window with `contextIsolation` and the sandbox, under
   `xvfb`.
5. **E2E**: one summary check to mark as required, whatever the jobs above contain.

See `e2e/README.md` to run or extend it locally.

## Release (`publish.yml`)

Releasing is fully automated from a version tag:

1. Move the CHANGELOG's **Unreleased** entries under a `## X.Y.Z` heading (`## [X.Y.Z]`
   and a date suffix also work) and set `version` in `package.json` to `X.Y.Z`. Merge to
   `main`.
2. Push the tag: `git tag vX.Y.Z && git push origin vX.Y.Z`. The workflow creates the
   GitHub Release itself, so don't create it by hand.
3. The workflow then runs:
   - **verify**: the tag matches `package.json`, the CHANGELOG has the version, and
     `yarn check` passes
   - **e2e**: the full end-user suite against the packed tarball
   - **publish**: that exact tarball to npmjs.com (with provenance) and GitHub Packages,
     then the GitHub Release with generated notes, grouped by the PR labels
     (`release.yml`)

A version with a hyphen (`1.2.0-beta.1`) is published under the `next` dist-tag and marked
as a pre-release. Every publish step is skipped when that version already exists, so
re-running the workflow, or dispatching it manually with the tag, safely finishes a
release that failed halfway.

**npm authentication**, in order of preference:

1. **Trusted publishing (OIDC)**: no secret needed. Configure it on npmjs.com under the
   package's **Settings → Trusted publisher** (GitHub Actions, `xkid1/tour-guide`,
   `publish.yml`).
2. **`NPM_TOKEN` secret**: a granular token with publish rights. Needed for the very first
   publish, because trusted publishing can only be configured once the package exists.

GitHub Packages uses the workflow's `GITHUB_TOKEN`.

## Repository automation

| Workflow                    | Trigger             | What it does                                                                                                                                                  |
| --------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pr-labeler.yml`            | PR opened/updated   | Labels PRs from the files they change (`labeler.yml`): `source`, `adapters`, `styles`, `tests`, `e2e`, `demo`, `benchmarks`, `ci`, `documentation`, `tooling` |
| `pr-title.yml`              | PR opened/edited    | Enforces Conventional Commits titles                                                                                                                          |
| `pr-welcome.yml`            | First issue or PR   | Welcomes first-time contributors and points them to the guidelines                                                                                            |
| `dependabot-auto-merge.yml` | Dependabot PRs      | Auto-merges minor/patch devDependency and GitHub Actions updates once all required checks pass                                                                |
| `stale.yml`                 | Daily               | Marks issues/PRs stale after 60 days without activity and closes them 14 days later (bugs, accessibility and security issues are exempt)                      |
| `codeql.yml`                | PRs, `main`, weekly | CodeQL security and quality analysis                                                                                                                          |
| `scorecard.yml`             | `main`, weekly      | OpenSSF Scorecard for supply-chain practices                                                                                                                  |

**Dependabot** (`dependabot.yml`) proposes npm and GitHub Actions updates weekly, grouped
(minor/patch together, majors separately), and waits 5 days after a release before
proposing it.

## One-time repository settings

These can't be set from workflow files. A repository admin sets them once:

1. **Branch ruleset for `main`**: **Settings → Rules → Rulesets → New branch ruleset**.
   Target the default branch, set **Enforcement status** to **Active**, and enable:
   - **Require a pull request before merging**
   - **Require status checks to pass**, adding `Lint`, `Typecheck`, `Test`, `Package`,
     `Size`, `E2E` and `Dependency review` (optionally `Format`, `Build`, `PR title` and
     the CodeQL checks). A check can only be selected after it has run once, so open a PR
     first.
   - Optionally **Require branches to be up to date before merging**
2. **Settings → General → Allow auto-merge**, for Dependabot auto-merge.
3. **Settings → Code security**: turn on **Private vulnerability reporting** (used by
   `SECURITY.md`), Dependabot alerts and the dependency graph (on by default for public
   repositories).
4. **npm**: create the `NPM_TOKEN` secret for the first release, then configure trusted
   publishing and delete the token.

## Local validation

```bash
yarn check          # deps guard, format, lint, typecheck, tests + coverage, build, size
yarn check:deps     # zero runtime dependencies
yarn e2e            # the packed-tarball end-user suite
yarn e2e:browsers   # + real browsers and an Electron app (downloads them)
```
