import { defineConfig } from 'vitest/config';

import { viteAliases } from './scripts/aliases.mjs';

export default defineConfig({
  resolve: { alias: viteAliases },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    restoreMocks: true,
    // `yarn bench` only (vitest --benchmark). Kept out of `yarn test`: timings are noisy.
    benchmark: { include: ['bench/**/*.bench.ts'] },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.ts', 'src/types/**', 'src/apps/**/*.md'],
      reporter: ['text', 'html', 'lcov'],
      thresholds: { statements: 80, branches: 70, functions: 80, lines: 80 },
    },
  },
});
