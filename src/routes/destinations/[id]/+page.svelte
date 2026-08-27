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
  import Icon from '$lib/components/Icon.svelte';
  import StampPress from '$lib/components/StampPress.svelte';
  import PageShell from '$lib/components/PageShell.svelte';
  import Quiz from '$lib/components/Quiz.svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

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
        track('arrive', dest.id, distance, quiet); // arrival; a missing checkin after = gave up
        // a site whose questions aren't written yet stamps on the GPS fix alone, and
        // counts as clean (there was nothing to get wrong)
        if (dest.quizBank.length) step = 'quiz';
        else onPass({ missed: false });
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

  // single-job screen: its own back button is the way out — the layout hides the tab
  // bar for this route (`onSite`), no flag to set or reset here

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
    <!-- SCREEN 1 — the destination: name (topbar), description, don't-miss, one CTA.
         No image: there are no real site photos yet, and a decorative stand-in
         only pushed the copy down. -->
    <section class="screen info">
      <div class="info-body">
        {#if spotlight}
          <div class="tags">
            <span class="tag spot"><Icon name="spark" size={14} /> {s('spotlight')} {s('earned', POINTS.spotlight)}</span>
          </div>
        {/if}

        <p class="desc">{t(dest.description)}</p>

        <!-- "đừng bỏ lỡ": the survey team's three things to actually look at on site -->
        {#if dest.highlights?.length}
          <div class="dm-box">
            <h2 class="dm-title"><Icon name="spark" size={14} /> {s('dont_miss')}</h2>
            <ul class="dm">
              {#each dest.highlights as h}<li>{t(h)}</li>{/each}
            </ul>
          </div>
        {/if}
      </div>

      <!-- CTA dock: pushed to the bottom of the first screen, always in reach -->
      <div class="dock">
        {#if step === 'far'}
          <div class="banner">{s('far', distance, dest.radius)}</div>
        {:else if step === 'error'}
          <div class="banner">{message}</div>
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
  .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .tag.spot { background: var(--gold); color: #4a2f06; }
  .desc { margin: 0 0 4px; font-size: var(--fs-lg); line-height: 1.45; }
  /* the page's one block of colour now that the stand-in photo is gone: the gold
     "quieter/notice" tint the banners use, so it reads as the thing to look at */
  .dm-box {
    margin: 16px 0 4px;
    padding: 14px 16px;
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--gold) 12%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--gold) 32%, var(--line));
  }
  .dm-title {
    display: flex; align-items: center; gap: 7px;
    margin: 0 0 9px; font-family: var(--font-display); font-weight: 800;
    font-size: var(--fs-sm); text-transform: uppercase; letter-spacing: .08em;
    color: var(--brand-dark);
  }
  .dm { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
  .dm li { position: relative; padding-left: 17px; font-size: var(--fs-lg); line-height: 1.35; }
  .dm li::before {
    content: ''; position: absolute; left: 0; top: .5em;
    width: 7px; height: 7px; border-radius: 50%; background: var(--gold);
  }

  /* quiz + result screens: Quiz.svelte */

  /* ---- done screen ---- */
  .done { align-items: center; text-align: center; }
  .done-body { margin: auto 0; display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .success { margin: 0; font-size: var(--fs-lg); font-weight: 600; }
  .ok-mark { color: var(--teal); }
  .pts { margin: 0; font-weight: 700; color: var(--teal); }
  .done .dock { width: 100%; }
</style>
