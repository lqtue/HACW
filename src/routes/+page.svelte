<script>
  import event from '$lib/data/event.json';
  import { base } from '$app/paths';
  import { passport } from '$lib/passport.svelte.js';
  import destinations from '$lib/data/destinations.json';
  import { t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';
  import InstallApp from '$lib/components/InstallApp.svelte';
</script>

<div class="topbar">
  <h1>{event.title}</h1>
  <small>{t(event.subtitle)} · {event.dates}</small>
</div>

<div class="page">
  <p>{t(event.intro)}</p>

  <div class="banner">
    📖 {s('collected', passport.stamps.length, destinations.length)}
    <a href="{base}/passport" style="color: var(--brand); font-weight: 600">{s('view_passport')}</a>
  </div>

  <h2>{s('how_it_works')}</h2>
  <ol>
    {#each event.howItWorks as step}
      <li style="margin-bottom: 6px">{t(step)}</li>
    {/each}
  </ol>
  <p class="muted"><small>{t(event.note)}</small></p>

  <div style="display: flex; gap: 10px; margin-top: 20px">
    <a class="btn" href="{base}/destinations">{s('open_map')}</a>
    <a class="btn secondary" href="{base}/tours">{s('see_tours')}</a>
  </div>

  <InstallApp />
</div>
