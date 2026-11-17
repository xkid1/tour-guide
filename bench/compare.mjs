#!/usr/bin/env node
/**
 * Compares two bench/json-reporter.ts outputs and prints a Markdown table (for PR summaries).
 *
 *   node bench/compare.mjs bench-results/main.json bench-results/pr.json [--threshold 25]
 *
 * A row is flagged when the mean latency got slower by more than the threshold (%) AND the
 * change is larger than both runs' margins of error. Exits 0 unless --fail is passed, because
 * shared CI runners are noisy: treat flags as a prompt to re-run locally, not a verdict.
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    threshold: { type: 'string', default: '25' },
    fail: { type: 'boolean', default: false },
  },
});

if (positionals.length !== 2) {
  console.error(
    'usage: node bench/compare.mjs <base.json> <head.json> [--threshold 25] [--fail]',
  );
  process.exitCode = 2;
} else {
  const [base, head] = positionals.map((file) => JSON.parse(readFileSync(file, 'utf8')));
  const threshold = Number(values.threshold);
  const names = [
    ...new Set([...Object.keys(base.results), ...Object.keys(head.results)]),
  ];

  const format = (/** @type {number} */ ms) =>
    ms >= 1 ? `${ms.toFixed(2)} ms` : `${(ms * 1000).toFixed(2)} µs`;
  const rows = [];
  let regressions = 0;
  for (const name of names.sort()) {
    const a = base.results[name];
    const b = head.results[name];
    if (!a || !b) {
      rows.push(
        `| ${name} | ${a ? format(a.mean) : '—'} | ${b ? format(b.mean) : '—'} | ${a ? 'removed' : 'new'} | |`,
      );
      continue;
    }
    const change = ((b.mean - a.mean) / a.mean) * 100;
    const noise = Math.max(a.rme, b.rme);
    const slower = change > threshold && change > noise;
    const faster = change < -threshold && -change > noise;
    if (slower) regressions += 1;
    let mark = '';
    if (slower) mark = '🔴 slower';
    else if (faster) mark = '🟢 faster';
    const sign = change > 0 ? '+' : '';
    rows.push(
      `| ${name} | ${format(a.mean)} | ${format(b.mean)} | ${sign}${change.toFixed(1)}% (±${noise.toFixed(1)}%) | ${mark} |`,
    );
  }

  console.log(`### Benchmarks (mean latency, base → head)\n`);
  console.log(
    `Base: ${base.meta.node} ${base.meta.platform} · Head: ${head.meta.node} ${head.meta.platform}\n`,
  );
  console.log('| Benchmark | Base | Head | Change | |');
  console.log('| --- | ---: | ---: | ---: | --- |');
  for (const row of rows) console.log(row);
  console.log(
    `\n${regressions} benchmark(s) slower by more than ${threshold}% beyond the margin of error.`,
  );
  if (values.fail && regressions > 0) process.exitCode = 1;
}
