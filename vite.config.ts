import { defineConfig } from 'vite';

import { viteAliases } from './scripts/aliases.mjs';

// Dev server for the demo page: `yarn demo` → http://localhost:5173/demo/
export default defineConfig({
  resolve: { alias: viteAliases },
  server: { open: '/demo/' },
});
