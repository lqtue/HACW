<script>
  import { base } from '$app/paths';
  import { getPosition, distanceMeters } from '$lib/geo.js';
  import { mapsUrl, openLabel } from '$lib/util.js';
  import { hasStamp, addStamp, track } from '$lib/passport.svelte.js';
  import { stats } from '$lib/stats.svelte.js';
  import { recordCell } from '$lib/research.svelte.js';
  import { POINTS, spotlightIds, stampPoints } from '$lib/score.js';
  import { nudgeOn } from '$lib/switchback.js';
  import destinations from '$lib/data/sites.js';
  import { t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';
  import MatCua from '$lib/components/MatCua.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import StampPress from '$lib/components/StampPress.svelte';
  import PageShell from '$lib/components/PageShell.svelte';
  import Quiz from '$lib/components/Quiz.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { ui } from '$lib/ui.svelte.js';

  // back now lives as the sub-action under the check-in button (not a top-bar arrow).
  // deterministic back (history.back is unreliable / inert in the screens board):
  // from the tour-nav (?nav set) → back to the nav; from the passport's all-sites grid
  // (?from=passport) → back to the passport; else → explore, in the same view
  // (map/list) the visitor came from (?from)
  const fromView = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('from') : '';
  function goBack() {
    if (navBack) return goto(navBack);
    if (fromView === 'passport') return goto(base + '/passport');
    goto(base + '/destinations' + (fromView === 'list' ? '?view=list' : ''));
  }

  let { data } = $props();
  const dest = data.dest;

  // ?nav=<url> is set when the check-in was launched from the route screen (/go). If
  // present, the stamp screen resumes the tour instead of sending the visitor to the
  // passport — /go auto-advances to the next un-stamped stop on arrival.
  const navBack =
    (typeof location !== 'undefined' && new URLSearchParams(location.search).get('nav')) || '';

  // ?demo=idle|far|error|quiz|correct|wrong|done forces a check-in step for the /screens
  // board (and testers), independent of GPS and whether this device already has the
  // stamp — otherwise a stamped device only ever shows 'done'. Never mutates the
  // passport. correct/wrong are <Quiz>'s result-screen stills; it reads `demo` itself.
  const demo =
    (typeof location !== 'undefined' && new URLSearchParams(location.search).get('demo')) || '';

  // Quieter sites earn a bonus — this is what pulls the crowd off Chùa Cầu.
  // Points are identical on and off (the visible steer is the treatment, not the
  // bonus): `quiet` is the true spotlight state and drives stampPoints + the logged
  // `spot`; `spotlight` is what the visitor SEES, hidden on switchback off-units.
  const quiet = $derived(spotlightIds(stats.counts, destinations).has(dest.id));
  const spotlight = $derived(nudgeOn() ? quiet : false);
  const open = openLabel(dest);

  // Each step is its own full-viewport screen, one job: info → quiz → done.
  //   info states: idle -> locating -> (far | error) ; then quiz
  //   quiz is <Quiz> (question ↔ result, wrong-answer cooldown); onpass → done
  let step = $state(
    ['idle', 'locating', 'far', 'error', 'done'].includes(demo) ? demo
      : ['quiz', 'correct', 'wrong'].includes(demo) ? 'quiz'
      : hasStamp(dest.id) ? 'done' : 'idle'
  );
  const onInfo = $derived(step === 'idle' || step === 'locating' || step === 'far' || step === 'error');
  let message = $state('');
  let distance = $state(0);
  let missed = $state(false); // any wrong tap in the quiz -> no perfect bonus
  let earned = $state(0);

  async function checkIn() {
    step = 'locating';
    message = '';
    try {
      const here = await getPosition();
      recordCell(here); // anonymous foot-traffic count when consent is on (research store)
      distance = Math.round(distanceMeters(here, { lat: dest.lat, lng: dest.lng }));
      if (distance <= dest.radius) {
        step = 'quiz';
        track('arrive', dest.id, distance, quiet); // arrival; a missing checkin after = gave up
      }
      else {
        step = 'far';
        // how far off people actually are -> whether this radius needs widening
        track('gps_far', dest.id, distance, quiet);
      }
    } catch (e) {
      step = 'error';
      message = e?.code === 1 ? s('geo_denied') : s('geo_fail');
      track('gps_fail', dest.id, e?.code === 1 ? 1 : 0);
    }
  }

  // every drawn question answered right → the stamp lands
  function onPass(r) {
    missed = r.missed;
    earned = stampPoints({ perfect: !missed, spotlight: quiet });
    addStamp(dest.id, earned, quiet);
    step = 'done';
    // the seal lands; give the phone the thump too (no-op where unsupported)
    navigator.vibrate?.(28);
  }

  // single-job screen: its own back button is the way out, so hide the tab bar
  ui.hideNav = true;
  onDestroy(() => (ui.hideNav = false));

  // board preview: fill the done panel with sample values so the "checked in" frame
  // shows the full success state; sample banners for the far / error stills.
  onMount(() => {
    if (demo === 'done') { earned = 15; missed = false; }
    else if (demo === 'far') { distance = dest.radius + 120; } // sample "too far" banner
    else if (demo === 'error') { message = s('geo_denied'); } // sample GPS-denied banner
  });
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
        <button class="sub" onclick={goBack}>{s('back')}</button>
      </div>
    </section>
  {:else if step === 'quiz'}
    <!-- SCREENS 2+3 — question ↔ result, owned by Quiz -->
    <Quiz bank={dest.quizBank} destId={dest.id} {demo} onpass={onPass} />
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
        <span class="sub ph" aria-hidden="true"></span>
      </div>
    </section>
  {/if}
</PageShell>

<style>
  /* Every step fills the viewport and docks its action at the bottom, so the
     CTA is in reach without scrolling and each screen does one job. */
  /* .screen is the global skeleton (app.css): inside this PageShell's fill .page it
     grows to the bottom edge so the .dock lands there; a longer body (e.g. the "too
     far" banner) scrolls inside .info-body instead of pushing the dock off-screen. */
  /* info body takes the slack and scrolls; the footer is the global .dock (app.css) */
  .info-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; }

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

  /* quiz + result screens: Quiz.svelte */

  /* ---- done screen ---- */
  .done { align-items: center; text-align: center; }
  .done-body { margin: auto 0; display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .success { margin: 0; font-size: 1.15rem; font-weight: 600; }
  .ok-mark { color: var(--teal); }
  .pts { margin: 0; font-weight: 700; color: var(--teal); }
  .done .dock { width: 100%; }
</style>
