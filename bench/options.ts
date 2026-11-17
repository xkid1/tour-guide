/**
 * Shared run options for every benchmark.
 *
 *   BENCH_TIME=2000 yarn bench   # longer, steadier runs (ms per benchmark)
 */
const time = Number(process.env.BENCH_TIME ?? 500);

export const RUN = {
  time: Number.isFinite(time) && time > 0 ? time : 500,
  warmupTime: 100,
} as const;
