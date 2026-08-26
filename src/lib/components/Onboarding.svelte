<script>
  // The pre-app door→language→welcome→install→scan→perms run. Extracted from the
  // home route so +page.svelte is just the plan/build/done home. Owns its own step
  // machine; tells the parent when it's finished (onDone) and when to grab a GPS fix
  // (onLocate — the parent holds `here`, which the planner uses). `forced` opens on a
  // specific screen for the /screens board previews.
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import TicketScan from '$lib/components/TicketScan.svelte';
  import MatCua from '$lib/components/MatCua.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import IconList from '$lib/components/IconList.svelte';
  import { LANGS } from '$lib/languages.js';
  import { codeFromTicket } from '$lib/backup.js';
  import { adoptCode, restore, track } from '$lib/passport.svelte.js';
  import { setTicketCode } from '$lib/plan.svelte.js';
  import { setNat } from '$lib/study.svelte.js';
  import { setLang } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';

  let { forced = '', onDone, onLocate } = $props();

  let step = $state(
    /^(door|lang|welcome|install|scan|perms)$/.test(forced) ? forced : 'door'
  );
  // the two door leaves swing open on tap, then the language screen appears
  let opening = $state(false);
  function openDoor() {
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      step = 'lang';
      return;
    }
    opening = true;
    setTimeout(() => (step = 'lang'), 840); // matches the leaf slide below
  }

  // the door's greeting cycles through the languages, one every 2.4 s, until tapped
  let hintAt = $state(0);
  $effect(() => {
    if (step !== 'door' || opening) return;
    const iv = setInterval(() => (hintAt = (hintAt + 1) % LANGS.length), 2400);
    return () => clearInterval(iv);
  });

  // iOS gets the Share-sheet steps, everything else the browser-menu steps. Set on
  // mount because navigator is absent during prerender.
  let ios = $state(false);
  onMount(() => {
    if (step === 'welcome') track('welcome');
    ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  });

  // Record the language signal for the nationality study (see counts.js): the device
  // locale's primary subtag (navigator.language, e.g. ko-KR -> "ko") AND the language
  // the visitor actually picked. Both are anonymous aggregate counts.
  function trackLang(pick) {
    const loc = (typeof navigator !== 'undefined' && navigator.language || '')
      .toLowerCase()
      .split('-')[0];
    if (/^[a-z]{2,3}$/.test(loc)) track('lang', loc);
    track('pick', pick);
  }
  // vi/en switch the built-in content; every other choice has no locale file, so it
  // displays English (the most translatable base) and rides the browser's own
  // page-translate (Chrome/Safari/Edge). No embedded widget — that would be a
  // third-party script on the offline critical path. (CLAUDE.md: built locales are
  // vi/en only.) The pick is still recorded, which is the point of the study.
  function chooseLang(l) {
    setLang(l.display ?? 'en');
    setNat(l.code); // nationality proxy for the study — tag events from here on
    trackLang(l.code);
    track('welcome');
    step = 'welcome';
  }
  function otherLang() {
    setLang('en');
    setNat('other');
    trackLang('other');
    track('welcome');
    step = 'welcome';
  }
  async function onScanned(raw) {
    setTicketCode(raw);
    const code = codeFromTicket(raw);
    if (code) {
      // The ticket QR IS the recovery key: adopt its derived code so this device's
      // backups go there, then pull any passport already backed up under it (a second
      // phone, a reinstall) and merge. Best-effort — a 404 (first device with this
      // ticket) or being offline is not an error, scanning still completes.
      adoptCode(code);
      try {
        // don't let a slow/hanging fetch stall onboarding on flaky event wifi — cap the
        // wait; if the merge lands after this, it still applies (restore mutates in place)
        await Promise.race([
          restore(code),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
        ]);
      } catch {
        // no prior backup / no server / offline / slow — nothing to merge now, carry on
      }
    }
    track('scan');
    scanned = true; // don't auto-advance — visitor taps Continue
  }
  // Continue (vs Skip) once a ticket exists — this session's scan OR one already saved
  // on the device (TicketScan uses the same key).
  let scanned = $state(typeof localStorage !== 'undefined' && !!localStorage.getItem('hacw_ticket_v1'));
  let ticketScan = $state(); // bound child — page footer drives its start()
  const scanSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  // Ask for GPS + motion up front (from this tap — iOS requires a user gesture for
  // DeviceMotion/Orientation). Both prompts are best-effort; a denial is fine, the map
  // re-asks for location later and the compass just stays off.
  async function requestPerms() {
    onLocate?.(); // capture a fix for location-aware planning (non-blocking; denial is fine)
    try {
      if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission)
        await DeviceMotionEvent.requestPermission();
      if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission)
        await DeviceOrientationEvent.requestPermission();
    } catch {}
  }
