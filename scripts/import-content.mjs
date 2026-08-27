// Content intake #2: the writers' copy (short/long intro, "don't miss", quiz) ->
// src/lib/data/destinations.json
//
//   node scripts/import-content.mjs
//
// Source is content/noi-dung.txt, one tagged block per site — paste-friendly for
// the writers, unambiguous for us:
//
//   # <destination name, as in destinations.json>
//   addr: 26 Trần Phú          (optional)
//   hours: 7:30 - 19:30        (optional)
//   S: short intro             — the map label's one-liner
//   L: long intro              — the site page's `description`
//   D: don't-miss line         — repeatable, 3 is the target
//   Q: question
//   I: image for the question   — optional, static/ path ("find THIS carving" questions)
//   A: option                  — the FIRST A of a question is the correct one
//   P: photo for that option    — optional, one per A, in the same order (static/ path)
//   E: explanation             — optional, shown on the quiz result screen
//
// Every question ships and gets asked, in the order written: no draw, no
// easy/hard tiers, nothing generated to pad a short bank.
//
// Re-runnable: only Vietnamese comes from the file. Every `en` is looked up by its
// VI string in the JSON already on disk, so translations done once survive a
// re-import; a VI string that changed loses its EN and is reported, not guessed.
// Sites missing from the file keep whatever they have.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEST = join(root, 'src/lib/data/destinations.json');
const SRC = join(root, 'content/noi-dung.txt');

// Names the writers use that don't match destinations.json character for character.
const ALIAS = {
  'hoi quan phuoc kien': 'hoi-quan-phuc-kien',
  'diem tham quan trinh dien nghe xi ma': 'trinh-nghe-xi-ma'
};
const norm = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function blocks(text) {
  const out = [];
  let cur = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('# ')) {
      cur = { name: line.slice(2).trim(), S: [], L: [], D: [], Q: [] };
      out.push(cur);
      continue;
    }
    if (!cur) continue;
    const m = /^(addr|hours|S|L|D|Q|I|A|P|E):\s*(.*)$/.exec(line);
    if (!m) { console.warn(`skipped untagged line: ${line.slice(0, 60)}`); continue; }
    const [, tag, val] = m;
    if (tag === 'addr' || tag === 'hours') cur[tag] = val;
    else if (tag === 'Q') cur.Q.push({ q: val, a: [], p: [], e: '', i: '' });
    else if (tag === 'I') { const q = cur.Q.at(-1); if (q) q.i = val; }
    else if (tag === 'A') cur.Q.at(-1)?.a.push(val);
    else if (tag === 'P') cur.Q.at(-1)?.p.push(val);
    else if (tag === 'E') { const q = cur.Q.at(-1); if (q) q.e = q.e ? `${q.e} ${val}` : val; }
    else cur[tag].push(val);
  }
  return out;
}

const dests = JSON.parse(readFileSync(DEST, 'utf8'));

// vi -> the whole shipped translation object for that string. Keyed by VI and
// carrying EVERY language, not just en: the eight locales are imported separately
// (scripts/i18n-import.mjs) and a re-run here must not truncate them back to vi/en.
const EN = new Map();
(function harvest(o) {
  if (Array.isArray(o)) o.forEach(harvest);
  else if (o && typeof o === 'object') {
    if (typeof o.vi === 'string' && typeof o.en === 'string' && !EN.has(o.vi.trim())) EN.set(o.vi.trim(), o);
    Object.values(o).forEach(harvest);
  }
})(dests);

const missing = [];
const bi = (vi) => {
  const v = vi.trim();
  const hit = EN.get(v);
  if (!hit?.en) missing.push(v);
  return { ...hit, vi: v, en: hit?.en ?? '' };
};

// hand-written translations for VI strings that aren't in the JSON yet; the file is
// consumed once — after a successful run the pairs live in destinations.json.
try {
  const fresh = JSON.parse(readFileSync(join(root, 'content/en-new.json'), 'utf8'));
  for (const [vi, en] of Object.entries(fresh)) if (en) EN.set(vi.trim(), { ...EN.get(vi.trim()), en });
} catch { /* no pending translations */ }

const byName = new Map(dests.map((d) => [norm(d.name.vi), d]));
const byId = new Map(dests.map((d) => [d.id, d]));
const sites = blocks(readFileSync(SRC, 'utf8'));
let done = 0;

sites.forEach((s, i) => {
  const key = norm(s.name);
  const d = byName.get(key) ?? byId.get(ALIAS[key]);
  if (!d) { console.error(`no destination matches "${s.name}" — fix the name or add an ALIAS`); process.exitCode = 1; return; }
  done++;

  if (s.addr) d.address = bi(s.addr);
  if (s.hours) d.hours = { vi: s.hours, en: s.hours };
  if (s.S[0]) d.short = bi(s.S[0]);
  if (s.L[0]) d.description = bi(s.L[0]);
  if (s.D.length) d.highlights = s.D.map(bi);

  // a block with no Q at all keeps whatever bank is on file — the writers' copy and
  // the quiz for a site don't have to arrive together
  if (s.Q.length) d.quizBank = s.Q.map((q, j) => {
    const opts = q.a.filter(Boolean);
    const at = (i + j) % opts.length; // correct answer moves around, never always first
    // the correct option (and its photo) lands at `at`; one shuffle used for both,
    // so a picture can never drift onto another answer
    const shuffle = (arr) => { const o = arr.slice(1).reverse(); o.splice(at, 0, arr[0]); return o; };
    const item = { question: bi(q.q), options: shuffle(opts).map(bi), answer: at };
    if (q.i) item.image = q.i;
    if (q.p.length === opts.length) item.photo = shuffle(q.p);
    else if (q.p.length) console.error(`"${q.q.slice(0, 40)}…" has ${q.p.length} P for ${opts.length} A — photos dropped`);
    if (q.e) item.explain = bi(q.e);
    return item;
  });
});

if (missing.length) {
  const uniq = [...new Set(missing)];
  console.error(`\n${uniq.length} VI strings have no English yet — nothing written.`);
  console.error('Translate these (they land in destinations.json as { vi, en }):\n');
  uniq.forEach((m) => console.error(`  - ${m}`));
  writeFileSync(join(root, 'content/need-en.json'), `${JSON.stringify(uniq, null, 1)}\n`);
  process.exit(1);
}

writeFileSync(DEST, `${JSON.stringify(dests, null, 2)}\n`);
console.log(`import-content.mjs ok — ${done} sites, ${sites.reduce((n, s) => n + s.Q.length, 0)} questions`);
