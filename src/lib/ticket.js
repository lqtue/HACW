// A Hội An ticket admits a *fixed mix* of site classes, not any N of 25.
// Every destination carries `ticketClass`: 'monument' | 'museum' | 'other'
// (separate from its display `category`). The recipe is minimums, not an exact
// split — the "free" slots may be any class, including a second monument.
//
//   5-site: ≥1 of 3 monuments + ≥1 of 6 museums + 3 free  (total 5)
//   3-site: any 3
//
// ponytail: the 3-site recipe is "any 3" — the printed ticket states no class
// minimum. Add minimums to TICKETS (data, not code) if the organiser sets them.

// The Hội An ticket's QR is a Vietnamese e-invoice lookup. Confirmed from a real 2026
// ticket: it prints "https://tracuuhddt7…com.vn" + lookup code "EBL0226T1490955889", so
// the QR resolves to a `tracuuhddt…` invoice-portal URL (host is the stable token). We
// can't read WHICH sites it admits (see TicketScan) — but before deriving a recovery
// code from a scan we reject QRs that clearly aren't a ticket, so a poster / wifi /
// vCard QR doesn't mint a garbage passport code.
// `tracuuhddt` is the verified marker; the rest stay as resilience across invoice-
// provider batches. ponytail: narrow to the exact host if a batch ever collides.
const INVOICE_HINT = /(tracuuhddt|hoadon|hddt|e-?invoice|invoice|tra[-_]?cuu)/i;

/** Does a scanned QR string look like a Hội An ticket (not some other QR)? */
export function isTicketQr(raw) {
  if (typeof raw !== 'string') return false;
  const s = raw.trim();
  if (s.length < 8 || /\s/.test(s)) return false; // too short, or free text with spaces
  // other well-known QR payload kinds — definitely not a ticket
  if (/^(WIFI:|BEGIN:|mailto:|tel:|smsto?:|geo:|matmsg:)/i.test(s)) return false;
  // a URL passes only if it points at an invoice lookup; any other site is not a ticket
  if (/^https?:\/\//i.test(s)) return INVOICE_HINT.test(s);
  // otherwise a bare invoice code: alphanumeric with a few code separators
  return /^[A-Za-z0-9][A-Za-z0-9._-]{7,}$/.test(s);
}

/** size -> { size, min: { class: minCount } } */
export const TICKETS = {
  5: { size: 5, min: { monument: 1, museum: 1 } },
  3: { size: 3, min: {} }
};

/**
 * Read a Hội An ticket's printed lookup code. Confirmed from 2026 tickets:
 *
 *   EBL0226T 14 90955889
 *   └ batch  │  └ serial (runs continuously)
 *            └ ticket type: 14 = 5-site, 15 = 3-site
 *
 * The QR encodes the invoice-portal URL with the same code in it, so scanning
 * and typing the code both land here. Everything before the type digits varies
 * by invoice batch, so only the `T<type><serial>` tail is matched.
 *
 * @param {string} raw  a scanned QR payload or a typed lookup code
 * @returns {{ code: string, size: number, serial: string } | null}
 */
const TYPE_SIZE = { 14: 5, 15: 3 };
export function parseTicket(raw) {
  if (typeof raw !== 'string') return null;
  const m = /T(1[45])(\d{6,})/i.exec(raw.trim());
  if (!m) return null;
  const [, type, serial] = m;
  return { code: `T${type}${serial}`.toUpperCase(), size: TYPE_SIZE[type], serial };
}

/** How many sites this ticket admits; 5 when the code can't be read. */
export const ticketSize = (raw) => parseTicket(raw)?.size ?? 5;

/** @param {string[]} stopIds @param {Record<string,any>} byId */
function classCounts(stopIds, byId) {
  const c = { monument: 0, museum: 0, other: 0 };
  for (const id of stopIds) {
    const cls = byId[id]?.ticketClass;
    if (cls === 'monument' || cls === 'museum') c[cls]++;
    else c.other++; // unknown class counts as free — size check still catches junk
  }
  return c;
}

/**
 * Does this ordered stop list satisfy the TICKETS[size] recipe?
 * @param {string[]} stopIds
 * @param {any[]|Record<string,any>} destinations  full list or an id->dest map
 * @param {number} size
 * @returns {boolean}
 */
export function isValidSet(stopIds, destinations, size = 5) {
  const recipe = TICKETS[size];
  if (!recipe) return false;
  if (!Array.isArray(stopIds) || stopIds.length !== recipe.size) return false;
  if (new Set(stopIds).size !== stopIds.length) return false; // no repeated stop
  const byId = Array.isArray(destinations)
    ? Object.fromEntries(destinations.map((d) => [d.id, d]))
    : destinations;
  if (stopIds.some((id) => !byId[id])) return false; // unknown id
  const c = classCounts(stopIds, byId);
  return Object.entries(recipe.min).every(([cls, n]) => c[cls] >= n);
}