</script>

{#if step === 'door'}
  <!-- SCREEN 1 — the dragon door of Chùa Ông (the organiser's own photo, static/door.webp),
       filling the screen. It is split down the seam into two leaves that slide apart on
       tap, revealing the paper (the next screen) behind. The one line of text cycles
       through every language the app offers — nobody has chosen one yet, so the door
       greets everyone in turn. -->
  <section class="door" class:opening style="--door: url('{base}/door.webp')">
    <button class="door-tap" onclick={openDoor} aria-label="Mở cửa · Open the door">
      <span class="leaf left"></span>
      <span class="leaf right"></span>
      <span class="door-hint">
        {#key hintAt}
          <span class="hint-line" lang={LANGS[hintAt].code}>
            <b>{LANGS[hintAt].hello}</b>
            <small>{LANGS[hintAt].open}</small>
          </span>
        {/key}
      </span>
    </button>
  </section>
{:else if step === 'lang'}
  <!-- SCREEN 2 — the greeting IS the picker: no headings, no instructions, just a
       grid of hellos anyone recognises in their own language. -->
  <section class="langscreen">
    <div class="glangs">
      {#each LANGS as l (l.code)}
        <button class="glang" onclick={() => chooseLang(l)} aria-label={l.name}>
          <span class="g-hello" lang={l.code}>{l.hello}</span>
          <span class="g-name">{l.name}</span>
        </button>
      {/each}
      <button class="glang other" onclick={otherLang} aria-label="Other language">
        <span class="g-hello"><Icon name="globe" size={28} /></span>
        <span class="g-name">Other</span>
      </button>
    </div>
  </section>
{:else if step === 'welcome'}
  <!-- SCREEN 3 — welcome, in the chosen language, three lines + one CTA -->
  <!-- same skeleton as install/perms: title top, list centred, dock bottom -->
  <section class="screen">
    <h1 class="ptitle"><span class="w-pre">Thử thách</span><br />Xuyên Mạch Nghệ</h1>

    <div class="mid">
      <IconList items={[
        { icon: 'map', text: s('feat_map') },
        { icon: 'ticket', text: s('feat_ticket') },
        { icon: 'compass', text: s('feat_plan') }
      ]} />
    </div>

    <div class="dock">
      <button class="btn ghost" onclick={() => (step = 'install')}>{s('install')}</button>
      <button class="btn" onclick={() => (step = 'perms')}>{s('welcome_start')}</button>
      <span class="sub ph" aria-hidden="true"></span>
    </div>
  </section>
{:else if step === 'install'}
  <section class="screen">
    <h1 class="ptitle">{s('install')}</h1>

    <div class="mid">
      <p class="lead">{s('install_why')}</p>
      <IconList items={(ios ? [s('install_ios_1'), s('install_ios_2')] : [s('install_android_1'), s('install_android_2')]).map((text) => ({ text }))} />
    </div>

    <div class="dock">
      <button class="btn" onclick={() => (step = 'perms')}>{s('install_next')}</button>
      <span class="sub ph" aria-hidden="true"></span>
    </div>
  </section>
{:else if step === 'scan'}
  <section class="screen">
    <h1 class="ptitle">{s('scan_title')}</h1>

    <div class="mid">
      <TicketScan bind:this={ticketScan} onsaved={onScanned} hero />
    </div>

    <div class="dock">
      {#if scanned}
        <button class="btn" onclick={() => onDone?.()}>{s('continue_btn')}</button>
        <span class="sub ph" aria-hidden="true"></span>
      {:else}
        <a class="btn ghost" href="{base}/destinations?tickets=1">{s('buy_ticket')}</a>
        {#if scanSupported}<button class="btn" onclick={() => ticketScan?.start()}>{s('scan_btn')}</button>{/if}
        <button class="sub" onclick={() => onDone?.()}>{s('scan_skip')}</button>
      {/if}
    </div>
  </section>
{:else if step === 'perms'}
  <section class="screen">
    <h1 class="ptitle">{s('perm_title')}</h1>

    <div class="mid">
      <IconList items={[
        { icon: 'map', text: s('perm_gps') },
        { icon: 'compass', text: s('perm_motion') }
      ]} />
    </div>

    <div class="dock">
      <!-- one button: Tiếp tục grants location + motion, then moves on -->
      <button class="btn" onclick={() => { requestPerms(); step = 'scan'; }}>{s('continue_btn')}</button>
      <p class="terms">{s('terms_pre')}<a href="{base}/terms">{s('terms_link')}</a>{s('terms_post')}</p>
    </div>
  </section>
{/if}

<style>
  /* ---- onboarding: bare, no topbar ---- */
  /* welcome / install / scan / perms are the global .screen skeleton (app.css) */

  /* language screen: a full-bleed grid of greetings, nothing else */
  .langscreen {
    min-height: 100dvh;
    display: flex; flex-direction: column; justify-content: center;
    padding: var(--pad-top) var(--gutter) calc(32px + env(safe-area-inset-bottom));
  }
  .glangs { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .glang {
    display: flex; flex-direction: column; gap: 6px;
    min-height: 92px; padding: 16px 14px;
    border: 1px solid var(--line); background: var(--surface);
    border-radius: var(--radius); cursor: pointer; text-align: left;
    transition: border-color 0.14s ease, background 0.14s ease, transform 0.06s ease;
  }
  .glang:hover { border-color: color-mix(in srgb, var(--brand) 55%, var(--line)); }
  .glang:active { transform: translateY(1px); }
  .glang:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .g-hello {
    font-family: var(--font-display); font-weight: 700; color: var(--ink);
    font-size: clamp(1.25rem, 5.5vw, 1.7rem); line-height: 1.05; letter-spacing: -0.02em;
  }
  .g-name { color: var(--muted); font-weight: 600; font-size: 0.82rem; }
  .glang.other { align-items: flex-start; }
  .glang.other .g-hello { color: var(--brand); }



  /* ---- door screen: the photo, full-bleed, split at the seam ----
     Both leaves are full-viewport boxes drawing the whole photo (cover, centred — so the
     painted seam stays on the screen's centre line), each clipped to its own half. Sliding
     them apart therefore opens the real door onto the paper behind. One image, precached. */
  .door {
    position: fixed; inset: 0; z-index: 900;
    background: var(--paper); /* what shows once the leaves part */
    overflow: hidden;
  }
  .door-tap {
    position: absolute; inset: 0; display: block;
    border: 0; background: none; cursor: pointer; padding: 0;
    -webkit-tap-highlight-color: transparent;
  }
  .door-tap:focus-visible { outline: 3px solid var(--brand); outline-offset: -3px; }
  .leaf {
    position: absolute; inset: 0;
    background-image: var(--door);
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    transition: transform 0.8s cubic-bezier(0.55, 0.05, 0.3, 1);
    animation: breathe 10s ease-in-out infinite alternate; /* the door waits, barely moving */
  }
  .leaf.left { clip-path: inset(0 50% 0 0); }
  .leaf.right { clip-path: inset(0 0 0 50%); }
  /* dark mode: the photo keeps its own light — a slight dim so it sits with the night UI */
  :global([data-theme='dark']) .leaf { filter: brightness(0.82); }

  .door.opening .leaf { animation: none; }
  .door.opening .leaf.left { transform: translateX(-52%); }
  .door.opening .leaf.right { transform: translateX(52%); }
  .door.opening .door-hint { opacity: 0; }

  @keyframes breathe { from { transform: scale(1); } to { transform: scale(1.03); } }

  /* the greeting rides the bottom of the door on a fade to the paper colour; each
     language fades in as {#key} remounts the line */
  .door-hint {
    position: absolute; left: 0; right: 0; bottom: 0; z-index: 2;
    padding: 80px var(--gutter) calc(40px + env(safe-area-inset-bottom));
    display: grid; place-items: center;
    background: linear-gradient(to top, rgba(20, 8, 4, 0.78), rgba(20, 8, 4, 0.35) 55%, transparent);
    pointer-events: none;
    transition: opacity 0.3s ease;
  }
  .hint-line {
    display: grid; gap: 4px; text-align: center; color: #fff;
    animation: hintin 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }
  .hint-line b { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.6rem, 7vw, 2.2rem); line-height: 1.1; letter-spacing: -0.01em; }
  .hint-line small { font-family: var(--font-body); font-weight: 600; font-size: 0.95rem; opacity: 0.85; }
  @keyframes hintin { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) {
    .leaf { transition: none; animation: none; }
    .hint-line { animation: none; }
  }

  /* the welcome title's first line is the light "Thử thách" over the bold event name */
  .w-pre { font-weight: 400; }



  .mid .lead { margin: 0; text-align: center; color: var(--ink); font-size: 1.05rem; line-height: 1.5; }
  /* the terms note fills the dock's 32px sub slot (two lines, not a link row) */
  .terms {
    margin: 0 auto; min-height: 32px; max-width: 34ch;
    text-align: center; color: var(--muted); font-size: 0.8rem; line-height: 1.4;
  }
</style>
