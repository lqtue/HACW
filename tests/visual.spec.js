import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Reuse the board's screen list so this stays in sync with the app for free.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const groups = JSON.parse(readFileSync(join(root, 'static/screens.json'), 'utf8'));

// The 25-site / 5-tour catalogs are near-identical layouts — one representative each
// is enough for a visual baseline (the flow phases keep every screen). Matches how the
// board collapses catalogs in compact view.
const screens = groups.flatMap((g) =>
  (g.catalog ? g.screens.slice(0, 1) : g.screens).map((sc) => ({
    label: sc.label,
    path: sc.path,
    // maps render WebGL tiles async and non-deterministically — mask them out
    map: !!sc.map || /\/destinations\/|\/tours\/|\/go|step=(recommend|manual|done)/.test(sc.path)
  }))
);

const VIEWPORTS = [
  { id: 'phone', width: 390, height: 844 },
  { id: 'tablet', width: 834, height: 1194 },
  { id: 'desktop', width: 1440, height: 900 }
];
const THEMES = ['light', 'dark'];
const slug = (s) => s.replace(/[^\da-z]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

// Set the app's own theme/lang keys before any script runs, so the frame boots in the
// right skin (same mechanism the /screens board uses).
async function boot(page, theme, path) {
  await page.addInitScript(
    ([t]) => {
      try {
        localStorage.setItem('hacw_theme', t);
        localStorage.setItem('hacw_lang', 'vi');
      } catch {}
    },
    [theme]
  );
  await page.emulateMedia({ colorScheme: theme });
  await page.goto(path, { waitUntil: 'load' });
  // settle: fonts + any async map/route layer + the one-shot entrance animations
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.waitForTimeout(1200);
}

test.describe('screens', () => {
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      for (const sc of screens) {
        test(`${slug(sc.label)} · ${vp.id} · ${theme}`, async ({ page }) => {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await boot(page, theme, sc.path);
          const mask = sc.map ? [page.locator('.maplibregl-map, canvas')] : [];
          await expect(page).toHaveScreenshot(`${slug(sc.label)}-${vp.id}-${theme}.png`, {
            fullPage: false,
            mask,
            maskColor: '#88888833'
          });
        });
      }
    }
  }
});

// A11y: one pass per flow screen (phone, light) — enough to catch regressions without
// 200 scans. Fails only on `critical`; serious/moderate are attached for review so a
// pre-existing issue doesn't block the visual baseline.
test.describe('a11y', () => {
  for (const sc of screens) {
    test(`axe · ${slug(sc.label)}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await boot(page, 'light', sc.path);
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      if (violations.length) {
        await testInfo.attach('axe.json', {
          body: JSON.stringify(violations, null, 2),
          contentType: 'application/json'
        });
      }
      const critical = violations.filter((v) => v.impact === 'critical');
      expect(critical, critical.map((v) => v.id).join(', ')).toEqual([]);
    });
  }
});
