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

// Typeof check is not decoration: this also guards the /api/passport pid, and a
// JSON body can put an array here, which a bare .test() would happily coerce.
export const isValidCode = (code) =>
  typeof code === 'string' && /^[0-9A-HJKMNP-TV-Z]{8}$/.test(code);
