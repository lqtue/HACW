<script>
  import { onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import tickets from '$lib/data/ticket-points.json';
  import { mapsUrl } from '$lib/util.js';
  import { t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';

  // Optional "scan your ticket to begin". The Hội An ticket's QR is a Vietnamese
  // e-invoice lookup code (tracuuhddt…), not machine-readable ticket contents — so
  // scanning proves a purchase and gives us a stable anonymous id, but NOT which
  // sites or 3-vs-5. That's why the planner never gates on it: iOS has no
  // BarcodeDetector, so this stays a bonus gesture, not the only door.
  // ponytail: native BarcodeDetector only, no QR-decode dependency. If iOS scan
  // becomes a must-have, add a wasm decoder behind the same `supported` check.
  const KEY = 'hacw_ticket_v1';
  let { onsaved } = $props();

  const supported =
    typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices;

  let saved = $state(
    typeof localStorage !== 'undefined' && !!localStorage.getItem(KEY)
  );
  let scanning = $state(false);
  let showStands = $state(false); // "where to buy?" -> the ticket-counter list
  let note = $state('');
  let video = $state();
  let stream = null;
  let raf = 0;

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
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      const tick = async () => {
        if (!scanning) return;
        try {
          const codes = await detector.detect(video);
          if (codes.length && codes[0].rawValue) return done(codes[0].rawValue);
        } catch {
          // a transient decode failure is fine — keep polling
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } catch {
      note = s('scan_unsupported');
      stop();
    }
  }

  function done(code) {
    stop();
    try {
      localStorage.setItem(KEY, code);
    } catch {
      // private mode / no storage — the gesture still "worked" for the visitor
    }
    saved = true;
    onsaved?.(code);
  }
</script>

{#if scanning}
  <div class="frame">
    <video bind:this={video} playsinline muted></video>
    <span class="reticle" aria-hidden="true"></span>
    <p class="hint">{s('scan_point')}</p>
    <button class="btn secondary close" onclick={stop}>{s('scan_close')}</button>
  </div>
{:else}
  <div class="strip">
    {#if saved}
      <span class="ok">{s('scan_saved')}</span>
    {:else}
      <span class="lbl">{s('plan_scan')}</span>
      <button class="link" onclick={start}>{s('scan_btn')}</button>
    {/if}
    <button class="link" onclick={() => (showStands = !showStands)} aria-expanded={showStands}>
      {s('buy_ticket')}
    </button>
  </div>
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
  .reticle {
    position: absolute;
    inset: 16%;
    border: 3px solid rgba(255, 255, 255, 0.92);
    border-radius: 12px;
    box-shadow: 0 0 0 100vmax rgba(0, 0, 0, 0.35);
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
