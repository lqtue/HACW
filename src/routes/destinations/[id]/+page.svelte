<script>
  import { base } from '$app/paths';
  import { getPosition, distanceMeters } from '$lib/geo.js';
  import { pickQuestions } from '$lib/quiz.js';
  import { mapsUrl, openLabel } from '$lib/util.js';
  import { hasStamp, addStamp, track } from '$lib/passport.svelte.js';
  import { stats } from '$lib/stats.svelte.js';
  import { recordCell } from '$lib/research.svelte.js';
  import { POINTS, spotlightIds, stampPoints } from '$lib/score.js';
  import destinations from '$lib/data/destinations.json';
  import { t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';
  import MatCua from '$lib/components/MatCua.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import StampPress from '$lib/components/StampPress.svelte';
  import PageShell from '$lib/components/PageShell.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { ui } from '$lib/ui.svelte.js';

  // back now lives as the sub-action under the check-in button (not a top-bar arrow).
  // deterministic back (history.back is unreliable / inert in the screens board):
  // from the tour-nav (?nav set) → back to the nav; else → explore, in the same
  // view (map/list) the visitor came from (?from)
  const fromView = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('from') : '';
  function goBack() {
    if (navBack) return goto(navBack);
    goto(base + '/destinations' + (fromView === 'list' ? '?view=list' : ''));
  }

  let { data } = $props();
  const dest = data.dest;

  // ?nav=<url> is set when the check-in was launched from the route screen (/go). If
  // present, the stamp screen resumes the tour instead of sending the visitor to the
  // passport — /go auto-advances to the next un-stamped stop on arrival.
  const navBack =
    (typeof location !== 'undefined' && new URLSearchParams(location.search).get('nav')) || '';

  // ?demo=idle|quiz|done forces a check-in step for the /screens board (and
  // testers), independent of GPS and whether this device already has the stamp —
  // otherwise a stamped device only ever shows 'done'. Never mutates the passport.
  const demo =
    (typeof location !== 'undefined' && new URLSearchParams(location.search).get('demo')) || '';

  // Quieter sites earn a bonus — this is what pulls the crowd off Chùa Cầu.
  const spotlight = $derived(spotlightIds(stats.counts, destinations).has(dest.id));
  const open = openLabel(dest);

  // Wrong answer locks the quiz for a bit before it can be re-drawn — and the lock
  // GROWS each time (5 s on the 1st wrong, 10 s on the 2nd, +5 s each after) so
  // guessing gets progressively slower than walking in and reading the sign. Capped.
  // ponytail: client-side only — the answers ship in destinations.json, so a
  // determined visitor can always read them. The real gate is that vouchers are
  // handed over by staff. Move answer-checking into functions/api/ if that changes.
  const COOLDOWN_STEP = 5;
  const COOLDOWN_MAX = 30;

  // Each step is its own full-viewport screen, one job: info → quiz → result → done.
  //   info states: idle -> locating -> (far | error) ; then quiz
  //   quiz -> result (correct or wrong) -> quiz|done ; wrong locks for COOLDOWN
  let step = $state(
    ['idle', 'locating', 'far', 'error', 'done'].includes(demo) ? demo : hasStamp(dest.id) ? 'done' : 'idle'
  );
  const onInfo = $derived(step === 'idle' || step === 'locating' || step === 'far' || step === 'error');
  let message = $state('');
  let distance = $state(0);
  let cool = $state(0);
  let wrongCount = $state(0); // wrong taps this visit — drives the escalating cooldown

  // quiz bank: draw 2 easy + 1 hard, answer all correctly to earn the stamp
  let questions = $state([]);
  let qIndex = $state(0);
  let lastCorrect = $state(false); // drives the result screen
  let missed = $state(false); // any wrong tap this visit -> no perfect bonus
  let earned = $state(0);

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

  // board preview: draw the quiz, or fill the done panel with sample values so the
  // "checked in" frame shows the full success state (stamp + points + keep-code).
  // single-job screen: its own back button is the way out, so hide the tab bar
  ui.hideNav = true;
  onDestroy(() => (ui.hideNav = false));

  onMount(() => {
    if (demo === 'quiz') startQuiz();
    else if (demo === 'correct' || demo === 'wrong') {
      // static result preview for the /screens board: seed a draw, then jump to
      // the result screen (no interval — the frame is a still)
      questions = pickQuestions(dest.quizBank);
      qIndex = questions.findIndex((q) => q.explain);
      if (qIndex < 0) qIndex = 0;
      lastCorrect = demo === 'correct';
      if (demo === 'wrong') { missed = true; cool = COOLDOWN_STEP; } // sample: first-wrong wait
      step = 'result';
    } else if (demo === 'done') { earned = 15; missed = false; }
    else if (demo === 'far') { distance = dest.radius + 120; } // sample "too far" banner
    else if (demo === 'error') { message = s('geo_denied'); } // sample GPS-denied banner
  });

  // Every answer lands on the result screen. A wrong tap throws the whole draw
  // away and locks the site for an escalating cooldown (guessing costs time + the
  // perfect bonus); the explanation is shown either way.
  function answer(i) {
    lastCorrect = i === questions[qIndex].answer;
    if (!lastCorrect) {
      track('quiz_wrong', dest.id, qIndex);
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
      earned = stampPoints({ perfect: !missed, spotlight });
      addStamp(dest.id, earned);
      step = 'done';
      // the seal lands; give the phone the thump too (no-op where unsupported)
      navigator.vibrate?.(28);
    }
  }
</script>

<!-- no top-bar back anywhere here; only the info screen shows the title — quiz, result
     and done carry their own heading (question / verdict / stamp), so no top bar there -->
<PageShell title={onInfo ? t(dest.name) : ''} fill>
  {#if onInfo}
    <!-- SCREEN 1 — the destination: image, name (topbar), description, one CTA -->
    <section class="screen info">
      <div class="info-body">
        <div class="hero" style="--cat: var(--c-{dest.category})">
          <span class="watermark">{t(dest.name).charAt(0)}</span>
          <div class="eye">
            <MatCua size={104} color="var(--cat)" inner="#fbe0b8" ink="var(--cat)" />
          </div>
        </div>

        {#if spotlight}
          <div class="tags">
            <span class="tag spot"><Icon name="spark" size={14} /> {s('spotlight')} {s('earned', POINTS.spotlight)}</span>
          </div>
        {/if}

        <p class="desc">{t(dest.description)}</p>
      </div>

      <!-- CTA dock: pushed to the bottom of the first screen, always in reach -->
      <div class="dock">
        {#if open?.status === 'closed'}
          <div class="banner">{s('closed_warning')}</div>
        {/if}
        {#if step === 'far'}
          <div class="banner">{s('far', distance, dest.radius)}</div>
        {:else if step === 'error'}
          <div class="banner">{message}</div>
        {:else if spotlight}
          <div class="banner spot-note">{s('spotlight_hint', POINTS.spotlight)}</div>
        {/if}

        <!-- secondary (ghost) above, primary (coral) below, sub (link) last —
             the app-wide docked-footer structure -->
        <a class="btn ghost" href={mapsUrl(dest)} target="_blank" rel="noopener">{s('directions')}</a>

        {#if step === 'locating'}
          <button class="btn" disabled>{s('locating')}</button>
        {:else if step === 'far'}
          <button class="btn" onclick={checkIn}>{s('retry')}</button>
        {:else if step === 'error'}
          <button class="btn" onclick={checkIn}>{s('allow_location')}</button>
        {:else}
          <button class="btn" onclick={checkIn}>{s('checkin')}</button>
        {/if}
        <button class="skip" onclick={goBack}>{s('back')}</button>
      </div>
    </section>
  {:else if step === 'quiz'}
    <!-- SCREEN 2 — the question: nothing but the question + its answers -->
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
  {:else if step === 'result'}
    <!-- SCREEN 3 — the result: right/wrong, why, and Next -->
    {@const q = questions[qIndex]}
    <section class="screen result" class:ok={lastCorrect}>
      <!-- icon + title are the centered anchor; the explanation/cooldown hang BELOW it
           (absolute) so the ✓/✕ + title sit at the SAME height whether or not there's
           explain text (correct screen has none, wrong screen does). -->
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
        <!-- reserve the sub-link row so this primary lands at the SAME height as the
             info screen's (which has a back link under it) -->
        <span class="skip sub-ph" aria-hidden="true">&nbsp;</span>
      </div>
    </section>
  {:else if step === 'done'}
    <!-- SCREEN 4 — the stamp lands -->
    <section class="screen done">
      <div class="done-body">
        {#if earned}
          <StampPress
            color="var(--c-{dest.category})"
            motif={dest.id.charCodeAt(0) % 2 ? 'spiral' : 'am-duong'}
            glyph={t(dest.name).charAt(0)}
          />
        {/if}
        <p class="success"><span class="ok-mark"><Icon name="check" size={18} stroke={2.2} /></span> {s('checkin_done')}</p>
        {#if earned}
          <p class="pts">{s('earned', earned)}{#if !missed} · {s('perfect_bonus')}{/if}</p>
        {/if}
      </div>
      <div class="dock">
        {#if navBack}
          <button class="btn" onclick={() => goto(navBack)}>{s('continue_tour')}</button>
        {:else}
          <a class="btn" href="{base}/passport">{s('passport')}</a>
        {/if}
        <span class="skip sub-ph" aria-hidden="true">&nbsp;</span>
      </div>
    </section>
  {/if}
</PageShell>

<style>
  /* Every step fills the viewport and docks its action at the bottom, so the
     CTA is in reach without scrolling and each screen does one job. */
  .screen {
    display: flex;
    flex-direction: column;
    /* fill the (now flex:1) .page column so the docked CTA sits on the bottom edge on
       every step; a longer body (e.g. the "too far" banner) scrolls inside .info-body
       instead of pushing the dock off-screen. */
    flex: 1 1 auto;
    min-height: 0;
  }
  /* info body takes the slack and scrolls; the dock stays pinned at the bottom */
  .info-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
  /* bottom clearance matches the onboarding screens (32px + safe area) so the docked
     buttons sit at the same height, not flush against the phone's bottom edge */
  .dock {
    flex: 0 0 auto; margin-top: auto;
    padding-top: 18px; padding-bottom: calc(32px + env(safe-area-inset-bottom));
    display: grid; gap: 10px;
  }
  .btn { width: 100%; }
  .sub-ph { visibility: hidden; } /* invisible spacer: reserves the back-link row height */
  /* sub action — the app-wide underlined muted link under the primary button */
  .skip {
    justify-self: center; margin: 2px 0 0;
    border: 0; background: none; padding: 4px; cursor: pointer;
    color: var(--muted); font-family: var(--font-body); font-weight: 600;
    font-size: 0.9rem; text-decoration: underline; text-underline-offset: 3px;
  }
  .btn.ghost {
    background: var(--surface);
    color: var(--ink);
    border: 1px solid var(--line);
    font-weight: 600;
  }
  .btn.ghost:hover { background: var(--bg); }

  /* ---- info screen ---- */
  .info-body { display: flex; flex-direction: column; }
  .hero {
    position: relative;
    height: 160px;
    flex: 0 0 auto; /* never let the flex column shrink the image when a banner appears */
    border-radius: var(--radius);
    overflow: hidden;
    margin-bottom: 14px;
    background: linear-gradient(160deg, color-mix(in srgb, var(--cat) 10%, var(--surface)), var(--surface));
    border: 1px solid var(--line);
  }
  .hero::before, .hero::after {
    content: '';
    position: absolute;
    border-radius: 999px;
    background: var(--grad-warm);
  }
  .hero::before { top: 22px; left: -30px; width: 130px; height: 28px; opacity: 0.7; }
  .hero::after { top: 62px; left: 10px; width: 84px; height: 22px; opacity: 0.45; }
  .hero .eye {
    position: absolute;
    top: 18px; right: 18px;
    opacity: 0.9;
    filter: drop-shadow(0 8px 14px rgba(126, 31, 19, 0.2));
  }
  .hero .watermark {
    position: absolute;
    right: 8px; bottom: -24px;
    font-family: var(--font-display);
    font-size: 11rem; font-weight: 700; line-height: 1;
    color: var(--cat); opacity: 0.16; user-select: none;
  }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .tag.spot { background: var(--gold); color: #4a2f06; }
  .desc { margin: 0 0 4px; font-size: 1.02rem; line-height: 1.6; }
  .spot-note { border-color: color-mix(in srgb, var(--gold) 55%, var(--line)); }

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
  .verdict { margin: auto 0; position: relative; display: flex; flex-direction: column; align-items: center; gap: 12px; }
  /* explanation + cooldown hang below the anchor without changing its centered height */
  .verdict-sub {
    position: absolute; top: calc(100% + 8px); left: 50%; transform: translateX(-50%);
    width: 100%; display: flex; flex-direction: column; align-items: center; gap: 4px;
  }
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

  /* ---- done screen ---- */
  .done { align-items: center; text-align: center; }
  .done-body { margin: auto 0; display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .success { margin: 0; font-size: 1.15rem; font-weight: 600; }
  .ok-mark { color: var(--teal); }
  .pts { margin: 0; font-weight: 700; color: var(--teal); }
  .done .dock { width: 100%; }
</style>
