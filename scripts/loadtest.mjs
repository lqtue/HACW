// Load test for the only two things that can be overloaded: the check-in
// counter and the passport backup. Everything else is static files on a CDN.
//
//   node scripts/loadtest.mjs http://localhost:5175 --users 50 --seconds 10
//   node scripts/loadtest.mjs https://hacw.pages.dev --users 200 --seconds 30
//
// Each virtual user behaves like a real visitor: mostly POSTs a small batch of
// check-ins, backs its passport up now and then, and occasionally an organizer
// refreshes the dashboard (the expensive read).
//
// ponytail: no ramp-up curve, no scenario DSL, no HTML report. Fixed
// concurrency and percentiles answer "does it hold up?"; add k6 if it doesn't.

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? def : Number(args[i + 1]);
};
const url = (args.find((a) => a.startsWith('http')) ?? 'http://localhost:5173').replace(/\/$/, '');
const USERS = flag('users', 50);
const SECONDS = flag('seconds', 10);

const SITES = [
  'chua-cau', 'chua-quan-am', 'mieu-quan-cong', 'bao-tang-gom-su-mau-dich', 'bao-tang-hoi-an',
  'bao-tang-sa-huynh', 'bao-tang-van-hoa-dan-gian', 'bao-tang-nghe-y', 'bao-tang-tho-san',
  'nha-trung-bay-nhat-ban', 'nha-bieu-dien-nghe-thuat', 'nha-tho-toc-tran',
  'nha-tho-toc-nguyen-tuong', 'nha-co-phung-hung', 'nha-co-quan-thang', 'nha-co-duc-an',
  'nha-co-tan-ky', 'hoi-quan-quang-trieu', 'hoi-quan-phuc-kien', 'hoi-quan-hai-nam',
  'hoi-quan-trieu-chau', 'dinh-cam-pho', 'tuy-tien-duong-minh-huong', 'dinh-hoi-an',
  'trinh-nghe-xi-ma'
];
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const pid = () => Array.from({ length: 8 }, () => ALPHABET[(Math.random() * 32) | 0]).join('');
const pick = () => SITES[(Math.random() * SITES.length) | 0];

/** @type {Record<string, {ms: number[], errors: number, statuses: Record<number, number>}>} */
const stats = {};
async function timed(label, run) {
  const s = (stats[label] ??= { ms: [], errors: 0, statuses: {} });
  const t0 = performance.now();
  try {
    const res = await run();
    s.statuses[res.status] = (s.statuses[res.status] ?? 0) + 1;
    if (!res.ok) s.errors++;
    await res.arrayBuffer(); // drain, or keep-alive sockets stall
  } catch {
    s.errors++;
  }
  s.ms.push(performance.now() - t0);
}

const json = (path, method, body) =>
  fetch(url + path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

async function user(id, until) {
  const me = pid();
  const stamps = [];
  while (performance.now() < until) {
    const site = pick();
    stamps.push({ id: site, at: new Date().toISOString(), pts: 10 });

    await timed('POST /api/checkin', () => json('/api/checkin', 'POST', { events: [{ id: site, at: Date.now() }] }));
    await timed('PUT  /api/passport', () => json('/api/passport', 'PUT', { v: 1, pid: me, stamps, redeemed: [] }));
    // one visitor in twenty is an organizer with the dashboard open
    if (id % 20 === 0) await timed('GET  /api/checkin', () => fetch(`${url}/api/checkin`));
  }
}

const pct = (arr, p) => (arr.length ? arr.sort((a, b) => a - b)[Math.floor((arr.length - 1) * p)] : 0);

console.log(`${url} — ${USERS} concurrent users for ${SECONDS}s\n`);
const t0 = performance.now();
await Promise.all(Array.from({ length: USERS }, (_, i) => user(i, t0 + SECONDS * 1000)));
const elapsed = (performance.now() - t0) / 1000;

let total = 0;
for (const [label, s] of Object.entries(stats)) {
  total += s.ms.length;
  console.log(
    `${label.padEnd(20)} n=${String(s.ms.length).padStart(6)} ` +
      `${(s.ms.length / elapsed).toFixed(0).padStart(5)}/s  ` +
      `p50 ${pct(s.ms, 0.5).toFixed(1).padStart(7)} ms  ` +
      `p95 ${pct(s.ms, 0.95).toFixed(1).padStart(7)} ms  ` +
      `p99 ${pct(s.ms, 0.99).toFixed(1).padStart(7)} ms  ` +
      `errors ${s.errors}  ${JSON.stringify(s.statuses)}`
  );
}
console.log(`\ntotal ${total} requests in ${elapsed.toFixed(1)}s = ${(total / elapsed).toFixed(0)} req/s`);
