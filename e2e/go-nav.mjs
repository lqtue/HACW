// Automated proof for /go walking guidance + the glyph-404 fix.
// Fakes GPS (Playwright geolocation) + compass (dispatched DeviceOrientation),
// walks toward stop 1 of a tour, screenshots each step, and asserts:
//   - the distance shrinks step to step
//   - "arrived" state appears inside the stop radius
//   - heading-up rotates the map (visual, screenshot)
//   - NO glyph .pbf 404s reach the console (empty-glyph fallback works)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const APP = process.env.APP || 'http://localhost:5173';
const TOUR = 'nha-co-va-nghe-xua';
const OUT = fileURLToPath(new URL('./shots/', import.meta.url));
mkdirSync(OUT, { recursive: true });

// approach stop 1 (15.8775334, 108.3256375) from the west
const walk = [
  { lat: 15.8779, lng: 108.3230, label: '1-far' },
  { lat: 15.8778, lng: 108.3242, label: '2-mid' },
  { lat: 15.87765, lng: 108.3251, label: '3-near' },
  { lat: 15.8775334, lng: 108.3256375, label: '4-arrive' }
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  deviceScaleFactor: 2
});

// The app's dev-geo simulator (import.meta.env.DEV) owns navigator.geolocation and
// exposes window.__setFakePos(lat,lng) to move the fix — we drive that, so we exercise
// the real GeolocateControl -> heading cone -> `me` path, not a bespoke mock.
const page = await ctx.newPage();

const glyphErrors = [];
page.on('console', (m) => {
  const t = m.text();
  if (/\.pbf/.test(t) && /(404|Not Found|Unable to load glyph)/.test(t)) glyphErrors.push(t);
});
page.on('requestfailed', (r) => {
  if (/\.pbf/.test(r.url())) glyphErrors.push('REQFAIL ' + r.url());
});
page.on('response', (r) => {
  if (/\/map\/fonts\/.+\.pbf$/.test(r.url()) && r.status() >= 400) glyphErrors.push(`HTTP ${r.status()} ${r.url()}`);
});

await page.goto(`${APP}/go?set=${TOUR}`, { waitUntil: 'networkidle' });
await page.waitForSelector('.tn-card', { timeout: 15000 });
await page.waitForTimeout(2500); // map load + first GPS fix

const steps = [];
for (const s of walk) {
  await page.evaluate(([lat, lng]) => window.__setFakePos(lat, lng), [s.lat, s.lng]);
  await page.waitForTimeout(1200);
  const dist = await page.locator('.tn-dist').first().textContent().catch(() => null);
  const label = await page.locator('.tn-label').first().textContent().catch(() => null);
  const name = await page.locator('.tn-name').first().textContent().catch(() => null);
  const arrivedBadge = await page.locator('.tn-dir.here').count();
  steps.push({ step: s.label, label: (label || '').trim(), name: (name || '').trim(), dist: (dist || '').trim(), arrived: arrivedBadge > 0 });
  await page.screenshot({ path: OUT + `walk-${s.label}.png` });
}

// heading-up: toggle, then feed compass heading (Android-absolute style)
await page.locator('.tn-headingup').dispatchEvent('click');
await page.evaluate(async () => {
  for (let a = 0; a <= 160; a += 20) {
    const e = new DeviceOrientationEvent('deviceorientationabsolute', { alpha: a });
    Object.defineProperty(e, 'absolute', { value: true });
    window.dispatchEvent(e);
    await new Promise((r) => setTimeout(r, 120));
  }
});
await page.waitForTimeout(1200);
const headingUpPressed = (await page.locator('.tn-headingup[aria-pressed="true"]').count()) > 0;
await page.screenshot({ path: OUT + 'heading-up.png' });

await browser.close();

// --- assertions ---
// distance text is "NNN m" or "N,N km" — normalise to metres for a real decrease check
const metres = (txt) => {
  const m = String(txt).match(/([\d.,]+)\s*(km|m)/);
  if (!m) return NaN;
  const v = parseFloat(m[1].replace(',', '.'));
  return m[2] === 'km' ? v * 1000 : v;
};
const nums = steps.map((s) => metres(s.dist));
const first = nums[0], last = nums[nums.length - 1];
const shrank = Number.isFinite(first) && Number.isFinite(last) && first - last > 50; // genuinely closed distance
const arrived = steps[steps.length - 1].arrived && !steps[0].arrived; // not arrived at the start, arrived at the end

console.log(JSON.stringify({ steps, headingUpPressed, glyphErrors: glyphErrors.length, glyphSample: glyphErrors.slice(0, 3), shrank, arrived, shots: OUT }, null, 2));

const pass = shrank && arrived && glyphErrors.length === 0 && headingUpPressed;
console.log(pass ? '\nPASS ✅' : '\nFAIL ❌');
process.exit(pass ? 0 : 1);
