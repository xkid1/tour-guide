/**
 * A real Electron app (Playwright's Electron driver): sandboxed renderer, contextIsolation,
 * no nodeIntegration, the IIFE loaded over file://. On Linux CI run under `xvfb-run`.
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { _electron as electron } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));

let app;
let window;
const errors = [];

before(async () => {
  // Chromium's own process sandbox refuses to start as root (e.g. in some containers).
  const args = process.getuid?.() === 0 ? ['--no-sandbox'] : [];
  // Terminals inside VS Code (itself Electron) export ELECTRON_RUN_AS_NODE=1, which would
  // start the binary as plain Node.
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({
    args: [...args, join(HERE, 'main.cjs')],
    cwd: join(HERE, '..'),
    env,
  });
  window = await app.firstWindow();
  window.on('pageerror', (error) => errors.push(error.message));
  await window.waitForFunction(() => window.__ready === true);
});

after(async () => {
  await app?.close();
});

const popover = 'tour-guide [part~="popover"]';

describe('Electron renderer', () => {
  it('the renderer is sandboxed (no Node globals)', async () => {
    const globals = await window.evaluate(() => ({
      require: typeof require,
      process: typeof process,
    }));
    assert.deepEqual(globals, { require: 'undefined', process: 'undefined' });
    const version = await app.evaluate(({ app: electronApp }) =>
      electronApp.getVersion(),
    );
    assert.match(version, /^\d+\./);
  });

  it('window.TourGuide registers <tour-guide> and runs the journey', async () => {
    assert.equal(
      await window.evaluate(() => typeof customElements.get('tour-guide')),
      'function',
    );

    await window.click('#opener');
    await window.locator(popover).waitFor({ state: 'visible' });
    assert.equal(
      await window.locator('tour-guide [part~="title"]').textContent(),
      'Welcome',
    );

    await window.locator('tour-guide [part~="next-button"]').click();
    await window.waitForFunction(() => window.__tour.element.currentIndex === 1);
    const anchor = await window.locator('#anchor').boundingBox();
    const placed = await window.locator(popover).boundingBox();
    assert.ok(placed.y >= anchor.y + anchor.height, 'popover sits below the anchor');

    await window.keyboard.press('ArrowRight');
    await window.waitForFunction(() => window.__tour.element.currentIndex === 2);

    await window.keyboard.press('Escape');
    await window.locator(popover).waitFor({ state: 'hidden' });
    assert.equal(await window.evaluate(() => document.activeElement?.id), 'opener');
    assert.deepEqual(errors, []);
  });
});
