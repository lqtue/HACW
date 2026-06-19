<script>
  import { base } from '$app/paths';
  import { getPosition, distanceMeters } from '$lib/geo.js';
  import { pickQuestions } from '$lib/quiz.js';
  import { categoryLabel, mapsUrl } from '$lib/util.js';
  import { hasStamp, addStamp } from '$lib/passport.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';

  let { data } = $props();
  const dest = data.dest;

  // ponytail: flip to false for production to remove the test bypass below.
  const SIMULATE = true;

  // idle -> locating -> (far | quiz) -> done ; or error
  let step = $state(hasStamp(dest.id) ? 'done' : 'idle');
  let message = $state('');
  let distance = $state(0);

  // quiz bank: draw 2 easy + 1 hard, answer all correctly to earn the stamp
  let questions = $state([]);
  let qIndex = $state(0);

  async function checkIn() {
    step = 'locating';
    message = '';
    try {
      const here = await getPosition();
      distance = Math.round(distanceMeters(here, { lat: dest.lat, lng: dest.lng }));
      if (distance <= dest.radius) startQuiz();
      else step = 'far';
    } catch (e) {
      step = 'error';
      message = e?.code === 1 ? s('geo_denied') : s('geo_fail');
    }
  }

  function startQuiz() {
    questions = pickQuestions(dest.quizBank);
    qIndex = 0;
    message = '';
    step = 'quiz';
  }

  function answer(i) {
    if (i !== questions[qIndex].answer) {
      message = s('wrong');
      return;
    }
    message = '';
    if (qIndex < questions.length - 1) {
      qIndex += 1;
    } else {
      addStamp(dest.id);
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
  <p>{t(dest.description)}</p>
  <p class="muted"><small>🕑 {t(dest.hours)} · 📍 {t(dest.address)}</small></p>

  <a class="btn secondary" href={mapsUrl(dest)} target="_blank" rel="noopener" style="width: 100%">
    {s('directions')}
  </a>

  <div class="checkin">
    {#if step === 'done'}
      <div class="success">{s('checkin_done')}</div>
      <a class="btn secondary" href="{base}/passport">{s('passport')}</a>
    {:else if step === 'idle' || step === 'error'}
      {#if message}<div class="banner">{message}</div>{/if}
      <button class="btn" onclick={checkIn} style="width: 100%">{s('checkin')}</button>
      {#if SIMULATE}
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
