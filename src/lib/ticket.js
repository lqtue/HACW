// A Hội An ticket admits a *fixed mix* of site classes, not any N of 25.
// Every destination carries `ticketClass`: 'monument' | 'museum' | 'other'
// (separate from its display `category`). The recipe is minimums, not an exact
// split — the "free" slots may be any class, including a second monument.
//
//   5-site: ≥1 of 3 monuments + ≥1 of 6 museums + 3 free  (total 5)
//   3-site: ≥1 of 3 monuments + 2 free                    (total 3)
//
// ponytail: 5-site is what the UI wires today; the 3-site recipe is here so
// wiring it later is data, not code. No per-visitor ticket state yet.

export const TICKET_CLASSES = ['monument', 'museum', 'other'];

// The Hội An ticket's QR is a Vietnamese e-invoice lookup (a tra-cứu-hóa-đơn URL or a
// bare invoice code like "EBL0226T1490955889"). We can't read WHICH sites it admits
// (see TicketScan) — but before deriving a recovery code from a scan we should at
// least reject QRs that clearly aren't a ticket, so a poster / wifi / vCard QR doesn't
// mint a garbage passport code.
// ponytail: shape check, not an exact match — the real host/prefix isn't pinned. Once a
// genuine ticket QR is captured, tighten INVOICE_HINT to that literal.
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
  3: { size: 3, min: { monument: 1 } }
};

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
