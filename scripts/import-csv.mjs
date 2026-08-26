// Content intake: survey-team CSV (Google Sheets export) -> src/lib/data/*.json
//
//   node scripts/import-csv.mjs            # use coords baked in COORDS below
//   node scripts/import-csv.mjs --resolve  # also follow the Maps short links for fresh coords
//
// Re-runnable: hand-authored fields that the sheet doesn't carry (id, category,
// English copy, quiz banks) live in META here / in the existing JSON and survive
// a re-import. The sheet owns address, hours, traffic, priority, VI intro text.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(root, 'src/lib/data');
const CSV_SITES = join(root, 'content/csv/diem-tham-quan.csv');
const CSV_TICKETS = join(root, 'content/csv/diem-ban-ve.csv');

// --- tiny CSV reader (RFC4180 quotes + embedded newlines) ------------------
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift().map((h) => h.trim());
  return rows
    .filter((r) => r.some((v) => v.trim()))
    .map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

// --- hand-authored side of each site, keyed by the sheet's "Mã" ------------
const META = {
  A1: { id: 'chua-cau', category: 'di-tich', en: 'Japanese Covered Bridge',
    enDesc: "A wooden bridge built by Japanese merchants in the early 17th century — the architectural symbol and soul of Hoi An's old town." },
  A2: { id: 'chua-quan-am', category: 'di-tich', en: 'Quan Am Pagoda',
    enDesc: 'A Buddhist pagoda on Tran Phu street dedicated to Quan Am (Guanyin), the bodhisattva of compassion.' },
  A3: { id: 'mieu-quan-cong', category: 'di-tich', en: 'Quan Cong Temple',
    enDesc: 'Also called Chua Ong, built in 1653 to worship Quan Cong (Guan Yu), a symbol of loyalty and righteousness.' },
  A4: { id: 'bao-tang-gom-su-mau-dich', category: 'bao-tang', en: 'Museum of Trade Ceramics',
    enDesc: "Displays trade-ceramic artifacts from the 8th–18th centuries, evidence of Hoi An's role as an international port." },
  A5: { id: 'bao-tang-hoi-an', category: 'bao-tang', en: 'Hoi An Museum',
    enDesc: 'The general museum of the town: Sa Huynh, Champa and trading-port periods through to the modern city.' },
  A6: { id: 'bao-tang-sa-huynh', category: 'bao-tang', en: 'Sa Huynh Culture Museum',
    enDesc: 'Burial jars, jewellery and tools of the Sa Huynh culture that lived here more than 2,000 years ago.' },
  A7: { id: 'bao-tang-van-hoa-dan-gian', category: 'bao-tang', en: 'Museum of Folk Culture',
    enDesc: 'A large two-storey wooden house showing the crafts, folk arts and everyday life of Hoi An.' },
  A8: { id: 'bao-tang-nghe-y', category: 'bao-tang', en: 'Museum of Traditional Medicine',
    enDesc: 'Traditional Vietnamese medicine: herb cabinets, scales, prescriptions and a reconstructed apothecary.' },
  A9: { id: 'bao-tang-tho-san', category: 'bao-tang', en: 'Museum of Local Products',
    enDesc: 'Local produce and specialities of Quang Nam, and the river trade that carried them to the port.' },
  A10: { id: 'nha-trung-bay-nhat-ban', category: 'bao-tang', en: 'Japanese Culture Exhibition House',
    enDesc: 'Exhibition on the Japanese quarter of old Hoi An and the archaeology of Japanese trade in the town.' },
  A11: { id: 'nha-bieu-dien-nghe-thuat', category: 'trai-nghiem', en: 'Traditional Art Performance House',
    enDesc: 'Stage for traditional music, bai choi singing and folk dance performances.' },
  A12: { id: 'nha-tho-toc-tran', category: 'nha-co', en: 'Tran Family Chapel',
    enDesc: 'A 200-year-old family worship house built by a mandarin of the Tran clan, set in a walled garden.' },
  A13: { id: 'nha-tho-toc-nguyen-tuong', category: 'nha-co', en: 'Nguyen Tuong Family Chapel',
    enDesc: 'Ancestral chapel of the Nguyen Tuong clan, a family of mandarins and writers.' },
  A14: { id: 'nha-co-phung-hung', category: 'nha-co', en: 'Phung Hung Old House',
    enDesc: 'A two-storey merchant house blending Vietnamese, Japanese and Chinese carpentry, still lived in by the family.' },
  A15: { id: 'nha-co-quan-thang', category: 'nha-co', en: 'Quan Thang Ancient House',
    enDesc: 'A small, finely carved house of Chinese-Fujian style, over 150 years old.' },
  A16: { id: 'nha-co-duc-an', category: 'nha-co', en: 'Duc An Old House',
    enDesc: 'A house that was a bookshop and a meeting point of early 20th-century patriots.' },
  A17: { id: 'nha-co-tan-ky', category: 'nha-co', en: 'Tan Ky Old House',
    enDesc: 'A 200-year-old house blending Vietnamese, Japanese and Chinese architecture, the first recognised national heritage house.' },
  A18: { id: 'hoi-quan-quang-trieu', category: 'hoi-quan', en: 'Cantonese Assembly Hall',
    enDesc: 'Also known as the Guangdong hall, famous for its ceramic mosaics and carved wood and stone columns.' },
  A19: { id: 'hoi-quan-phuc-kien', category: 'hoi-quan', en: 'Fujian Assembly Hall',
    enDesc: 'The largest and most ornate assembly hall, dedicated to Thien Hau, protector goddess of seafaring merchants.' },
  A20: { id: 'hoi-quan-hai-nam', category: 'hoi-quan', en: 'Hainan Assembly Hall',
    enDesc: 'Built by the Hainan community in memory of 108 merchants lost at sea in 1851.' },
  A21: { id: 'hoi-quan-trieu-chau', category: 'hoi-quan', en: 'Teochew Assembly Hall',
    enDesc: 'Chaozhou community hall renowned for its wood carving and porcelain-inlay decoration.' },
  A22: { id: 'dinh-cam-pho', category: 'di-tich', en: 'Cam Pho Communal House',
    enDesc: 'The communal house of Cam Pho village, where the tutelary gods of the old settlement are worshipped.' },
  A23: { id: 'tuy-tien-duong-minh-huong', category: 'di-tich', en: 'Minh Huong Communal House',
    enDesc: 'Worship house of the Minh Huong community — Chinese settlers who became Vietnamese citizens.' },
  A24: { id: 'dinh-hoi-an', category: 'di-tich', en: 'Hoi An Communal House',
    enDesc: 'Communal house on Le Loi street, a village worship site inside the old town.' },
  A25: { id: 'trinh-nghe-xi-ma', category: 'trai-nghiem', en: 'Xi Ma Craft Demonstration',
    enDesc: 'Live demonstration of xi ma — the black sesame sweet soup that is a Hoi An street-food institution.' }
};

