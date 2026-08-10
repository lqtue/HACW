<script>
  import event from '$lib/data/event.json';
  import { base } from '$app/paths';
  import { passport } from '$lib/passport.svelte.js';
  import destinations from '$lib/data/destinations.json';
  import tours from '$lib/data/tours.json';
  import { breakdown } from '$lib/score.js';
  import { t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';
  import { fingerprint } from '$lib/fingerprint.js';
  import InstallApp from '$lib/components/InstallApp.svelte';
  import MatCua from '$lib/components/MatCua.svelte';

  const total = destinations.length;
  const count = $derived(passport.stamps.length);
  const score = $derived(breakdown(passport.stamps, tours, total));
  const pct = $derived(Math.round((count / total) * 100));
</script>

<!-- The home screen is the cover of a creative passport: masthead lockup, a
     serial like a real travel document, the tagline pressed in fingerprinted
     ink (chạm = touch), and the visitor's own stamp count as the first seal. -->
<header class="hero">
  <span class="strip" aria-hidden="true"></span>
  <span class="eave" aria-hidden="true"></span>

  <div class="masthead">
    <span class="lockup">
      <b>Hội An</b> Creative Week {event.year}
      <span class="fieldlabel">Tuần lễ sáng tạo · phố cổ Hội An</span>
    </span>
    <span class="serial">
      N° {event.year}
      <span class="fieldlabel">Hộ chiếu sáng tạo</span>
    </span>
  </div>

  <p class="eyebrow"><span class="dot"></span> {s('journey')} · <span class="yr">{event.dates}</span></p>
  <h1>{event.title} <span class="year">{event.year}</span></h1>
  <p class="creed fp" use:fingerprint>{t(event.tagline)}</p>
  <p class="sub">{t(event.subtitle)}</p>

  <div class="when">
    <span class="date">{event.dates}</span>
    <span class="venue">{t(event.venue)}</span>
  </div>
</header>

<div class="page">
  <!-- the visitor's passport, as the first thing after the cover: their own
       seal, painted once the first stamp exists -->
  <a class="progress paper framed" href="{base}/passport">
    <span class="pseal">
      <MatCua size={62} ghost={count === 0} color="var(--brand)" inner={count ? '#fbe0b8' : 'transparent'} ink="var(--brand)" />
    </span>
    <span class="pcopy">
      <span class="fieldlabel">{s('passport_title')}</span>
      <strong class="pcount">{count}<span>/{total}</span></strong>
      <span class="pmeta">{s('tally_stamps', count)} · <b>{score.total} {s('points')}</b></span>
    </span>
    <span class="pbar"><i style="width: {pct}%"></i></span>
    <span class="pgo">{s('view_passport')}</span>
  </a>

  <p class="intro">{t(event.intro)}</p>

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

  {#if event.programme?.length}
    <h2>{t(event.programmeTitle)}</h2>
    <ul class="programme">
      {#each event.programme as ev}
        <li>
          <span class="when-cell">
            <strong class="d">{ev.date}</strong>
            <small class="tm">{ev.time}</small>
          </span>
          <span class="ptitle">{t(ev.title)}</span>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="cta">
    <a class="btn" href="{base}/destinations">{s('open_map')}</a>
    <a class="btn secondary" href="{base}/tours">{s('see_tours')}</a>
  </div>

  <InstallApp />
</div>

<style>
  /* ---- the passport cover: full-bleed, grained, roof-tile eave ---- */
  .hero {
    position: relative;
    overflow: hidden;
    padding: 30px 20px 24px;
    padding-top: max(34px, calc(env(safe-area-inset-top) + 28px));
    border-bottom: 1px solid var(--line);
    background:
      radial-gradient(120% 80% at 100% 0%, #fde3c9 0%, transparent 58%),
      linear-gradient(158deg, #fdeada, #fbdcd3 72%, #f9d3cb);
  }
  .hero::before {
    content: '';
    position: absolute; inset: 0; z-index: 0; pointer-events: none;
    background-image: var(--grain); background-size: 180px 180px;
    opacity: 0.4; mix-blend-mode: multiply;
  }
  .hero > * { position: relative; z-index: 1; }
  .hero .strip { position: absolute; inset: 0 0 auto 0; height: 3px; z-index: 2; background: var(--grad-strip); }
  .hero .eave { top: 3px; z-index: 2; }

  /* padding-right keeps the serial clear of the fixed language button */
  .masthead { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px;
    margin: 6px 0 20px; padding-right: 46px; }
  .lockup { font-family: var(--font-display); font-weight: 800; font-size: 0.9rem; color: var(--brand-dark);
    line-height: 1.1; display: block; }
  .lockup b { color: var(--brand); }
  .lockup .fieldlabel { display: block; margin-top: 5px; font-weight: 600; }
  .serial { text-align: right; font-family: var(--font-display); font-weight: 800; font-size: 0.92rem;
    color: var(--brand-dark); line-height: 1.1; white-space: nowrap; }
  .serial .fieldlabel { display: block; margin-top: 5px; }

  .eyebrow { margin: 0 0 8px; }
  .eyebrow .yr { color: var(--brand); }
  .hero h1 { font-size: clamp(1.8rem, 8vw, 2.5rem); line-height: 0.98; text-transform: uppercase; max-width: 11ch; margin: 0; }
  .hero h1 .year { font-size: 0.34em; vertical-align: super; letter-spacing: 0; }

  /* the tagline, pressed in fingerprinted ink */
  .creed {
    margin: 12px 0 0;
    font-family: var(--font-display);
    font-weight: 800;
    text-transform: uppercase;
    font-size: clamp(1.1rem, 4.6vw, 1.5rem);
    line-height: 1.05;
    letter-spacing: -0.01em;
    color: var(--brand-dark);
    max-width: 16ch;
  }
  .sub { margin: 12px 0 0; font-weight: 500; color: var(--ink); opacity: 0.82; max-width: 30ch; }

  .when { display: grid; gap: 4px; margin-top: 20px; padding-left: 12px; border-left: 3px solid var(--brand); }
  .when .date { font-family: var(--font-display); font-weight: 800; font-size: 1.15rem; color: var(--brand-dark); }
  .when .venue { font-size: 0.85rem; max-width: 28ch; color: var(--muted); }

  /* ---- passport progress ---- */
  .progress {
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-areas: 'seal copy go' 'bar bar bar';
    align-items: center;
    gap: 6px 14px;
    padding: 14px 16px;
    margin: 4px 0 6px;
  }
  .progress .pseal { grid-area: seal; display: grid; place-items: center; transform: rotate(-5deg); }
  .progress .pcopy { grid-area: copy; display: grid; gap: 2px; }
  .progress .pcount { font-family: var(--font-display); font-weight: 800; font-size: 1.9rem; line-height: 1;
    color: var(--brand-dark); }
  .progress .pcount span { color: var(--muted); font-size: 0.55em; }
  .progress .pmeta { font-size: 0.8rem; color: var(--muted); }
  .progress .pmeta b { color: var(--brand); font-weight: 700; }
  .progress .pgo { grid-area: go; align-self: center; color: var(--brand); font-weight: 700; font-size: 0.8rem; white-space: nowrap; }
  .progress .pbar { grid-area: bar; height: 7px; border-radius: 999px; margin-top: 8px;
    background: color-mix(in srgb, var(--brand) 12%, var(--bg)); overflow: hidden; }
  .progress .pbar i { display: block; height: 100%; border-radius: 999px; background: var(--grad-brand); }

  .intro { margin-top: 14px; }

  /* numbered steps — a real sequence, so the numbering carries order */
  .steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
  .steps li { display: flex; gap: 12px; align-items: flex-start; line-height: 1.5; }
  .steps .num {
    flex: 0 0 auto; width: 34px; height: 34px; display: grid; place-items: center;
    border-radius: 12px; background: var(--grad-brand); color: #fff;
    font-family: var(--font-display); font-weight: 800; font-size: 0.85rem;
  }

  /* the five-programme schedule as a hairline index */
  .programme { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; }
  .programme li { display: flex; gap: 14px; align-items: baseline; padding: 12px 0; border-top: 1px solid var(--line); }
  .programme li:last-child { border-bottom: 1px solid var(--line); }
  .when-cell { flex: 0 0 auto; width: 82px; display: grid; gap: 2px; }
  .when-cell .d { font-family: var(--font-display); font-weight: 800; color: var(--brand-dark); font-size: 1.05rem; }
  .when-cell .tm { color: var(--muted); font-size: 0.72rem; white-space: nowrap; }
  .programme .ptitle { line-height: 1.45; }

  .cta { display: flex; gap: 10px; margin-top: 22px; flex-wrap: wrap; }
  .cta .btn { flex: 1 1 auto; }
</style>
