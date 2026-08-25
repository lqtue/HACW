<script>
  // The check-in quiz: draw → question → result → (next | retry-after-cooldown) → pass.
  // Extracted from destinations/[id] so the site page is just info → <Quiz> → stamp.
  // Owns the draw, the escalating wrong-answer lock and the two screens; reports the
  // outcome once every drawn question is right via onpass({ missed }).
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { pickQuestions } from '$lib/quiz.js';
  import { track } from '$lib/passport.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';
  import Icon from '$lib/components/Icon.svelte';

  // bank: the destination's quizBank; destId: for the wrong-answer event; demo: the
  // /screens board's still frames ('correct' | 'wrong' land on the result screen).
  let { bank, destId, demo = '', onpass } = $props();

  // Wrong answer locks the quiz for a bit before it can be re-drawn — and the lock
  // GROWS each time (5 s on the 1st wrong, 10 s on the 2nd, +5 s each after) so
  // guessing gets progressively slower than walking in and reading the sign. Capped.
  // ponytail: client-side only — the answers ship in destinations.json, so a
  // determined visitor can always read them. The real gate is that vouchers are
  // handed over by staff. Move answer-checking into functions/api/ if that changes.
  const COOLDOWN_STEP = 5;
  const COOLDOWN_MAX = 30;

  let step = $state('quiz'); // 'quiz' | 'result'
  let questions = $state([]);
  let qIndex = $state(0);
  let lastCorrect = $state(false); // drives the result screen
  let missed = $state(false); // any wrong tap this visit -> no perfect bonus
  let cool = $state(0);
  let wrongCount = $state(0); // wrong taps this visit — drives the escalating cooldown

  // draw 2 easy + 1 hard; answer all correctly to earn the stamp
  function startQuiz() {
    questions = pickQuestions(bank);
    qIndex = 0;
    step = 'quiz';
  }
  startQuiz();

  onMount(() => {
    if (demo === 'correct' || demo === 'wrong') {
      // static result preview for the /screens board: pick a question with an
      // explanation, then jump to the result screen (no interval — the frame is a still)
      qIndex = Math.max(0, questions.findIndex((q) => q.explain));
      lastCorrect = demo === 'correct';
      if (demo === 'wrong') { missed = true; cool = COOLDOWN_STEP; } // sample: first-wrong wait
      step = 'result';
    }
  });

  // Every answer lands on the result screen. A wrong tap throws the whole draw
  // away and locks the site for an escalating cooldown (guessing costs time + the
  // perfect bonus); the explanation is shown either way.
  function answer(i) {
    lastCorrect = i === questions[qIndex].answer;
    if (!lastCorrect) {
      track('quiz_wrong', destId, qIndex);
      missed = true;
      wrongCount += 1;
      startCooldown();
    }
    step = 'result';
  }

  function startCooldown() {
    cool = Math.min(wrongCount * COOLDOWN_STEP, COOLDOWN_MAX); // 5s, 10s, 15s … capped
    const iv = setInterval(() => {
      cool -= 1;
      if (cool <= 0) clearInterval(iv);
    }, 1000);
  }

  function advance() {
    if (qIndex < questions.length - 1) {
      qIndex += 1;
      step = 'quiz';
    } else {
      onpass?.({ missed });
    }
  }
</script>