// Place coordinates (!3d/!4d) resolved from the sheet's Google Maps links.
// approx: no link in the sheet -> estimated from street numbering / the nearest
// ticket point. Must be re-surveyed on site before launch.
const COORDS = {
  A1: [15.8770873, 108.3260704], A2: [15.8776398, 108.3314233], A3: [15.8775421, 108.3313724],
  A4: [15.8772894, 108.3295509], A5: [15.8802686, 108.3294629], A6: [15.8768419, 108.3263413],
  A7: [15.8765833, 108.3298399], A8: [15.8766736, 108.329857], A9: [15.87735, 108.32995],
  A10: [15.8771789, 108.3257066], A11: [15.87645, 108.32966], A12: [15.8786558, 108.3287955],
  A13: [15.8775334, 108.3256375], A14: [15.8771915, 108.3258009], A15: [15.8771093, 108.3292184],
  A16: [15.87705, 108.3272], A17: [15.8764821, 108.3277659], A18: [15.8771518, 108.3265642],
  A19: [15.8774847, 108.3306281], A20: [15.8776513, 108.3320041], A21: [15.8778422, 108.3330722],
  A22: [15.8782399, 108.3240582], A23: [15.8776512, 108.3319927], A24: [15.877972, 108.328667],
  A25: [15.8806, 108.3302]
};
const APPROX = new Set(['A9', 'A11', 'A16', 'A24', 'A25']);

// --- helpers ---------------------------------------------------------------
const LEVEL = { Cao: 'high', 'Trung bình': 'medium', Thấp: 'low' };
const level = (v) => LEVEL[v.trim()] ?? null;

