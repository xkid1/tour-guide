/**
 * Single source of truth for the layer barrel aliases used by Vite, Vitest and the browser build.
 * Keep in sync with `compilerOptions.paths` in tsconfig.json and `jsc.paths` in .swcrc.
 *
 *   @apps  → src/apps/index.ts
 *   @libs  → src/libs/index.ts
 *   @types → src/types/index.ts
 *   @utils → src/utils/index.ts
 */
import { fileURLToPath } from 'node:url';

export const LAYERS = /** @type {const} */ (['apps', 'libs', 'types', 'utils']);

const SRC = fileURLToPath(new URL('../src/', import.meta.url));

/**
 * Vite/Vitest `resolve.alias` entries. Exact-match regexes, so `@types` never swallows
 * npm scopes such as `@types/node`.
 * @type {{ find: RegExp; replacement: string }[]}
 */
export const viteAliases = LAYERS.map((layer) => ({
  find: new RegExp(`^@${layer}$`),
  replacement: `${SRC}${layer}/index.ts`,
}));
