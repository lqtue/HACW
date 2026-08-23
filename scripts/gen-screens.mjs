// Build static/screens.json — the screen list the /screens.html board reads.
// Covers every destination + every tour, so the board stays in sync with the
// data. Re-run after editing destinations.json / tours.json.
//   node scripts/gen-screens.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (f) => JSON.parse(readFileSync(join(root, 'src/lib/data', f), 'utf8'));
const dests = (d => d.destinations || d)(load('destinations.json'));
const tours = (t => t.tours || t)(load('tours.json'));
// iconic, real (non-generated) quiz bank, has landmark art — the Core sample.
const SAMPLE = dests.some((d) => d.id === 'chua-cau') ? 'chua-cau' : dests[0].id;

const groups = [
  {
    // No Organizer screen and no ?staff= code in here on purpose: this file ships
    // to the deployed board, and a staff code in it would be public. The board
    // reads a code from its OWN url (screens.html?staff=CODE) at runtime to unlock
    // the 🧪 quiz reveal for maintainers; nothing secret is stored here.
    title: 'Core',
    screens: [
      { label: 'Welcome (lang)', path: '/?step=welcome' },
      { label: 'Scan ticket', path: '/?step=scan' },
      { label: 'Gợi ý (suggested sets)', path: '/?step=recommend', map: true },
      { label: 'Pick my own', path: '/?step=manual', map: true },
      { label: 'Travel plan (ready)', path: '/?step=done', map: true },
      { label: 'Routing (nav)', path: `/go?set=${tours[0].id}`, map: true },
      { label: 'Destination (check-in)', path: `/destinations/${SAMPLE}?demo=idle` },
      { label: 'Quiz', path: `/destinations/${SAMPLE}?demo=quiz` },
      { label: 'Checked in', path: `/destinations/${SAMPLE}?demo=done` },
      { label: 'Explore (map)', path: '/destinations', map: true },
      { label: 'Tour (route)', path: `/tours/${tours[0].id}`, map: true },
      { label: 'Passport', path: '/passport' },
    ],
  },
  {
    // SAMPLE is already the Core check-in/quiz/done frames — drop it here so the
    // catalog (and its compact first-frame) isn't a duplicate.
    title: `Destinations (${dests.length - 1}) — "Show quizzes" (needs screens.html?staff=CODE)`,
    screens: dests
      .filter((d) => d.id !== SAMPLE)
      .map((d) => ({
        label: d.name?.vi || d.code || d.id,
        path: `/destinations/${d.id}`,
        quiz: true,
      })),
  },
  {
    // tours[0] is already the Core "Tour (route)" frame — drop it here too.
    title: `Tours (${tours.length - 1})`,
    screens: tours
      .filter((t) => t.id !== tours[0].id)
      .map((t) => ({ label: t.title?.vi || t.id, path: `/tours/${t.id}`, map: true })),
  },
];

writeFileSync(join(root, 'static/screens.json'), JSON.stringify(groups, null, 2) + '\n');
const n = groups.reduce((a, g) => a + g.screens.length, 0);
console.log(`wrote static/screens.json — ${groups.length} groups, ${n} screens`);