// First paragraph of the sheet's intro text, cut at a sentence boundary.
function intro(text, max = 300) {
  const p = text.split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim();
  if (p.length <= max) return p;
  const cut = p.slice(0, max);
  const dot = cut.lastIndexOf('. ');
  return (dot > 120 ? cut.slice(0, dot + 1) : cut.trimEnd() + '…');
}

// "15°52'39.2\"N 108°19'26.3\"E" or "15.8782, 108.3253" -> [lat, lng]
function coords(text) {
  const dms = [...text.matchAll(/(\d+)°(\d+)'([\d.]+)"([NSEW])/g)];
  if (dms.length === 2) {
    return dms.map(([, d, m, s, hem]) => {
      const v = +d + +m / 60 + +s / 3600;
      return +((hem === 'S' || hem === 'W' ? -v : v).toFixed(6));
    });
  }
  const dec = text.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  return dec ? [+(+dec[1]).toFixed(6), +(+dec[2]).toFixed(6)] : null;
}

// Follow a maps.app.goo.gl short link and read the place coordinate out of it.
async function resolve(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const m = decodeURIComponent(res.url).match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    return m ? [+m[1], +m[2]] : null;
  } catch {
    return null;
  }
}

// --- quiz: keep hand-written banks, otherwise generate from the row itself --
// Generated questions only assert what the sheet says (street, category, hours),
// so they are never wrong — but they are dull. Replace them as real content lands.
const CATS = JSON.parse(readFileSync(join(DATA, 'categories.json'), 'utf8'));

// "10B Trần Hưng Đạo" / "45/17 đường Trần Hưng Đạo" / "Cuối đường NTMK" -> street name
function street(address) {
  return address
    .replace(/^\s*(số\s*)?\d+[\dA-Za-z/.-]*\s*,?\s*/i, '')
    .replace(/^\s*(cuối|đầu|trên|dọc)\s+/i, '')
    .replace(/^\s*đường\s+/i, '')
    .replace(/,.*$/, '')
    .trim();
}

function distractors(pool, correct, n = 2) {
  const others = [...new Set(pool)].filter((v) => v && v !== correct);
  const out = [];
  // deterministic pick (stable diffs): spread across the pool
  for (let i = 0; out.length < n && i < others.length; i += Math.max(1, Math.floor(others.length / n))) {
    out.push(others[i]);
  }
  return out;
}

function shuffleWithAnswer(correct, wrong, seed) {
  const opts = [correct, ...wrong];
  const at = seed % opts.length; // deterministic position, not always index 0
  opts.splice(at, 0, opts.splice(0, 1)[0]);
  return { options: opts, answer: at };
}

function generateBank(row, meta, allStreets, allHours, index) {
  const bank = [];
  const st = street(row['Địa chỉ']);
  const name = { vi: row['Điểm'], en: meta.en };
  if (st) {
    const { options, answer } = shuffleWithAnswer(st, distractors(allStreets, st), index);
    bank.push({
      difficulty: 'easy',
      generated: true,
      question: { vi: `${name.vi} nằm trên đường nào?`, en: `Which street is ${name.en} on?` },
      options: options.map((v) => ({ vi: v, en: v })),
      answer
    });
  }
  const cat = CATS.find((c) => c.id === meta.category);
  if (cat) {
    const wrong = CATS.filter((c) => c.id !== cat.id).slice(0, 2);
    const { options, answer } = shuffleWithAnswer(cat, wrong, index + 1);
    bank.push({
      difficulty: 'easy',
      generated: true,
      question: { vi: `${name.vi} thuộc nhóm điểm đến nào?`, en: `Which kind of site is ${name.en}?` },
      options: options.map((c) => c.label),
      answer
    });
  }
  const hours = row['Giờ mở cửa'].replace(/\s+/g, ' ').trim();
  if (hours && hours !== 'N/A') {
    const { options, answer } = shuffleWithAnswer(hours, distractors(allHours, hours), index + 2);
    bank.push({
      difficulty: 'hard',
      generated: true,
      question: { vi: `Giờ mở cửa của ${name.vi} là?`, en: `What are the opening hours of ${name.en}?` },
      options: options.map((v) => ({ vi: v, en: v })),
      answer
    });
  }
  return bank;
}

// --- build destinations.json ----------------------------------------------
const rows = parseCsv(readFileSync(CSV_SITES, 'utf8'));
const existing = Object.fromEntries(
  JSON.parse(readFileSync(join(DATA, 'destinations.json'), 'utf8')).map((d) => [d.id, d])
);

const allStreets = rows.map((r) => street(r['Địa chỉ'])).filter(Boolean);
const allHours = rows.map((r) => r['Giờ mở cửa'].replace(/\s+/g, ' ').trim()).filter((h) => h && h !== 'N/A');

const resolveLinks = process.argv.includes('--resolve');
const destinations = [];

for (const [i, row] of rows.entries()) {
  const code = row['Mã'];
  const meta = META[code];
  if (!meta) {
    console.warn(`! no META for ${code} (${row['Điểm']}) — skipped`);
    continue;
  }
  const prev = existing[meta.id] ?? {};
  let latlng = COORDS[code];
  if (resolveLinks && row['Maps'].startsWith('http')) {
    const fresh = await resolve(row['Maps'].trim());
    if (fresh) latlng = fresh;
    else console.warn(`! could not resolve link for ${code}`);
  }
  const hours = row['Giờ mở cửa'].replace(/\s+/g, ' ').trim();
  const viDesc = row['Thông tin giới thiệu cơ bản'].trim();

  destinations.push({
    id: meta.id,
    code,
    name: { vi: row['Điểm'], en: meta.en },
    category: meta.category,
    lat: latlng[0],
    lng: latlng[1],
    radius: prev.radius ?? 75,
    ...(prev.closed ? { closed: true } : {}),
    // approximate coordinate -> shows up in the organizer survey checklist
    ...(APPROX.has(code) ? { needsSurvey: true } : {}),
    address: {
      vi: row['Địa chỉ'] || 'Khu phố cổ Hội An',
      en: row['Địa chỉ'] || 'Hoi An Ancient Town'
    },
    hours: hours && hours !== 'N/A'
      ? { vi: hours, en: hours }
      : { vi: 'Liên hệ ban tổ chức', en: 'Check with organisers' },
    // sheet-reported footfall + promo priority -> drives the balancing boost
    traffic: level(row['Traffic']) ?? 'medium',
    promoPriority: level(row['Ưu tiên về quảng bá']) ?? 'medium',
    description: {
      vi: viDesc ? intro(viDesc) : (prev.description?.vi ?? meta.enDesc),
      en: prev.description?.en ?? meta.enDesc
    },
    quizBank: prev.quizBank?.length && !prev.quizBank[0].generated
      ? prev.quizBank
      : generateBank(row, meta, allStreets, allHours, i)
  });
}

writeFileSync(join(DATA, 'destinations.json'), JSON.stringify(destinations, null, 2) + '\n');

// --- build ticket-points.json ---------------------------------------------
// Sheet rows with an empty "Định vị" cell — coordinate taken from the address.
const TICKET_COORDS = { V332: [15.8802686, 108.3294629] }; // 10B Trần Hưng Đạo (= Bảo tàng Hội An)

const tickets = [];
for (const row of parseCsv(readFileSync(CSV_TICKETS, 'utf8'))) {
  const ll = coords(row['Định vị']) ?? TICKET_COORDS[row['Điểm']];
  if (!ll) {
    console.warn(`! ticket point ${row['Điểm']} has no coordinate — skipped`);
    continue;
  }
  tickets.push({
    id: row['Điểm'],
    lat: ll[0],
    lng: ll[1],
    where: { vi: row['Vị trí (theo tuyến đường)'], en: row['Vị trí (theo tuyến đường)'] }
  });
}
writeFileSync(join(DATA, 'ticket-points.json'), JSON.stringify(tickets, null, 2) + '\n');

// Two sites closer than this can't be told apart by GPS — the quiz still gates
// the stamp, but the survey team should double-check the pins.
for (let i = 0; i < destinations.length; i++) {
  for (let j = i + 1; j < destinations.length; j++) {
    const a = destinations[i], b = destinations[j];
    const m = Math.hypot((a.lat - b.lat) * 111320, (a.lng - b.lng) * 111320 * Math.cos(a.lat * Math.PI / 180));
    if (m < 20) console.warn(`! ${a.code}/${b.code} are ${Math.round(m)} m apart (${a.id} / ${b.id})`);
  }
}

const generated = destinations.filter((d) => d.quizBank[0]?.generated).length;
console.log(
  `destinations: ${destinations.length} (${generated} with generated quizzes, ` +
  `${destinations.filter((d) => d.needsSurvey).length} needing a coordinate survey)\n` +
  `ticket points: ${tickets.length}`
);
