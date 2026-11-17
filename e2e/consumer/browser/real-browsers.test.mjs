/**
 * Real browsers (Playwright): layout, scrolling, focus and CSP, which happy-dom cannot model.
 * E2E_BROWSERS=chromium,firefox,webkit selects the engines.
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import * as playwright from 'playwright';

import { startServer } from './server.mjs';

const PROJECT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BROWSERS = (process.env.E2E_BROWSERS || 'chromium').split(',').filter(Boolean);

let server;
before(async () => {
  server = await startServer(PROJECT);
});
after(async () => {
  await server?.close();
});

const popover = 'tour-guide [part~="popover"]';
const title = 'tour-guide [part~="title"]';

async function open(page, path) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    // CSP reports are asserted separately (see the strict CSP test).
    if (
      message.type() === 'error' &&
      !/Content[- ]Security[- ]Policy/i.test(message.text())
    )
      errors.push(message.text());
  });
  await page.goto(`${server.origin}${path}`);
  await page.waitForFunction(() => window.__ready === true);
  return errors;
}

/** Box of a node inside the tour's shadow root (Playwright CSS pierces open shadow roots). */
const box = async (page, selector) => {
  const value = await page.locator(selector).boundingBox();
  assert.ok(value, `${selector} has a layout box`);
  return value;
};

/** Is focus inside the tour popover (deep active element)? */
const focusInsideTour = (page) =>
  page.evaluate(() => {
    const host = document.activeElement;
    if (host?.localName !== 'tour-guide') return false;
    const inner = host.shadowRoot.activeElement;
    return Boolean(
      inner && host.shadowRoot.querySelector('[part~="popover"]').contains(inner),
    );
  });

for (const name of BROWSERS) {
  describe(`${name}`, () => {
    let browser;
    before(async () => {
      browser = await playwright[name].launch();
    });
    after(async () => {
      await browser?.close();
    });

    it('IIFE under a strict CSP: full journey with real layout and focus', async () => {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      const errors = await open(page, '/browser/iife.strict.html');

      await page.click('#opener');
      await page.locator(popover).waitFor({ state: 'visible' });
      assert.equal(await page.locator(title).textContent(), 'Welcome');

      // Step 1 has no target: centred in the viewport.
      const centred = await box(page, popover);
      const middle = centred.x + centred.width / 2;
      assert.ok(Math.abs(middle - 640) < 20, `centred horizontally (${middle})`);

      // Focus moved into the dialog and Tab stays trapped there.
      assert.equal(await focusInsideTour(page), true, 'focus moved into the popover');
      for (let i = 0; i < 6; i += 1) {
        await page.keyboard.press('Tab');
        assert.equal(
          await focusInsideTour(page),
          true,
          `Tab #${i + 1} stays in the popover`,
        );
      }
      await page.keyboard.press('Shift+Tab');
      assert.equal(await focusInsideTour(page), true, 'Shift+Tab stays in the popover');

      // Step 2: placed below the anchor, spotlight around it.
      await page.locator('tour-guide [part~="next-button"]').click();
      await page.waitForFunction(() => window.__tour.element.currentIndex === 1);
      await page.waitForTimeout(100);
      const anchor = await box(page, '#anchor');
      const placed = await box(page, popover);
      assert.ok(placed.y >= anchor.y + anchor.height, 'popover sits below the anchor');
      const spotlight = await box(page, 'tour-guide [part~="spotlight"]');
      assert.ok(
        spotlight.x <= anchor.x && spotlight.y <= anchor.y,
        'spotlight covers anchor',
      );
      assert.ok(
        spotlight.x + spotlight.width >= anchor.x + anchor.width &&
          spotlight.y + spotlight.height >= anchor.y + anchor.height,
        'spotlight covers the anchor',
      );

      // Step 3: target is far below the fold and gets scrolled into view.
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => window.__tour.element.currentIndex === 2);
      await page.waitForFunction(() => {
        const rect = document.getElementById('far').getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= window.innerHeight;
      });
      const far = await box(page, '#far');
      const above = await box(page, popover);
      assert.ok(above.y + above.height <= far.y, 'popover sits above the far target');

      // Escape closes and focus returns to the opener.
      await page.keyboard.press('Escape');
      await page.locator(popover).waitFor({ state: 'hidden' });
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'opener');

      assert.deepEqual(errors, []);
      await page.close();
    });

    it('strict CSP (no unsafe-inline): rendering reports no violations', async () => {
      const page = await browser.newPage();
      await open(page, '/browser/iife.strict.html');
      await page.click('#opener');
      await page.locator(popover).waitFor({ state: 'visible' });
      await page.waitForTimeout(50);
      assert.deepEqual(await page.evaluate(() => window.__violations), []);
      await page.close();
    });

    it('native ES modules from dist/ load without a bundler', async () => {
      const page = await browser.newPage();
      const errors = await open(page, '/browser/esm.html');
      await page.click('#opener');
      await page.locator(popover).waitFor({ state: 'visible' });
      assert.equal(await page.locator(title).textContent(), 'Welcome');
      assert.equal(
        await page.evaluate(
          () => customElements.get('tour-guide') === window.__tour.element.constructor,
        ),
        true,
      );
      assert.deepEqual(errors, []);
      await page.close();
    });

    it('phone viewport: the popover stays inside the screen', async () => {
      const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
      await open(page, '/browser/iife.strict.html');
      await page.click('#opener');
      await page.locator(popover).waitFor({ state: 'visible' });
      for (let index = 0; index < 3; index += 1) {
        await page.evaluate((i) => window.__tour.goTo(i), index);
        await page.waitForTimeout(150);
        const rect = await box(page, popover);
        assert.ok(
          rect.x >= 0 && rect.x + rect.width <= 375 + 0.5,
          `step ${index} fits width`,
        );
        assert.ok(
          rect.y >= 0 && rect.y + rect.height <= 667 + 0.5,
          `step ${index} fits height`,
        );
      }
      await page.close();
    });

    it('prefers-reduced-motion is honoured', async () => {
      const context = await browser.newContext({ reducedMotion: 'reduce' });
      const page = await context.newPage();
      await open(page, '/browser/iife.strict.html');
      await page.click('#opener');
      await page.locator(popover).waitFor({ state: 'visible' });
      const longest = await page.evaluate(() => {
        const root = document.querySelector('tour-guide').shadowRoot;
        let max = 0;
        for (const node of root.querySelectorAll('[part]')) {
          const style = getComputedStyle(node);
          for (const value of `${style.transitionDuration},${style.animationDuration}`.split(
            ',',
          )) {
            const seconds = value.trim().endsWith('ms')
              ? parseFloat(value) / 1000
              : parseFloat(value);
            if (!Number.isNaN(seconds)) max = Math.max(max, seconds);
          }
        }
        return max;
      });
      assert.ok(longest <= 0.01, `longest transition/animation is ${longest}s`);
      await context.close();
    });
  });
}
