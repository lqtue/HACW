// Pure passport backup helpers — no runes, no $app imports, so they can be
// unit-tested in node. Losing stamps is the one failure this app must not have,
// so restore always *merges*: it can add, never remove.

/** Union of two stamp lists. Earliest visit time and best points win. */
export function mergeStamps(local, incoming) {
  const out = local.map((s) => ({ ...s }));
  for (const s of incoming ?? []) {
    if (!s?.id) continue;
    const mine = out.find((x) => x.id === s.id);
    if (!mine) out.push({ id: s.id, at: s.at, pts: s.pts ?? 10 });
    else {
      if (s.at && (!mine.at || s.at < mine.at)) mine.at = s.at;
      if ((s.pts ?? 0) > (mine.pts ?? 0)) mine.pts = s.pts;
    }
  }
  return out;
}

/** Whole-passport union, as stored server-side. Same rule: add, never remove. */
export function mergeSnapshots(prev, next) {
  return {
    v: 1,
    pid: next.pid,
    stamps: mergeStamps(prev?.stamps ?? [], next.stamps ?? []),
    redeemed: [...new Set([...(prev?.redeemed ?? []), ...(next.redeemed ?? [])])]
  };
}

export function encodeSnapshot(snapshot) {
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_');
}

/** Accepts a raw payload or a whole `#r=...` fragment. Returns null if unusable. */
export function decodeSnapshot(text) {
  const payload = /[#&]r=([A-Za-z0-9\-_=]+)/.exec(text ?? '')?.[1] ?? text;
  if (!payload) return null;
  try {
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const obj = JSON.parse(new TextDecoder().decode(bytes));
    return Array.isArray(obj?.stamps) ? obj : null;
  } catch {
    return null;
  }
}

/** 8-char Crockford base32 (no I/L/O/U) — readable aloud at a ticket counter. */
export function normalizeCode(code) {
  return (code ?? '').replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
}

// Crockford base32 alphabet — same as newPid() in passport, and exactly the set
// isValidCode() accepts (no I/L/O/U).
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Derive a stable 8-char recovery code from a scanned ticket string. The ticket
 * QR is a Vietnamese e-invoice code (e.g. "EBL0226T1490955889") — too long and
 * with letters isValidCode rejects — so we hash it into the code format instead.
 * Same ticket → same code → re-scanning on a new device restores (merge-only).
 * 64-bit FNV-1a for spread, then 40 bits → 8 base32 chars.
 * @returns {string} an 8-char code, or '' for empty input
 */
export function codeFromTicket(raw) {
  const s = normalizeCode(raw);
  if (!s) return '';
  const mask = (1n << 64n) - 1n;
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < s.length; i++) {
    h = ((h ^ BigInt(s.charCodeAt(i))) * 0x100000001b3n) & mask;
  }
  let out = '';
  for (let i = 0; i < 8; i++) {
    out = CROCKFORD[Number(h & 31n)] + out;
    h >>= 5n;
  }
  return out;
}

// Typeof check is not decoration: this also guards the /api/passport pid, and a
// JSON body can put an array here, which a bare .test() would happily coerce.
export const isValidCode = (code) =>
  typeof code === 'string' && /^[0-9A-HJKMNP-TV-Z]{8}$/.test(code);
