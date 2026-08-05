<script>
  import event from '$lib/data/event.json';
  import { base } from '$app/paths';
  import { passport } from '$lib/passport.svelte.js';
  import destinations from '$lib/data/destinations.json';
  import tours from '$lib/data/tours.json';
  import { breakdown } from '$lib/score.js';
  import { t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';
  import InstallApp from '$lib/components/InstallApp.svelte';
  import MatCua from '$lib/components/MatCua.svelte';

  const total = destinations.length;
  const count = $derived(passport.stamps.length);
  const score = $derived(breakdown(passport.stamps, tours, total));
  const pct = $derived(Math.round((count / total) * 100));
</script>

<!-- Key visual as a header: scallop trim, cloud-scroll capsules, oxblood display
     type over the peach→pink gradient. Replaces the generic .topbar here only. -->
<header class="hero">
  <div class="scallop"></div>
  <div class="deco" aria-hidden="true">
    <span class="cap c1"></span>
    <span class="cap c2"></span>
    <!-- the door-eye is the mark of the whole app; the capsules stay behind it -->
    <div class="eye"><MatCua size={132} spin color="var(--brand)" inner="#fbd9a8" /></div>
  </div>

  <p class="lockup">Hội An Creative Week {event.year}</p>
  <p class="kicker">{s('journey')}</p>
  <h1>{event.title} <span class="year">{event.year}</span></h1>
  <p class="tagline">{t(event.tagline)}</p>

  <div class="when">
    <span class="date">{event.dates}</span>
    <span class="venue">{t(event.venue)}</span>
  </div>
</header>

<div class="page">
  <p>{t(event.intro)}</p>

  <a class="progress" href="{base}/passport">
    <div class="row">
      <strong>{s('collected', count, total)}</strong>
      <span class="pts">{score.total} {s('points')}</span>
    </div>
    <div class="bar"><i style="width: {pct}%"></i></div>
    <small class="more">{s('view_passport')}</small>
  </a>

  <h2>{s('how_it_works')}</h2>
  <ol class="steps">
    {#each event.howItWorks as step, i}
      <li>
        <span class="num">{String(i + 1).padStart(2, '0')}</span>
        <span>{t(step)}</span>
      </li>
    {/each}
  </ol>
  <p class="muted"><small>{t(event.note)}</small></p>

  <div class="cta">
    <a class="btn" href="{base}/destinations">{s('open_map')}</a>
    <a class="btn secondary" href="{base}/tours">{s('see_tours')}</a>
  </div>

  <InstallApp />
</div>

<style>
  .hero {
    position: relative;
    overflow: hidden;
    padding: 26px 18px 24px;
    padding-top: max(26px, calc(env(safe-area-inset-top) + 26px));
    background:
      radial-gradient(120% 80% at 100% 0%, #fde3c9 0%, transparent 60%),
      linear-gradient(160deg, #fdeada, #fbdcd3 70%, #f9d3cb);
    border-bottom: 1px solid var(--line);
  }
  .hero .scallop { position: absolute; inset: 0 0 auto 0; }

  /* the small English lockup that sits in the poster's top-left corner */
  .lockup {
    margin: 6px 0 14px;
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--brand-mid);
    opacity: 0.75;
  }
  .kicker { margin: 0 0 2px; font-weight: 700; font-size: 0.95rem; color: var(--brand-mid); }
  .hero h1 {
    margin: 0;
    font-size: clamp(2rem, 10.5vw, 2.8rem);
    line-height: 0.98;
    text-transform: uppercase;
    max-width: 9ch;
  }
  .hero h1 .year { font-size: 0.34em; vertical-align: super; letter-spacing: 0; }
  .tagline { margin: 10px 0 0; font-weight: 600; color: var(--brand); max-width: 20ch; }

  .when {
    display: grid;
    gap: 4px;
    margin-top: 18px;
    padding-left: 12px;
    border-left: 3px solid var(--brand);
  }
  .when .date { font-family: var(--font-display); font-weight: 800; font-size: 1.15rem; color: var(--brand-dark); }
  .when .venue { font-size: 0.85rem; max-width: 26ch; }

  /* cloud-scroll capsules, then the mắt cửa sitting on them like it sits on a lintel */
  .deco { position: absolute; inset: 0; pointer-events: none; }
  .deco .cap { position: absolute; border-radius: 999px; }
  .c1 { top: 52px; right: -46px; width: 158px; height: 34px; background: var(--grad-warm); opacity: 0.8; }
  .c2 { top: 96px; right: -18px; width: 112px; height: 30px; background: linear-gradient(90deg, #f7a879, #ef7a48); opacity: 0.6; }
  .eye { position: absolute; top: 96px; right: -18px; opacity: 0.92; filter: drop-shadow(0 10px 18px rgba(126, 31, 19, 0.18)); }

  /* stamps + points in one tap target, since both live on the passport */
  .progress {
    display: block;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 13px 15px;
    margin: 16px 0 4px;
    box-shadow: var(--shadow);
  }
  .progress .row { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
  .progress .pts { color: var(--brand); font-weight: 800; white-space: nowrap; }
  .progress .bar {
    margin-top: 10px;
    height: 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--brand) 12%, var(--bg));
    overflow: hidden;
  }
  .progress .bar i { display: block; height: 100%; border-radius: 999px; background: var(--grad-brand); }
  .progress .more { display: block; margin-top: 8px; color: var(--brand); font-weight: 700; font-size: 0.8rem; }

  /* numbered steps, as on the event's own infographics */
  .steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
  .steps li { display: flex; gap: 12px; align-items: flex-start; line-height: 1.5; }
  .steps .num {
    flex: 0 0 auto;
    width: 34px; height: 34px;
    display: grid; place-items: center;
    border-radius: 12px;
    background: var(--grad-brand);
    color: #fff;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 0.85rem;
  }

  .cta { display: flex; gap: 10px; margin-top: 22px; flex-wrap: wrap; }
  .cta .btn { flex: 1 1 auto; }
</style>
