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

  // three tabs, matching the sample. Organizer is reached by URL (staff), not nav.
  const tabs = [
    { path: '/', key: 'plan', icon: 'plan' },
    { path: '/destinations', key: 'explore', icon: 'map' },
    { path: '/passport', key: 'passport', icon: 'passport' }
  ];
  const href = (p) => base + (p === '/' ? '/' : p);

  function sync() {
    flush();
    backup();
    loadCounts();
  }
  onMount(() => {
    unlockFromUrl($page.url);
    sync();
    window.addEventListener('online', sync);
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
  const wide = $derived(rel.startsWith('/organizer'));
</script>

<button class="lang" onclick={() => setLang(i18n.lang === 'vi' ? 'en' : 'vi')} aria-label="Language">
  {i18n.lang === 'vi' ? 'EN' : 'VI'}
</button>

<div class="app" class:wide>
  {@render children()}
</div>

{#if !wide}
  <nav class="nav" aria-label="Main">
    {#each tabs as t (t.path)}
      <a href={href(t.path)} aria-current={isActive(t.path) ? 'page' : undefined}>
        <span class="ico" aria-hidden="true">
          {#if t.icon === 'plan'}
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" /></svg>
          {:else if t.icon === 'map'}
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" stroke-linejoin="round" /><path d="M9 4v14M15 6v14" /></svg>
          {:else}
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 20 12 12 21 4 12 12 3Z" stroke-linejoin="round" /></svg>
          {/if}
        </span>
        {s(t.key)}
      </a>
    {/each}
  </nav>
{/if}

<style>
  .lang {
    position: fixed;
    top: max(14px, calc(env(safe-area-inset-top) + 6px));
    right: 14px;
    z-index: 1100;
    border: 1px solid var(--line);
    background: color-mix(in srgb, var(--surface) 80%, transparent);
    color: var(--ink);
    border-radius: 999px;
    width: 44px;
    height: 34px;
    font-family: var(--font-body);
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    cursor: pointer;
    backdrop-filter: blur(10px);
  }
</style>
