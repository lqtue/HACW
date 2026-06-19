<script>
  import '../app.css';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { flush } from '$lib/passport.svelte.js';

  let { children } = $props();

  const tabs = [
    { path: '/', label: 'Giới thiệu', ico: '🏮' },
    { path: '/destinations', label: 'Khám phá', ico: '🗺️' },
    { path: '/tours', label: 'Tuyến', ico: '🚶' },
    { path: '/passport', label: 'Hộ chiếu', ico: '📖' }
  ];

  const href = (p) => base + (p === '/' ? '/' : p);

  // Flush queued check-ins on load and whenever connectivity returns.
  onMount(() => {
    flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  });

  // pathname includes the base prefix -> strip it before matching
  const rel = $derived($page.url.pathname.slice(base.length) || '/');
  const isActive = (p) => (p === '/' ? rel === '/' : rel.startsWith(p));
</script>

<div class="app">
  {@render children()}
</div>

<nav class="nav">
  {#each tabs as t}
    <a href={href(t.path)} aria-current={isActive(t.path) ? 'page' : undefined}>
      <span class="ico">{t.ico}</span>
      {t.label}
    </a>
  {/each}
</nav>
