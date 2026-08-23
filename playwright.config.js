import { defineConfig, devices } from '@playwright/test';

// Dev-only visual-QA harness. Never ships (no runtime import) — it drives the same
// dev server `npm run dev` starts, screenshots every screen from static/screens.json
// across phone/tablet/desktop × light/dark, diffs against a committed baseline, and
// runs axe. See tests/visual.spec.js. Seed baselines once: `npm run test:visual:update`.
const PORT = 4173;

export default defineConfig({
  testDir: './tests',
  // one flat baseline folder, keyed by the name each shot passes (viewport+theme in it)
  snapshotPathTemplate: 'tests/__screenshots__/{arg}{ext}',
  fullyParallel: true,
  timeout: 40_000,
  // fonts/AA differ per OS, so allow a small ratio before a diff is a "real" change
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled' } },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['Desktop Chrome'],
    // deterministic paint: freeze CSS animations/transitions for every screenshot
    launchOptions: { args: ['--force-prefers-reduced-motion'] }
  },
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
});
