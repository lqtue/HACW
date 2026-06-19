<script>
  import { base } from '$app/paths';
  import tours from '$lib/data/tours.json';
  import { isSetComplete } from '$lib/passport.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';
</script>

<div class="topbar"><h1>{s('tours_title')}</h1><small>{s('tours_sub')}</small></div>

<div class="page">
  {#each tours as tour}
    <a class="card" href="{base}/tours/{tour.id}">
      <div class="thumb">{isSetComplete(tour.stops) ? '🎁' : '🚶'}</div>
      <div class="body">
        <span class="tag" style="background: var(--teal)">{t(tour.theme)}</span>
        <h3>{t(tour.title)}</h3>
        <small>{s('stops', tour.stops.length)}</small>
      </div>
    </a>
  {/each}
</div>
