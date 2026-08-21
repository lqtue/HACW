<script>
  import { onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import tickets from '$lib/data/ticket-points.json';
  import { isTicketQr } from '$lib/ticket.js';
  import { mapsUrl } from '$lib/util.js';
  import { t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';

  // Optional "scan your ticket to begin". The Hội An ticket's QR is a Vietnamese
  // e-invoice lookup code (tracuuhddt…), not machine-readable ticket contents — so
  // scanning proves a purchase and gives us a stable anonymous id, but NOT which
  // sites or 3-vs-5. That's why the planner never gates on it — it's a bonus gesture.
  //
  // Two decode paths: the native BarcodeDetector where it exists (Chrome/Android —
  // fast, GPU), and jsQR over canvas frames everywhere else. iOS/Safari has no
  // BarcodeDetector but does have getUserMedia, so jsQR is what makes iPhones scan.
  // jsQR is pure JS, dynamically imported (only the no-BarcodeDetector path pays for
  // it) and bundled — precached, so it still works offline.
  const KEY = 'hacw_ticket_v1';
  // `hero` is the dedicated onboarding scan step, where scanning IS the screen: a
  // viewfinder + a real button. Everywhere else (recommend / manual) it stays a quiet
  // one-line strip so it never competes with the plan above it.
  let { onsaved, hero = false } = $props();

  // Any device with a camera can scan now — the decoder is chosen at start().
  const supported =
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const hasBD = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  let saved = $state(
    typeof localStorage !== 'undefined' && !!localStorage.getItem(KEY)
  );
  let scanning = $state(false);
  let showStands = $state(false); // "where to buy?" -> the ticket-counter list
  let note = $state('');
  let video = $state();
  let stream = null;
  let raf = 0;
  let canvas = null; // jsQR path: video frame is drawn here to read pixels

  function stop() {
    if (!browser) return;
    cancelAnimationFrame(raf);
    raf = 0;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    scanning = false;
  }
  onDestroy(stop);

  async function start() {
    if (!supported) {
      note = s('scan_unsupported');
      return;
    }
    note = '';
    scanning = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = stream;
      await video.play();

      // Fast native path where it exists; jsQR over canvas frames otherwise (iOS).
      const detector = hasBD ? new BarcodeDetector({ formats: ['qr_code'] }) : null;
      const jsQR = detector ? null : (await import('jsqr')).default;
      if (!detector) canvas = document.createElement('canvas');

      const tick = async () => {
        if (!scanning) return;
        try {
          if (detector) {
            const codes = await detector.detect(video);
            if (codes.length && codes[0].rawValue) return done(codes[0].rawValue);
          } else {
            const hit = readFrame(jsQR);
            if (hit) return done(hit);
          }
        } catch {
          // a transient decode/read failure is fine — keep polling
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } catch {
      note = s('scan_unsupported');
      stop();
    }
  }

  // Draw the current video frame (downscaled — QR needs contrast, not megapixels) and
  // hand the pixels to jsQR. Returns the decoded string, or null to keep polling.
  function readFrame(jsQR) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;
    const scale = Math.min(1, 640 / Math.max(vw, vh));
    const w = Math.round(vw * scale);
    const h = Math.round(vh * scale);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const res = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
    return res?.data || null;
  }

  function done(code) {
    stop();
    // A random QR (a poster, a wifi code) would otherwise be saved as the "ticket" and
    // mint a bogus recovery code — reject anything that isn't a Hội An ticket QR.
    if (!isTicketQr(code)) {
      note = s('scan_bad_ticket');
      return;
    }
    try {
      localStorage.setItem(KEY, code);
    } catch {
      // private mode / no storage — the gesture still "worked" for the visitor
    }
    saved = true;
    onsaved?.(code);
  }
</script>

{#snippet buyLink()}
  <button class="link buy" onclick={() => (showStands = !showStands)} aria-expanded={showStands}>
    {s('buy_ticket')}
  </button>
{/snippet}

{#snippet standsList()}
  {#if showStands}
    <!-- No ticket yet: the counters are where you buy one (and later redeem paper
         vouchers). Listed, not GPS-picked — offline, and useful before arrival. -->
    <ul class="stands">
      {#each tickets as p}
        <li>
          <span>{t(p.where)}</span>
          <a href={mapsUrl(p)} target="_blank" rel="noopener">{s('booth_dir')}</a>
        </li>
      {/each}
    </ul>
  {/if}
{/snippet}

<!-- QR viewfinder mark: corner brackets + three finder squares, drawn in ink so it
     reads as "scan here" without a raster asset. Also the empty-state illustration. -->
{#snippet viewfinder()}
  <svg class="vf" viewBox="0 0 100 100" role="img" aria-label="QR">
    <g class="vf-bracket" fill="none" stroke-width="4" stroke-linecap="round">
      <path d="M6 24 V12 A6 6 0 0 1 12 6 H24" />
      <path d="M76 6 H88 A6 6 0 0 1 94 12 V24" />
      <path d="M94 76 V88 A6 6 0 0 1 88 94 H76" />
      <path d="M24 94 H12 A6 6 0 0 1 6 88 V76" />
    </g>
    <g class="vf-qr" fill="currentColor">
      <path d="M28 28 h14 v14 h-14 z M32 32 v6 h6 v-6 z" fill-rule="evenodd" />
      <path d="M58 28 h14 v14 h-14 z M62 32 v6 h6 v-6 z" fill-rule="evenodd" />
      <path d="M28 58 h14 v14 h-14 z M32 62 v6 h6 v-6 z" fill-rule="evenodd" />
      <rect x="58" y="58" width="4" height="4" /><rect x="66" y="58" width="4" height="4" />
      <rect x="62" y="62" width="4" height="4" /><rect x="58" y="66" width="4" height="4" />
      <rect x="68" y="68" width="4" height="4" />
    </g>
  </svg>
{/snippet}

{#if scanning}
  <div class="frame">
    <video bind:this={video} playsinline muted></video>
    <span class="corners" aria-hidden="true"></span>
    <span class="scanline" aria-hidden="true"></span>
    <p class="hint">{s('scan_point')}</p>
    <button class="btn secondary close" onclick={stop}>{s('scan_close')}</button>
  </div>
{:else if hero}
  <div class="hero">
    <div class="vf-wrap" class:done={saved}>{@render viewfinder()}</div>
    {#if saved}
      <span class="ok">{s('scan_saved')}</span>
    {:else if supported}
      <button class="btn scan-cta" onclick={start}>{s('scan_btn')}</button>
    {:else}
      <!-- no BarcodeDetector (iOS Safari): scanning can't work, so don't dangle a
           dead button — say so and lean on skip / "where to buy". -->
      <p class="note">{s('scan_unsupported')}</p>
    {/if}
    {@render buyLink()}
    {@render standsList()}
    {#if note}<p class="note">{note}</p>{/if}
  </div>
{:else}
  <div class="strip">
    {#if saved}
      <span class="ok">{s('scan_saved')}</span>
    {:else}
      <span class="lbl">{s('plan_scan')}</span>
      <button class="link" onclick={start}>{s('scan_btn')}</button>
    {/if}
    {@render buyLink()}
  </div>
  {@render standsList()}
  {#if note}<p class="note">{note}</p>{/if}
{/if}

<style>
  /* idle: a quiet strip, not a box — scanning is optional and must not compete
     with the recommendation above it */
  .strip {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 28px;
    padding-top: 16px;
    border-top: 1px solid var(--line);
  }
  .lbl { color: var(--muted); font-size: 0.85rem; }
  .link {
    border: 0;
    background: none;
    padding: 0;
    color: var(--brand);
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .ok { color: var(--brand-dark); font-weight: 700; font-size: 0.9rem; }
  .note { margin: 8px 0 0; text-align: center; color: var(--muted); font-size: 0.82rem; }

  /* hero: the dedicated scan step. Viewfinder mark, then one real button. */
  .hero { display: flex; flex-direction: column; align-items: center; gap: 16px; }
  .vf-wrap {
    width: 128px; height: 128px;
    display: grid; place-items: center;
    border-radius: 22px;
    background: color-mix(in srgb, var(--brand) 8%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--brand) 22%, var(--line));
    color: var(--brand);
    transition: color 0.2s ease, background 0.2s ease;
  }
  .vf-wrap.done { color: var(--brand-dark); background: color-mix(in srgb, var(--gold) 18%, var(--surface)); }
  .vf { width: 84px; height: 84px; }
  .vf-bracket { stroke: currentColor; }
  .scan-cta { width: 100%; max-width: 300px; }
  .hero .buy { font-size: 0.88rem; }
  .hero .stands { width: 100%; }

  .stands {
    list-style: none;
    margin: 14px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .stands li {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
    border-top: 1px solid var(--line);
    font-size: 0.85rem;
  }
  .stands li span { color: var(--brand-dark); }
  .stands li a { flex: none; color: var(--brand); font-weight: 700; white-space: nowrap; }

  .frame {
    position: relative;
    width: 100%;
    max-width: 340px;
    aspect-ratio: 3 / 4;
    margin: 20px auto 0;
    border-radius: 16px;
    overflow: hidden;
    background: #000;
  }
  video { width: 100%; height: 100%; object-fit: cover; }
  /* live reticle: a dimmed surround with four corner brackets (not a full box) and a
     sweeping scan line — reads as an active scanner rather than a static frame. */
  .corners {
    position: absolute;
    inset: 16%;
    border-radius: 12px;
    box-shadow: 0 0 0 100vmax rgba(0, 0, 0, 0.4);
    background:
      linear-gradient(var(--brand), var(--brand)) left top,
      linear-gradient(var(--brand), var(--brand)) left top,
      linear-gradient(var(--brand), var(--brand)) right top,
      linear-gradient(var(--brand), var(--brand)) right top,
      linear-gradient(var(--brand), var(--brand)) left bottom,
      linear-gradient(var(--brand), var(--brand)) left bottom,
      linear-gradient(var(--brand), var(--brand)) right bottom,
      linear-gradient(var(--brand), var(--brand)) right bottom;
    background-repeat: no-repeat;
    background-size: 22px 3px, 3px 22px;
  }
  .scanline {
    position: absolute;
    left: 16%; right: 16%;
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--brand), transparent);
    box-shadow: 0 0 8px 1px color-mix(in srgb, var(--brand) 70%, transparent);
    animation: scan 2.2s ease-in-out infinite;
  }
  @keyframes scan {
    0%, 100% { top: 18%; }
    50% { top: 82%; }
  }
  @media (prefers-reduced-motion: reduce) {
    .scanline { animation: none; top: 50%; }
  }
  .frame .hint {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 58px;
    margin: 0;
    text-align: center;
    color: #fff;
    font-size: 0.85rem;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  }
  .close { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); }
</style>
