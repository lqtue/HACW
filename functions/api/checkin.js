// Cloudflare Pages Function — the app's only server code.
// Counts check-ins per destination in a KV namespace bound as CHECKINS.
// Bind it in the Pages project (Settings → Functions → KV bindings), name: CHECKINS.

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  const events = body?.events;
  if (!Array.isArray(events)) return json({ error: 'events[] required' }, 400);

  if (env.CHECKINS) {
    for (const e of events) {
      if (!e?.id) continue;
      const key = `count:${e.id}`;
      // ponytail: KV read-modify-write isn't atomic; fine for rough event tallies.
      // Move to D1 or a Durable Object counter if you need exact concurrent-safe counts.
      const cur = parseInt((await env.CHECKINS.get(key)) ?? '0', 10);
      await env.CHECKINS.put(key, String(cur + 1));
    }
  }
  return json({ ok: true, counted: events.length });
}

// Organizer view: GET /api/checkin -> { "<destId>": <count> }
export async function onRequestGet({ env }) {
  if (!env.CHECKINS) return json({});
  const out = {};
  const list = await env.CHECKINS.list({ prefix: 'count:' });
  for (const k of list.keys) {
    out[k.name.slice('count:'.length)] = parseInt((await env.CHECKINS.get(k.name)) ?? '0', 10);
  }
  return json(out);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
