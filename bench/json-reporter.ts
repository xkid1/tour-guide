/**
 * Writes every benchmark result to a flat JSON file for bench/compare.mjs:
 *
 *   yarn bench --reporter=default --reporter=./bench/json-reporter.ts
 *   BENCH_JSON=bench-results/main.json (default: bench-results/latest.json)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type { Reporter, TestCase } from 'vitest/node';

export interface BenchEntry {
  /** Mean latency in ms. */
  mean: number;
  /** 99th percentile latency in ms. */
  p99: number;
  /** Operations per second (mean). */
  hz: number;
  /** Relative margin of error, in %. */
  rme: number;
  samples: number;
}

type TestBenchmark = Parameters<NonNullable<Reporter['onTestCaseBenchmark']>>[1];

export default class BenchJsonReporter implements Reporter {
  readonly #results: Record<string, BenchEntry> = {};

  onTestCaseBenchmark(testCase: TestCase, benchmark: TestBenchmark): void {
    const prefix = `${testCase.module.moduleId.split('/bench/').pop() ?? ''} > ${testCase.fullName}`;
    for (const task of benchmark.tasks) {
      if (task.fromStore) continue;
      this.#results[`${prefix} > ${task.name}`] = {
        mean: task.latency.mean,
        p99: task.latency.p99,
        hz: task.throughput.mean,
        rme: task.latency.rme,
        samples: task.latency.samplesCount,
      };
    }
  }

  onTestRunEnd(): void {
    const file = resolve(process.env.BENCH_JSON ?? 'bench-results/latest.json');
    mkdirSync(dirname(file), { recursive: true });
    const meta = {
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
    };
    writeFileSync(file, `${JSON.stringify({ meta, results: this.#results }, null, 2)}\n`);
    console.log(`bench: wrote ${Object.keys(this.#results).length} results to ${file}`);
  }
}