{#if step === 'quiz'}
  <!-- the question: nothing but the question + its answers -->
  {@const q = questions[qIndex]}
  <section class="screen quiz">
    <div class="progress" aria-hidden="true">
      {#each questions as _, i (i)}<span class="pip" class:on={i <= qIndex}></span>{/each}
    </div>
    <p class="qcount">{s('question_of', qIndex + 1, questions.length)}</p>
    <h2 class="q">{t(q.question)}</h2>
    {#if q.hint}<p class="hint"><Icon name="bulb" size={16} /> {t(q.hint)}</p>{/if}

    <div class="opts">
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
    </div>
  </section>
{:else}
  <!-- the result: right/wrong, why, and Next -->
  {@const q = questions[qIndex]}
  <section class="screen result" class:ok={lastCorrect}>
    <!-- ✓/✕, title, then the explanation (shown on right AND wrong — it's the story the
         visitor came for) and the cooldown note, centred as one block -->
    <div class="verdict">
      <span class="rmark" aria-hidden="true">{lastCorrect ? '✓' : '✕'}</span>
      <h2>{lastCorrect ? s('correct_title') : s('wrong_title')}</h2>
      {#if q?.explain || (!lastCorrect && cool > 0)}
        <div class="verdict-sub">
          {#if q?.explain}<p class="explain">{t(q.explain)}</p>{/if}
          {#if !lastCorrect && cool > 0}<p class="wait-note">{s('wrong_wait', cool)}</p>{/if}
        </div>
      {/if}
    </div>

    <div class="dock">
      {#if lastCorrect}
        <button class="btn" onclick={advance}>{s('quiz_continue')}</button>
      {:else}
        <button class="btn" onclick={startQuiz} disabled={cool > 0}>{s('retry')}</button>
      {/if}
      <!-- empty sub slot so this primary lands at the SAME height as the info screen's
           (which has a back link under it) -->
      <span class="sub ph" aria-hidden="true"></span>
    </div>
  </section>
{/if}

<style>
  /* .screen / .dock are the global skeleton (app.css) */

  /* ---- quiz screen ---- */
  .quiz { padding-top: 8px; }
  .progress { display: flex; gap: 6px; margin-bottom: 18px; }
  .pip { flex: 1 1 0; height: 4px; border-radius: 999px; background: var(--line); }
  .pip.on { background: var(--brand); }
  .qcount { margin: 0 0 6px; color: var(--muted); font-size: 0.8rem; font-weight: 600; letter-spacing: 0.04em; }
  .q { margin: 0 0 20px; font-size: 1.5rem; line-height: 1.25; }
  .hint {
    margin: -8px 0 18px; padding: 10px 13px; font-size: 0.92rem; line-height: 1.45;
    color: var(--brand-dark);
    background: color-mix(in srgb, var(--gold) 14%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--gold) 30%, var(--line));
    border-radius: var(--radius-sm);
  }
  .opts { margin: auto 0; display: grid; gap: 10px; } /* centered mid-page, not pinned to the bottom */
  .opt {
    display: block; width: 100%; text-align: left;
    padding: 16px 18px;
    border: 1.5px solid var(--line); border-radius: var(--radius-sm);
    background: var(--surface);
    font-family: var(--font-body); font-weight: 500; font-size: 1.05rem;
    cursor: pointer; transition: border-color 0.12s ease, background 0.12s ease;
  }
  .opt:hover { border-color: color-mix(in srgb, var(--brand) 45%, var(--line)); background: var(--bg); }
  .photo-opts { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
  .photo-opt {
    display: flex; flex-direction: column; gap: 6px; padding: 0;
    border: 1.5px solid var(--line); border-radius: var(--radius-sm);
    background: var(--surface); overflow: hidden; cursor: pointer;
    font-family: var(--font-body); font-weight: 600; font-size: 0.9rem;
  }
  .photo-opt img { width: 100%; aspect-ratio: 3 / 2; object-fit: cover; display: block; }
  .photo-opt span { padding: 0 10px 10px; }
  .photo-opt:hover { border-color: color-mix(in srgb, var(--brand) 45%, var(--line)); }

  /* ---- result screen ---- */
  .result { justify-content: center; text-align: center; }
  /* ✓/✕ + title + explanation stack in flow and centre as a group; the explanation can
     run to a paragraph (it's the site's story) and scrolls if it ever outgrows the gap */
  .verdict {
    margin: auto 0; min-height: 0; display: flex; flex-direction: column; align-items: center; gap: 12px;
    overflow-y: auto;
  }
  .verdict-sub { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 4px; margin-top: 4px; }
  .rmark {
    width: 76px; height: 76px; display: grid; place-items: center;
    border-radius: 999px; font-size: 2.2rem; line-height: 1; font-weight: 700;
    background: color-mix(in srgb, var(--brand) 14%, transparent); color: var(--brand);
  }
  .result.ok .rmark { background: color-mix(in srgb, var(--teal) 16%, transparent); color: var(--teal); }
  .verdict h2 { margin: 0; font-size: 1.6rem; }
  .wait-note { margin: 4px 0 0; color: var(--muted); font-size: 0.86rem; }
  .result.ok .verdict h2 { color: var(--teal); }
  .explain { margin: 0; max-width: 34ch; color: var(--ink); line-height: 1.55; }
</style>
