<script>
  import '../app.css';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { flush, backup } from '$lib/passport.svelte.js';
  import { loadCounts } from '$lib/stats.svelte.js';
  import { unlockFromUrl } from '$lib/staff.svelte.js';
  import { plan } from '$lib/plan.svelte.js';
  import { ui } from '$lib/ui.svelte.js';
  import { theme, toggleTheme } from '$lib/theme.svelte.js';
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
    // DEV-only: fake a Hội An GPS fix so the location dot + heading beam are visible
    // on desktop. Stripped from the prod build (import.meta.env.DEV is false there).
    if (import.meta.env.DEV) import('$lib/dev-geo.js').then((m) => m.installFakeGeo());

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
  // hide the tab bar through the pre-onboarding door/language/welcome/scan run, so
  // those read as full-screen single-job screens (the door isn't skippable past).
  // Gate on the forced ?step too, not just plan.onboarded — otherwise a device that
  // has onboarded (e.g. the /screens board frames) shows the bar on those previews.
  const stepParam = $derived($page.url.searchParams.get('step') || '');
  const onboarding = $derived(
    rel === '/' && (!plan.onboarded || /^(door|lang|welcome|scan|perms)$/.test(stepParam))
  );
</script>

<button class="chip-fab theme" onclick={toggleTheme} aria-label="Theme" title="Theme">
  {theme.mode === 'dark' ? '☀' : '☾'}
</button>

<div class="app" class:wide>
  {@render children()}
</div>

{#if !wide && !onboarding && !ui.hideNav}
  <nav class="nav" aria-label="Main">
    {#each tabs as t (t.path)}
      <a href={href(t.path)} aria-current={isActive(t.path) ? 'page' : undefined}>
        <span class="ico" aria-hidden="true">
          {#if t.icon === 'plan'}
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" /></svg>
          {:else if t.icon === 'map'}
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" stroke-linejoin="round" /><path d="M9 4v14M15 6v14" /></svg>
          {:else}
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.6" /><path d="M5.5 20c0-3.7 2.9-6 6.5-6s6.5 2.3 6.5 6" stroke-linecap="round" /></svg>
          {/if}
        </span>
        {s(t.key)}
      </a>
    {/each}
  </nav>
{/if}

<style>
  .chip-fab {
    position: fixed;
    top: max(30px, calc(env(safe-area-inset-top) + 20px));
    z-index: 1100;
    border: 1px solid var(--line);
    background: color-mix(in srgb, var(--surface) 80%, transparent);
    color: var(--ink);
    border-radius: 999px;
    height: 34px;
    font-family: var(--font-body);
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    cursor: pointer;
    backdrop-filter: blur(10px);
  }
  .theme { right: 14px; width: 40px; font-size: 1rem; }
</style>
