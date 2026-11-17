# Benchmarks

Two kinds of numbers: **runtime** (how fast the tour reacts) and **size** (what users download).

```bash
yarn bench                    # run every benchmark, print tables
BENCH_TIME=2000 yarn bench    # longer runs per benchmark (ms, default 500), steadier numbers
yarn bench:json               # same, and write bench-results/latest.json
yarn size                     # bundle sizes vs budgets (after `yarn build`); fails when over
```

## Runtime (`*.bench.ts`)

Vitest's benchmark runner (`vitest bench`, tinybench under the hood). Benchmarks live in
`test(…, async ({ bench }) => …)` blocks, so a group can also assert a sanity bound.

| File                 | Measures                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `position.bench.ts`  | `computePosition()` per placement, including the worst flip-and-clamp case and a 1 000-call scroll burst. It runs on every scroll/resize frame |
| `manager.bench.ts`   | `TourManager` walking 10/100 steps, with async hooks, and overlapping `goTo()` races       |
| `element.bench.ts`   | `<tour-guide>` create/connect, cold first render, `next`/`back`/`goTo`, `refresh()`, parsing 100 `<tour-step>`, `validateSteps`, `resolveOptions` |

The element benchmarks run in happy-dom, which is slower than a browser, so compare runs with
each other rather than reading them as absolute browser timings. The few `expect(...)` bounds
are deliberately loose (for example, a position stays under 0.05 ms). They catch an accidental
O(n²), not a 10% drift.

Bind imported functions to a local `const` before using them in a hot loop (see
`position.bench.ts`). Calling through the module's export getter adds overhead, and Vitest
warns about it.

## Comparing two runs

```bash
git switch main && BENCH_JSON=bench-results/main.json yarn bench:json
git switch -  && BENCH_JSON=bench-results/pr.json   yarn bench:json
yarn bench:compare bench-results/main.json bench-results/pr.json   # Markdown table
```

A row is flagged 🔴 when the mean got slower by more than `--threshold` (default 25%) **and**
by more than both runs' margins of error. `--fail` turns flags into a non-zero exit.

In CI, [`bench.yml`](../.github/workflows/bench.yml) does this for every pull request. It runs
the head's `bench/` folder against the base commit and then the head, on the same runner, and
writes the table to the job summary. Shared runners are noisy, so the comparison is
informational. Re-run locally before acting on a flag.

## Size (`size.mjs`)

Raw, gzip and brotli sizes of `dist/browser/tour-guide.iife.js`, `dist/browser/tour-guide.es.js`
and the whole unbundled ESM tree, against gzip budgets in `BUDGETS`. It runs in `yarn check` and
in the blocking `Size` CI check. To raise a budget, change it in the same PR as the code that
needs it, so size growth is always a reviewed decision.
