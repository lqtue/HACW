<script>
  import '../app.css';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { flush, backup } from '$lib/passport.svelte.js';
  import { loadCounts } from '$lib/stats.svelte.js';
  import { unlockFromUrl } from '$lib/staff.svelte.js';
  import { i18n, setLang } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';

  let { children } = $props();

  const tabs = [
    { path: '/', key: 'intro', ico: '🏮' },
    { path: '/destinations', key: 'explore', ico: '🗺️' },
    { path: '/tours', key: 'tours', ico: '🚶' },
    { path: '/passport', key: 'passport', ico: '📖' }
  ];

  const href = (p) => base + (p === '/' ? '/' : p);

  // Catch up on load and whenever connectivity returns: send queued check-ins,
  // re-upload the passport backup, refresh the counts that drive the spotlight.
  function sync() {
    flush();
    backup();
    loadCounts();
  }

  onMount(() => {
    unlockFromUrl($page.url);
    sync();
    window.addEventListener('online', sync);
    // Leaving the page cuts the debounce in passport.svelte.js short, so the last
    // stamp of a visit reaches the dashboard now rather than on the next open.
    const leave = () => {
      flush();
      backup();
    };
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('pagehide', leave);
    };
  });

  const rel = $derived($page.url.pathname.slice(base.length) || '/');
  const isActive = (p) => (p === '/' ? rel === '/' : rel.startsWith(p));
</script>

<button class="lang" onclick={() => setLang(i18n.lang === 'vi' ? 'en' : 'vi')} aria-label="Language">
  {i18n.lang === 'vi' ? 'EN' : 'VI'}
</button>

<!-- /organizer is desk software; every other route is a phone column. -->
<div class="app" class:wide={rel.startsWith('/organizer')}>
  {@render children()}
</div>

<nav class="nav">
  {#each tabs as t}
    <a href={href(t.path)} aria-current={isActive(t.path) ? 'page' : undefined}>
      <span class="ico">{t.ico}</span>
      {s(t.key)}
    </a>
  {/each}
</nav>

<style>
  .lang {
    position: fixed;
    top: max(14px, calc(env(safe-area-inset-top) + 6px));
    right: 12px;
    z-index: 1100;
    border: 1.5px solid color-mix(in srgb, var(--brand) 40%, transparent);
    background: rgba(255, 247, 239, 0.9);
    color: var(--brand-dark);
    border-radius: 999px;
    width: 42px;
    height: 34px;
    font-family: var(--font-body);
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    cursor: pointer;
    backdrop-filter: blur(8px);
    box-shadow: var(--shadow);
  }
</style>
