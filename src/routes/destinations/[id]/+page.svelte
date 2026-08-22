<script>
  import { base } from '$app/paths';
  import { getPosition, distanceMeters } from '$lib/geo.js';
  import { pickQuestions } from '$lib/quiz.js';
  import { categoryLabel, mapsUrl, openLabel } from '$lib/util.js';
  import { hasStamp, addStamp, track, passport, prettyCode } from '$lib/passport.svelte.js';
  import { stats } from '$lib/stats.svelte.js';
  import { staff } from '$lib/staff.svelte.js';
  import { recordCell } from '$lib/research.svelte.js';
  import { POINTS, spotlightIds, stampPoints } from '$lib/score.js';
  import destinations from '$lib/data/destinations.json';
  import { t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';
  import MatCua from '$lib/components/MatCua.svelte';
  import StampPress from '$lib/components/StampPress.svelte';
  import PageShell from '$lib/components/PageShell.svelte';

  let { data } = $props();
  const dest = data.dest;

  // Quieter sites earn a bonus — this is what pulls the crowd off Chùa Cầu.
  const spotlight = $derived(spotlightIds(stats.counts, destinations).has(dest.id));
  const open = openLabel(dest);

  // Wrong answer costs this many seconds before the quiz can be re-drawn. Makes
  // tapping through all options slower than walking in and reading the sign.
  // ponytail: client-side only — the answers ship in destinations.json, so a
  // determined visitor can always read them. The real gate is that vouchers are
  // handed over by staff. Move answer-checking into functions/api/ if that changes.
  const COOLDOWN = 20;

  // idle -> locating -> (far | quiz | cooldown) -> done ; or error
  let step = $state(hasStamp(dest.id) ? 'done' : 'idle');
  let message = $state('');
  let distance = $state(0);
  let cool = $state(0);

  // quiz bank: draw 2 easy + 1 hard, answer all correctly to earn the stamp
  let questions = $state([]);
  let qIndex = $state(0);
  let missed = $state(false); // any wrong tap this visit -> no perfect bonus
  let earned = $state(0);
  let firstStamp = $state(false); // show the recovery code right after stamp #1

  async function checkIn() {
    step = 'locating';
    message = '';
    try {
      const here = await getPosition();
      recordCell(here); // anonymous foot-traffic count when consent is on (research store)
      distance = Math.round(distanceMeters(here, { lat: dest.lat, lng: dest.lng }));
      if (distance <= dest.radius) startQuiz();
      else {
        step = 'far';
        // how far off people actually are -> whether this radius needs widening
        track('gps_far', dest.id, distance);
      }
    } catch (e) {
      step = 'error';
      message = e?.code === 1 ? s('geo_denied') : s('geo_fail');
      track('gps_fail', dest.id, e?.code === 1 ? 1 : 0);
    }
  }

  function startQuiz() {
    questions = pickQuestions(dest.quizBank);
    qIndex = 0;
    message = '';
    step = 'quiz';
  }

  // Wrong answer throws the whole draw away and locks for COOLDOWN seconds, so
  // guessing costs time and the perfect-answer bonus instead of one extra tap.
  function penalize() {
    missed = true;
    cool = COOLDOWN;
    step = 'cooldown';
    const iv = setInterval(() => {
      cool -= 1;
      if (cool <= 0) {
        clearInterval(iv);
        step = 'idle';
      }
    }, 1000);
  }

  function answer(i) {
    if (i !== questions[qIndex].answer) {
      // which questions are too hard / badly worded
      track('quiz_wrong', dest.id, qIndex);
      penalize();
      return;
    }
    message = '';
    // Correct: if the question carries an explanation, show it as the payoff before
    // moving on (guessing still can't reach it — a wrong tap goes to cooldown instead).
    if (questions[qIndex].explain) step = 'explain';
    else advance();
  }

  function advance() {
    if (qIndex < questions.length - 1) {
      qIndex += 1;
      step = 'quiz';
    } else {
      earned = stampPoints({ perfect: !missed, spotlight });
      firstStamp = passport.stamps.length === 0;
      addStamp(dest.id, earned);
      step = 'done';
      // the seal lands; give the phone the thump too (no-op where unsupported)
      navigator.vibrate?.(28);
    }
  }
</script>

<PageShell title={t(dest.name)}>
  <div class="hero" style="--cat: var(--c-{dest.category})">
    <span class="watermark">{t(dest.name).charAt(0)}</span>
    <div class="eye">
      <MatCua size={104} color="var(--cat)" inner="#fbe0b8" ink="var(--cat)" spin={step === 'done'} />
    </div>
  </div>

  <span class="tag" style="background: var(--c-{dest.category})">{t(categoryLabel(dest.category))}</span>
  {#if spotlight && step !== 'done'}
    <span class="tag spot">⭐ {s('spotlight')} {s('earned', POINTS.spotlight)}</span>
  {/if}
  {#if dest.short}<p class="lead">{t(dest.short)}</p>{/if}
  <p>{t(dest.description)}</p>
  {#if dest.highlights?.length}
    <div class="highlights">
      <h2>{s('highlights')}</h2>
      <ul>
        {#each dest.highlights as h}<li>{t(h)}</li>{/each}
      </ul>
    </div>
  {/if}
  <p class="muted">
    <small>
      🕑 {#if open}<span class="open {open.status}">{open.text}</span> · {/if}{t(dest.hours)}
      <br />📍 {t(dest.address)}
    </small>
  </p>
  {#if open?.status === 'closed' && step !== 'done'}
    <div class="banner">{s('closed_warning')}</div>
  {/if}

  <a class="btn secondary" href={mapsUrl(dest)} target="_blank" rel="noopener" style="width: 100%">
    {s('directions')}
  </a>

  <div class="checkin">
    {#if step === 'done'}
      <!-- earned is only set when the stamp was won on this visit, so revisiting
           a stamped site shows the panel without re-pressing the seal -->
      {#if earned}
        <StampPress
          color="var(--c-{dest.category})"
          motif={dest.id.charCodeAt(0) % 2 ? 'spiral' : 'am-duong'}
          glyph={t(dest.name).charAt(0)}
        />
      {/if}
      <div class="success">
        {s('checkin_done')}
        {#if earned}
          <div class="pts">{s('earned', earned)}{#if !missed} · {s('perfect_bonus')}{/if}</div>
        {/if}
      </div>
      {#if firstStamp}
        <!-- First stamp = the moment the recovery code becomes worth keeping.
             Screenshotting it is the only backup that survives a cleared browser. -->
        <div class="banner keepcode">
          {s('keep_code')}
          <div class="pid">{prettyCode()}</div>
        </div>
      {/if}
      <a class="btn secondary" href="{base}/passport">{s('passport')}</a>
    {:else if step === 'cooldown'}
      <div class="banner">{s('wrong_wait', cool)}</div>
      <button class="btn" disabled style="width: 100%">{s('checkin')}</button>
    {:else if step === 'idle' || step === 'error'}
      {#if spotlight}<div class="banner spot-note">{s('spotlight_hint', POINTS.spotlight)}</div>{/if}
      {#if message}<div class="banner">{message}</div>{/if}
      <button class="btn" onclick={checkIn} style="width: 100%">{s('checkin')}</button>
      {#if staff.on}
        <button class="btn secondary" onclick={startQuiz} style="width: 100%">{s('simulate')}</button>
      {/if}
    {:else if step === 'locating'}
      <button class="btn" disabled style="width: 100%">{s('locating')}</button>
    {:else if step === 'far'}
      <div class="banner">{s('far', distance, dest.radius)}</div>
      <button class="btn" onclick={checkIn} style="width: 100%">{s('retry')}</button>
    {:else if step === 'quiz'}
      {@const q = questions[qIndex]}
      <div class="quiz">
        <p><strong>{s('arrived')}</strong></p>
        <p class="muted"><small>{s('question_of', qIndex + 1, questions.length)}</small></p>
        <p class="q">{t(q.question)}</p>
        {#if q.hint}<p class="hint">💡 {t(q.hint)}</p>{/if}
        {#if q.photo}
          <div class="photo-opts">
            {#each q.options as opt, i}
              <button class="photo-opt" onclick={() => answer(i)}>
                <img src="{base}/{q.photo[i]}" alt={t(opt)} loading="lazy" />
                <span>{t(opt)}</span>
              </button>
            {/each}
          </div>
        {:else}
          {#each q.options as opt, i}
            <button class="opt" onclick={() => answer(i)}>{t(opt)}</button>
          {/each}
        {/if}
        {#if message}<p class="muted">{message}</p>{/if}
      </div>
    {:else if step === 'explain'}
      <div class="quiz">
        <div class="banner explain">✔ {t(questions[qIndex].explain)}</div>
        <button class="btn" onclick={advance} style="width: 100%">{s('quiz_continue')}</button>
      </div>
    {/if}
  </div>
</PageShell>

<style>
  .hero {
    position: relative;
    height: 150px;
    border-radius: var(--radius);
    overflow: hidden;
    margin-bottom: 14px;
    background: linear-gradient(160deg, color-mix(in srgb, var(--cat) 10%, var(--surface)), var(--surface));
    border: 1px solid var(--line);
  }
  /* cloud-scroll capsules from the key visual */
  .hero::before, .hero::after {
    content: '';
    position: absolute;
    border-radius: 999px;
    background: var(--grad-warm);
  }
  .hero::before { top: 22px; left: -30px; width: 130px; height: 28px; opacity: 0.7; }
  .hero::after { top: 62px; left: 10px; width: 84px; height: 22px; opacity: 0.45; }
  /* the door-eye hangs where it would over a real doorway: high, slightly right */
  .hero .eye {
    position: absolute;
    top: 14px; right: 18px;
    opacity: 0.9;
    filter: drop-shadow(0 8px 14px rgba(126, 31, 19, 0.2));
  }
  .hero .watermark {
    position: absolute;
    right: 8px;
    bottom: -24px;
    font-family: var(--font-display);
    font-size: 11rem;
    font-weight: 700;
    line-height: 1;
    color: var(--cat);
    opacity: 0.16;
    user-select: none;
  }
  .checkin { margin-top: 20px; display: grid; gap: 10px; }
  .tag.spot { background: var(--gold); color: #4a2f06; margin-left: 6px; }
  .spot-note { border-color: color-mix(in srgb, var(--gold) 55%, var(--line)); }
  .pts { font-weight: 700; margin-top: 4px; }
  .keepcode .pid {
    font-family: var(--font-display);
    font-size: 1.6rem;
    letter-spacing: 0.15em;
    margin-top: 6px;
  }
  .open { font-weight: 700; }
  .open.open { color: var(--teal); }
  .open.soon { color: var(--gold); }
  .open.closed { color: var(--brand); }
  .quiz .opt {
    display: block;
    width: 100%;
    text-align: left;
    padding: 13px 16px;
    margin-bottom: 8px;
    border: 1.5px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
    font-family: var(--font-body);
    font-weight: 500;
    font-size: 1rem;
    cursor: pointer;
    transition: border-color 0.12s ease, background 0.12s ease;
  }
  .quiz .opt:hover { border-color: color-mix(in srgb, var(--brand) 45%, var(--line)); background: var(--bg); }

  /* richer content: short lead, highlights, quiz hint/photo/explain */
  .lead { font-size: 1.08rem; font-weight: 600; color: var(--brand-dark); line-height: 1.4; margin: 0 0 8px; }
  .highlights { margin: 14px 0; padding: 14px 16px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); }
  .highlights h2 {
    margin: 0 0 8px; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--brand);
  }
  .highlights ul { margin: 0; padding-left: 1.1em; display: flex; flex-direction: column; gap: 6px; }
  .highlights li { line-height: 1.4; }
  .quiz .q { font-weight: 600; }
  .hint {
    margin: -2px 0 12px; padding: 9px 12px; font-size: 0.9rem; line-height: 1.4;
    color: var(--brand-dark);
    background: color-mix(in srgb, var(--gold) 14%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--gold) 30%, var(--line));
    border-radius: var(--radius-sm);
  }
  .photo-opts { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 8px; }
  .photo-opt {
    display: flex; flex-direction: column; gap: 6px; padding: 0;
    border: 1.5px solid var(--line); border-radius: var(--radius-sm);
    background: var(--surface); overflow: hidden; cursor: pointer;
    font-family: var(--font-body); font-weight: 600; font-size: 0.9rem;
  }
  .photo-opt img { width: 100%; aspect-ratio: 3 / 2; object-fit: cover; display: block; }
  .photo-opt span { padding: 0 0 9px; }
  .photo-opt:hover { border-color: color-mix(in srgb, var(--brand) 45%, var(--line)); }
  .banner.explain { text-align: left; line-height: 1.5; margin-bottom: 12px; }
</style>
