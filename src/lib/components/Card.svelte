<script>
  import { base } from '$app/paths';
  import { categoryLabel, categoryIcon, mapsUrl } from '$lib/util.js';
  import { hasStamp } from '$lib/passport.svelte.js';

  /** @type {{ dest: any, index?: number }} */
  let { dest, index } = $props();
</script>

<div class="card">
  <a class="thumb" href="{base}/destinations/{dest.id}" style="background: var(--c-{dest.category})">
    {#if index != null}{index}{:else}{categoryIcon(dest.category)}{/if}
  </a>
  <a class="body" href="{base}/destinations/{dest.id}">
    <span class="tag" style="background: var(--c-{dest.category})">{categoryLabel(dest.category)}</span>
    <h3>{dest.name} {#if hasStamp(dest.id)}✅{/if}</h3>
    <small>{dest.hours} · {dest.address}</small>
  </a>
  <a
    class="dir"
    href={mapsUrl(dest)}
    target="_blank"
    rel="noopener"
    aria-label="Chỉ đường tới {dest.name}"
  >➤</a>
</div>

<style>
  .dir {
    flex: 0 0 auto;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--bg);
    border: 1px solid var(--line);
    color: var(--brand);
    transform: rotate(-45deg);
  }
  .tag { margin-bottom: 4px; }
</style>
