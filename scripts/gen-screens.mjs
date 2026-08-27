// Build static/screens.json — the screen list the /screens.html board reads.
// Covers every destination + every tour, so the board stays in sync with the
// data. Re-run after editing destinations.json / tours.json.
//   node scripts/gen-screens.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (f) => JSON.parse(readFileSync(join(root, 'src/lib/data', f), 'utf8'));
// `closed` sites are dropped: their pages aren't prerendered (routes come from
// sites.js), so a board frame pointing at one would 404.
const dests = (d => d.destinations || d)(load('destinations.json')).filter((d) => !d.closed);
const tours = (t => t.tours || t)(load('tours.json'));
// iconic, real (non-generated) quiz bank, has landmark art — the Core sample.
const SAMPLE = dests.some((d) => d.id === 'chua-cau') ? 'chua-cau' : dests[0].id;

// The board reads these groups in order. The four journey phases below ARE the
// app flow, top to bottom; the board numbers their frames 1..N and keeps them
// laid out even in compact view. The two reference catalogs (`catalog: true`)
// collapse to one representative in compact — they're the 25 sites / 5 tours,
// not steps in the flow.
// No Organizer screen and no ?staff= code in here on purpose: this file ships to
// the deployed board, and a staff code in it would be public. The board reads a
// code from its OWN url (screens.html?staff=CODE) at runtime to unlock the 🧪
// quiz reveal; nothing secret is stored here.
const groups = [
  {
    title: '1 · Onboarding',
    screens: [
      { label: 'Door (tap to enter)', path: '/?step=door' },
      { label: 'Language', path: '/?step=lang' },
      { label: 'Welcome', path: '/?step=welcome' },
      { label: 'Install app', path: '/?step=install' },
      { label: 'Location & motion', path: '/?step=perms' },
      { label: 'Scan ticket', path: '/?step=scan' },
    ],
  },
  {
    title: '2 · Plan the 5-site ticket',
    screens: [
      { label: 'Suggested sets (collapsed)', path: '/?step=recommend&open=0', map: true },
      { label: 'Suggested sets', path: '/?step=recommend', map: true },
      { label: 'Pick 1st / 2nd — map view', path: '/?step=manual&pick=first&view=map', map: true },
      { label: 'Pick last 3 — map view', path: '/?step=manual&pick=last&view=map', map: true },
      { label: 'Pick 1st / 2nd — list view', path: '/?step=manual&pick=first&view=list' },
      { label: 'Pick last 3 — list view', path: '/?step=manual&pick=last&view=list' },
      { label: 'Plan ready', path: '/?step=done', map: true },
    ],
  },
  {
    title: '3 · Walk & navigate',
    screens: [
      { label: 'Nav — needs GPS', path: `/go?set=${tours[0].id}`, map: true },
      { label: 'Nav — en route', path: `/go?set=${tours[0].id}&demo=far&idx=1`, map: true },
      { label: 'Nav — arrived', path: `/go?set=${tours[0].id}&demo=arrive&idx=1`, map: true },
      { label: 'Nav — set complete', path: `/go?set=${tours[0].id}&demo=done`, map: true },
    ],
  },
  {
    title: '4 · Location & quiz',
    screens: [
      { label: 'At a site', path: `/destinations/${SAMPLE}?demo=idle` },
      { label: 'Locating (GPS)', path: `/destinations/${SAMPLE}?demo=locating` },
      { label: 'Too far', path: `/destinations/${SAMPLE}?demo=far` },
      { label: 'GPS error', path: `/destinations/${SAMPLE}?demo=error` },
      { label: 'Quiz', path: `/destinations/${SAMPLE}?demo=quiz` },
      { label: 'Result — correct', path: `/destinations/${SAMPLE}?demo=correct` },
      { label: 'Result — wrong (cooldown)', path: `/destinations/${SAMPLE}?demo=wrong` },
      { label: 'Checked in + stamp', path: `/destinations/${SAMPLE}?demo=done` },
      { label: 'Checked in — in a tour', path: `/destinations/${SAMPLE}?demo=done&nav=${encodeURIComponent(`/go?set=${tours[0].id}`)}` },
    ],
  },
  {
    title: '5 · Collect & browse',
    screens: [
      { label: 'Passport', path: '/passport' },
      { label: 'Explore (map)', path: '/destinations', map: true },
      { label: 'Tour (route)', path: `/tours/${tours[0].id}`, map: true },
    ],
  },
  {
    // SAMPLE is already the phase-4 check-in/quiz/done frames — drop it here so the
    // catalog (and its compact first-frame) isn't a duplicate.
    catalog: true,
    title: `Every destination (${dests.length - 1}) — “Show quizzes” to reveal each quiz`,
    screens: dests
      .filter((d) => d.id !== SAMPLE)
      .map((d) => ({
        label: d.name?.vi || d.code || d.id,
        path: `/destinations/${d.id}`,
        quiz: true,
      })),
  },
  {
    // tours[0] is already the phase-4 "Tour (route)" frame — drop it here too.
    catalog: true,
    title: `Every tour (${tours.length - 1})`,
    screens: tours
      .filter((t) => t.id !== tours[0].id)
      .map((t) => ({ label: t.title?.vi || t.id, path: `/tours/${t.id}`, map: true })),
  },
];

writeFileSync(join(root, 'static/screens.json'), JSON.stringify(groups, null, 2) + '\n');
const n = groups.reduce((a, g) => a + g.screens.length, 0);
console.log(`wrote static/screens.json — ${groups.length} groups, ${n} screens`);
