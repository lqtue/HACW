<script>
  import { onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { isTicketQr } from '$lib/ticket.js';
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
  let { onsaved, hero = false, bare = false } = $props();

  // Any device with a camera can scan now — the decoder is chosen at start().
  const supported =
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const hasBD = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  let saved = $state(
    typeof localStorage !== 'undefined' && !!localStorage.getItem(KEY)
  );
  let scanning = $state(false);
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

  export async function start() {
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
    <button class="btn secondary close" onclick={stop}>{s('close_btn')}</button>
  </div>
{:else if hero}
  <!-- viewfinder mark only; the buy / scan / continue buttons are the page's footer
       (it drives start() via bind:this) so every onboarding screen shares one layout.
       `bare` drops the mark, and with nothing left to say draws nothing at all — an
       empty hero would still claim the middle of the screen. -->
  {#if !bare || saved || !supported || note}
    <div class="hero" class:bare>
      {#if !bare}<div class="vf-wrap" class:done={saved}>{@render viewfinder()}</div>{/if}
      {#if saved}<p class="lead">{s('scan_saved')}</p>
      {:else if !bare}<p class="lead">{s('scan_why')}</p>{/if}
      {#if !supported}<p class="lead muted">{s('scan_unsupported')}</p>{/if}
      {#if note}<p class="lead muted">{note}</p>{/if}
    </div>
  {/if}
{:else}
  <!-- quiet "already have a ticket?" footer — same button language as onboarding:
       white buy above, orange scan below -->
  <div class="strip">
    {#if saved}
      <span class="ok">{s('scan_saved_short')}</span>
    {:else}
      <span class="lbl">{s('plan_scan')}</span>
      <button class="btn ghost" onclick={() => goto(`${base}/destinations?tickets=1`)}>{s('buy_ticket')}</button>
      <button class="btn" onclick={start}>{s('scan_btn')}</button>
    {/if}
  </div>
  {#if note}<p class="note">{note}</p>{/if}
{/if}

<style>
  /* no mark: the page owns the middle, this only carries messages */
  .hero.bare { flex: 0 0 auto; min-height: 0; }
  /* idle: a quiet strip, not a box — scanning is optional and must not compete
     with the recommendation above it */
  .strip {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    margin-top: 28px;
    padding-top: 16px;
    border-top: 1px solid var(--line);
  }
  .lbl { color: var(--muted); font-size: var(--fs-sm); text-align: center; }
  .strip .btn { width: 100%; }
  .ok { color: var(--brand-dark); font-weight: 700; font-size: var(--fs-sm); text-align: center; }
  .note { margin: 8px 0 0; text-align: center; color: var(--muted); font-size: var(--fs-sm); }

  /* hero: just the viewfinder mark, centred; the buttons live in the page footer */
  .hero { flex: 1 1 auto; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; }
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
    font-size: var(--fs-sm);
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  }
  .close { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); }
</style>
