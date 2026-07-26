<script>
  import { base } from '$app/paths';
  import { getPosition, distanceMeters } from '$lib/geo.js';
  import { pickQuestions } from '$lib/quiz.js';
  import { categoryLabel, mapsUrl, openLabel } from '$lib/util.js';
  import { hasStamp, addStamp, track, passport, prettyCode } from '$lib/passport.svelte.js';
  import { stats } from '$lib/stats.svelte.js';
  import { staff } from '$lib/staff.svelte.js';
  import { POINTS, spotlightIds, stampPoints } from '$lib/score.js';
  import destinations from '$lib/data/destinations.json';
  import { t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';

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
    if (qIndex < questions.length - 1) {
      qIndex += 1;
    } else {
      earned = stampPoints({ perfect: !missed, spotlight });
      firstStamp = passport.stamps.length === 0;
      addStamp(dest.id, earned);
      step = 'done';
    }
  }
</script>

<div class="topbar"><h1>{t(dest.name)}</h1></div>

<div class="page">
  <div class="hero" style="--cat: var(--c-{dest.category})">
    <span class="watermark">{t(dest.name).charAt(0)}</span>
  </div>

  <span class="tag" style="background: var(--c-{dest.category})">{t(categoryLabel(dest.category))}</span>
  {#if spotlight && step !== 'done'}
    <span class="tag spot">⭐ {s('spotlight')} {s('earned', POINTS.spotlight)}</span>
  {/if}
  <p>{t(dest.description)}</p>
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
      <div class="quiz">
        <p><strong>{s('arrived')}</strong></p>
        <p class="muted"><small>{s('question_of', qIndex + 1, questions.length)}</small></p>
        <p>{t(questions[qIndex].question)}</p>
        {#each questions[qIndex].options as opt, i}
          <button class="opt" onclick={() => answer(i)}>{t(opt)}</button>
        {/each}
        {#if message}<p class="muted">{message}</p>{/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .hero {
    position: relative;
    height: 150px;
    border-radius: var(--radius);
    overflow: hidden;
    margin-bottom: 14px;
    background:
      radial-gradient(140% 120% at 85% -10%, color-mix(in srgb, var(--cat) 55%, transparent), transparent 60%),
      linear-gradient(160deg, color-mix(in srgb, var(--cat) 22%, var(--surface)), var(--surface));
    border: 1px solid var(--line);
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
  .open.soon { color: #a4620e; }
  .open.closed { color: var(--brand); }
  .success {
    background: #e6f4ea;
    border: 1px solid #a8d8b9;
    color: #1e6b34;
    border-radius: 12px;
    padding: 12px;
    font-weight: 600;
  }
  .quiz .opt {
    display: block;
    width: 100%;
    text-align: left;
    padding: 12px 16px;
    margin-bottom: 8px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    font-family: var(--font-body);
    font-size: 1rem;
    cursor: pointer;
  }
</style>
