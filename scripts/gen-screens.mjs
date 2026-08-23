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
      { label: 'Home', path: '/' },
      { label: 'Explore (map)', path: '/destinations', map: true },
      { label: 'Tours', path: '/tours' },
      { label: 'Passport', path: '/passport' },
    ],
  },
  {
    title: `Destinations (${dests.length}) — "Show quizzes" (needs screens.html?staff=CODE)`,
    screens: dests.map((d) => ({
      label: d.name?.vi || d.code || d.id,
      path: `/destinations/${d.id}`,
      quiz: true,
    })),
  },
  {
    title: `Tours (${tours.length})`,
    screens: tours.map((t) => ({ label: t.title?.vi || t.id, path: `/tours/${t.id}`, map: true })),
  },
];

writeFileSync(join(root, 'static/screens.json'), JSON.stringify(groups, null, 2) + '\n');
const n = groups.reduce((a, g) => a + g.screens.length, 0);
console.log(`wrote static/screens.json — ${groups.length} groups, ${n} screens`);
