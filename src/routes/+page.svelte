<script>
  import event from '$lib/data/event.json';
  import { base } from '$app/paths';
  import { passport, prettyCode, hasStamp, setHolder } from '$lib/passport.svelte.js';
  import destinations from '$lib/data/destinations.json';
  import tours from '$lib/data/tours.json';
  import rewards from '$lib/data/rewards.json';
  import { breakdown, tierFor } from '$lib/score.js';
  import { i18n, t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';
  import { fingerprint } from '$lib/fingerprint.js';
  import InstallApp from '$lib/components/InstallApp.svelte';
  import MatCua from '$lib/components/MatCua.svelte';
  import StampPress from '$lib/components/StampPress.svelte';

  const total = destinations.length;
  const count = $derived(passport.stamps.length);
  const score = $derived(breakdown(passport.stamps, tours, total));
  const pct = $derived(Math.round((count / total) * 100));
  const rank = $derived(tierFor(score.total, rewards));
  const en = $derived(i18n.lang === 'en');

  // The hero display is the tagline minus its "Hành trình" lead-in (that becomes
  // the kicker), split on "Chạm" so each touch-word wears the fingerprint. In EN
  // there is no touch-word, so it renders as one clean plain part.
  const heroLine = $derived(t(event.tagline).replace(/^\s*Hành trình[\s,–—-]*/i, '').trim());
  const heroParts = $derived(heroLine.split(/(Chạm)/i));
  const isTouch = (p) => /^chạm$/i.test(p);

  // The seal on the identity page is a demonstration of the check-in ritual, not
  // a real stamp — real stamps are earned on-site by GPS. Pressing shows how it
  // will feel, then points at the map. It never touches passport.stamps.
  let demoed = $state(false);
  let demoKey = $state(0);
  function demo() {
    demoed = true;
    demoKey += 1;
  }
</script>

<div class="doc">
  <!-- ================= COVER ================= -->
  <header class="cover">
    <span class="strip" aria-hidden="true"></span>
    <span class="eave" aria-hidden="true"></span>

    <div class="masthead">
      <span class="lockup">
        <b>Hội An</b> Creative Week {event.year}
        <span class="fieldlabel">{event.title} {event.year}</span>
      </span>
      <span class="serial">
        N° {event.year}
        <span class="fieldlabel">{en ? 'Creative passport' : 'Hộ chiếu sáng tạo'}</span>
      </span>
    </div>

    <p class="eyebrow"><span class="dot"></span> {en ? 'Heritage journey' : 'Hành trình di sản'} · <span class="yr">28/8 – 1/9</span></p>
    <p class="kicker">{en ? 'The journey' : 'Hành trình'}</p>
    <h1 class="hero-line">{#each heroParts as p}{#if isTouch(p)}<span class="fp" use:fingerprint>{p}</span>{:else}{p}{/if}{/each}</h1>

    <div class="when">
      <span class="date">{event.dates}</span>
      <span class="venue">{t(event.venue)}</span>
    </div>
  </header>

  <!-- ================= PAGE 01 · holder & seal ================= -->
  <section class="pp paper framed">
    <div class="pp-head">
      <span class="fieldlabel">{en ? 'Holder' : 'Chủ hộ chiếu'}</span>
      <span class="pageno">01</span>
    </div>

    <dl class="idgrid">
      <div class="field span holder">
        <dt class="fieldlabel">{en ? 'Holder name' : 'Tên chủ sở hữu'}</dt>
        <dd>
          <input
            class="holderinput"
            value={passport.holder}
            oninput={(e) => setHolder(e.currentTarget.value)}
            placeholder={en ? 'Tap to add your name' : 'Chạm để nhập tên của bạn'}
            maxlength="28"
            autocomplete="name"
            aria-label={en ? 'Holder name' : 'Tên chủ sở hữu'}
          />
        </dd>
      </div>
      <div class="field span">
        <dt class="fieldlabel">{en ? 'Passport no.' : 'Số hộ chiếu'}</dt>
        <dd class="mono">{prettyCode()}</dd>
      </div>
      <div class="field">
        <dt class="fieldlabel">{en ? 'Stamps' : 'Tem đã đóng'}</dt>
        <dd>{count}<span class="of">/{total}</span></dd>
      </div>
      <div class="field">
        <dt class="fieldlabel">{s('points')}</dt>
        <dd>{score.total}</dd>
      </div>
      <div class="field span">
        <dt class="fieldlabel">{s('rank')}</dt>
        <dd class="rank">{rank ? `${rank.icon} ${t(rank.title)}` : (en ? 'Not yet earned' : 'Chưa có danh hiệu')}</dd>
      </div>
    </dl>

    <!-- the seal ritual -->
    <div class="stampframe">
      <div class="pad">
        {#if demoed}
          {#key demoKey}<StampPress color="var(--brand)" glyph="H" size={104} />{/key}
        {:else}
          <span class="ghostseal"><MatCua size={104} ghost color="var(--brand)" inner="transparent" ink="var(--brand)" /></span>
        {/if}
      </div>
      <p class="seal-hint">
        {#if demoed}
          {en ? 'That is a stamp. Earn 25 real ones on-site.' : 'Đó là một con dấu. Đến 25 điểm để đóng dấu thật.'}
        {:else}
          {en ? 'Every site you reach presses a seal like this.' : 'Mỗi điểm đến sẽ đóng cho bạn một con dấu như thế này.'}
        {/if}
      </p>
      <div class="seal-actions">
        <button class="btn secondary" onclick={demo}>{demoed ? (en ? 'Stamp again' : 'Đóng dấu lại') : (en ? 'Try the seal' : 'Chạm thử con dấu')}</button>
        <a class="btn" href="{base}/destinations">{en ? 'Start stamping →' : 'Bắt đầu đóng dấu →'}</a>
      </div>
    </div>
  </section>

  <!-- ================= PAGE 02 · the journey ================= -->
  <section class="pp paper framed">
    <div class="pp-head">
      <span class="fieldlabel">{en ? 'The journey' : 'Trang hành trình'}</span>
      <span class="pageno">02</span>
    </div>

    <a class="journey" href="{base}/passport">
      <div class="strip25" aria-hidden="true">
        {#each destinations as d}
          {@const got = hasStamp(d.id)}
          <span class="node" style="--cat: var(--c-{d.category})">
            <MatCua size={26} ghost={!got} color="var(--cat)" inner={got ? '#fbe0b8' : 'transparent'} ink="var(--cat)" />
          </span>
        {/each}
      </div>
      <div class="jbar"><i style="width: {pct}%"></i></div>
      <div class="jfoot">
        <strong>{count}<span class="of">/{total}</span> {en ? 'stamps' : 'tem'}</strong>
        <span class="jgo">{s('view_passport')}</span>
      </div>
    </a>
  </section>

  <!-- ================= PAGE 03 · how it works ================= -->
  <section class="pp paper framed">
    <div class="pp-head">
      <span class="fieldlabel">{en ? 'How it works' : 'Hướng dẫn'}</span>
      <span class="pageno">03</span>
    </div>
    <p class="lede">{t(event.intro)}</p>
    <ol class="steps">
      {#each event.howItWorks as step, i}
        <li>
          <span class="num">{String(i + 1).padStart(2, '0')}</span>
          <span>{t(step)}</span>
        </li>
      {/each}
    </ol>
    <p class="muted note"><small>{t(event.note)}</small></p>
  </section>

  <!-- ================= PAGE 04 · programme ================= -->
  {#if event.programme?.length}
    <section class="pp paper framed">
      <div class="pp-head">
        <span class="fieldlabel">{t(event.programmeTitle)}</span>
        <span class="pageno">04</span>
      </div>
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
    </section>
  {/if}

  <!-- ================= foot ================= -->
  <div class="foot">
    <InstallApp />
    <p class="muted"><small>{s('offline_ok')}</small></p>
  </div>
</div>

<style>
  /* the whole page is one document; pages stack like a passport being flipped */
  .doc { display: flex; flex-direction: column; }

  /* ---- COVER ---- */
  .cover {
    position: relative;
    overflow: hidden;
    padding: 32px 20px 26px;
    padding-top: max(36px, calc(env(safe-area-inset-top) + 30px));
    border-bottom: 1px solid var(--line);
    background:
      radial-gradient(120% 80% at 100% 0%, #fde3c9 0%, transparent 58%),
      linear-gradient(158deg, #fdeada, #fbdcd3 72%, #f9d3cb);
  }
  .cover::before {
    content: ''; position: absolute; inset: 0; z-index: 0; pointer-events: none;
    background-image: var(--grain); background-size: 180px 180px; opacity: 0.4; mix-blend-mode: multiply;
  }
  .cover > * { position: relative; z-index: 1; }
  .cover .strip { position: absolute; inset: 0 0 auto 0; height: 3px; z-index: 2; background: var(--grad-strip); }
  .cover .eave { top: 3px; z-index: 2; }

  .masthead { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; margin: 6px 0 20px; padding-right: 46px; }
  .lockup { font-family: var(--font-display); font-weight: 800; font-size: 0.9rem; color: var(--brand-dark); line-height: 1.1; display: block; }
  .lockup b { color: var(--brand); }
  .lockup .fieldlabel { display: block; margin-top: 5px; }
  .serial { text-align: right; font-family: var(--font-display); font-weight: 800; font-size: 0.92rem; color: var(--brand-dark); line-height: 1.1; white-space: nowrap; }
  .serial .fieldlabel { display: block; margin-top: 5px; }

  .eyebrow { margin: 4px 0 14px; }
  .eyebrow .yr { color: var(--brand); }
  .kicker { margin: 0 0 2px; font-family: var(--font-display); font-weight: 800; text-transform: uppercase;
    color: var(--brand); font-size: clamp(1.05rem, 3.4vw, 1.45rem); letter-spacing: 0.02em; }
  /* the tagline as the hero display, with the fingerprint pressed into "Chạm" */
  .hero-line {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 800;
    text-transform: uppercase;
    color: var(--brand-dark);
    font-size: clamp(2rem, 9.2vw, 3.05rem);
    line-height: 0.94;
    letter-spacing: -0.015em;
    max-width: 13ch;
    text-wrap: balance;
  }
  .hero-line .fp { display: inline; }
  .when { display: grid; gap: 4px; margin-top: 24px; padding-left: 12px; border-left: 3px solid var(--brand); }
  .when .date { font-family: var(--font-display); font-weight: 800; font-size: 1.15rem; color: var(--brand-dark); }
  .when .venue { font-size: 0.85rem; max-width: 28ch; color: var(--muted); }

  /* ---- a passport page ---- */
  .pp {
    margin: 14px 14px 0;
    padding: 16px 16px 18px;
  }
  /* perforated top edge + tear notches, so pages read as bound leaves */
  .pp { border-top: 2px dashed color-mix(in srgb, var(--brand-dark) 18%, transparent); }
  .pp-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px; }
  .pageno { font-family: var(--font-display); font-weight: 800; font-size: 0.9rem; color: color-mix(in srgb, var(--brand-dark) 40%, transparent);
    font-variant-numeric: tabular-nums; }

  /* ---- identity fields ---- */
  .idgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 0 0 18px; }
  .field { display: grid; gap: 3px; padding: 10px 12px; background: color-mix(in srgb, var(--bg) 60%, transparent);
    border: 1px solid var(--line); border-radius: 12px; }
  .field.span { grid-column: 1 / -1; }
  .field dd { margin: 0; font-family: var(--font-display); font-weight: 800; font-size: 1.5rem; color: var(--brand-dark); line-height: 1; }
  .field dd.mono { letter-spacing: 0.14em; font-size: 1.3rem; }
  .field dd.rank { font-size: 1.05rem; }
  .field .of { color: var(--muted); font-size: 0.6em; }
  /* editable holder line — reads as a filled-in passport field */
  .holderinput {
    width: 100%;
    border: 0;
    background: none;
    padding: 2px 0 3px;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.3rem;
    color: var(--brand-dark);
    border-bottom: 2px dashed color-mix(in srgb, var(--brand-dark) 25%, transparent);
  }
  .holderinput::placeholder { color: var(--muted); font-weight: 700; font-size: 0.95rem; opacity: 0.75; }
  .holderinput:focus { outline: none; border-bottom-color: var(--brand); border-bottom-style: solid; }

  /* ---- the seal ritual ---- */
  .stampframe { display: grid; justify-items: center; gap: 12px; padding: 16px 0 4px;
    border-top: 1px solid var(--line); }
  .pad {
    position: relative; width: 190px; height: 190px; display: grid; place-items: center;
    border-radius: 50%;
    background: radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--brand) 10%, transparent), transparent 62%);
  }
  .pad::before { content: ''; position: absolute; inset: 8%; border-radius: 50%;
    border: 2px dashed color-mix(in srgb, var(--brand-dark) 20%, transparent); }
  .ghostseal { animation: bob 4s ease-in-out infinite; }
  @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
  @media (prefers-reduced-motion: reduce) { .ghostseal { animation: none; } }
  .seal-hint { margin: 0; text-align: center; color: var(--muted); font-size: 0.86rem; max-width: 28ch; }
  .seal-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; width: 100%; }
  .seal-actions .btn { flex: 1 1 auto; }

  /* ---- journey strip ---- */
  .journey { display: block; }
  .strip25 { display: flex; flex-wrap: wrap; gap: 5px; justify-content: center; }
  .node { display: grid; place-items: center; }
  .jbar { height: 8px; border-radius: 999px; margin: 16px 0 10px; overflow: hidden;
    background: color-mix(in srgb, var(--brand) 12%, var(--bg)); }
  .jbar i { display: block; height: 100%; border-radius: 999px; background: var(--grad-brand); }
  .jfoot { display: flex; justify-content: space-between; align-items: baseline; }
  .jfoot strong { font-family: var(--font-display); font-weight: 800; color: var(--brand-dark); font-size: 1.1rem; }
  .jfoot .of { color: var(--muted); font-size: 0.7em; }
  .jgo { color: var(--brand); font-weight: 700; font-size: 0.82rem; }

  /* ---- how it works ---- */
  .lede { margin: 0 0 14px; }
  .steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
  .steps li { display: flex; gap: 12px; align-items: flex-start; line-height: 1.5; }
  .steps .num { flex: 0 0 auto; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 12px;
    background: var(--grad-brand); color: #fff; font-family: var(--font-display); font-weight: 800; font-size: 0.85rem; }
  .note { margin: 14px 0 0; }

  /* ---- programme ---- */
  .programme { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; }
  .programme li { display: flex; gap: 14px; align-items: baseline; padding: 12px 0; border-top: 1px solid var(--line); }
  .programme li:first-child { border-top: 0; padding-top: 0; }
  .when-cell { flex: 0 0 auto; width: 82px; display: grid; gap: 2px; }
  .when-cell .d { font-family: var(--font-display); font-weight: 800; color: var(--brand-dark); font-size: 1.05rem; }
  .when-cell .tm { color: var(--muted); font-size: 0.72rem; white-space: nowrap; }
  .ptitle { line-height: 1.45; }

  /* ---- foot ---- */
  .foot { padding: 22px 18px 8px; }
</style>
