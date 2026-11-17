/**
 * Electron renderer entry (`@xkid1/tour-guide/electron`).
 *
 * Electron renderers are Chromium, so this is the browser entry: importing it registers
 * `<tour-guide>` and exposes `createTour`. It works with `contextIsolation: true` and
 * `nodeIntegration: false` because nothing here touches Node APIs.
 *
 *   // renderer.ts
 *   import { createTour } from '@xkid1/tour-guide/electron';
 *   createTour({ steps: [...] }).start();
 *
 * Without a bundler, load `dist/browser/tour-guide.iife.js` with a `<script>` tag instead and
 * use `window.TourGuide`. If your CSP is strict, the styles use constructable stylesheets
 * (no `style-src 'unsafe-inline'` needed on Chromium).
 */
export * from '../browser/index';
