<script>
  import { base } from '$app/paths';
  import destinations from '$lib/data/destinations.json';
  import tours from '$lib/data/tours.json';
  import { passport, hasStamp, isSetComplete, isRedeemed } from '$lib/passport.svelte.js';
  import { categoryLabel } from '$lib/util.js';
  import { t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';

  const total = destinations.length;
  const count = $derived(passport.stamps.length);

  function setProgress(stops) {
    return stops.filter((id) => hasStamp(id)).length;
  }
</script>

<div class="topbar"><h1>{s('passport_title')}</h1><small>{s('stamps_of', count, total)}</small></div>

<div class="page">
  <!-- themed sets -> voucher redemption -->
  <div class="sets">
    {#each tours as tour}
      <a class="set" class:complete={isSetComplete(tour.stops)} href="{base}/tours/{tour.id}">
        <span class="ico">{isRedeemed(tour.id) ? '✅' : isSetComplete(tour.stops) ? '🎁' : '🚶'}</span>
        <span class="info">
          <strong>{t(tour.title)}</strong>
          <small class="muted">{setProgress(tour.stops)}/{tour.stops.length}</small>
        </span>
      </a>
    {/each}
  </div>

  <div class="grid">
    {#each destinations as d}
      {@const got = hasStamp(d.id)}
      <a class="stamp" class:got href="{base}/destinations/{d.id}" style="--cat: var(--c-{d.category})">
        <div class="seal">
          {#if got}<span>{t(d.name).charAt(0)}</span>{:else}<span class="lock">?</span>{/if}
        </div>
        <small class="name">{t(d.name)}</small>
        <small class="muted">{got ? t(categoryLabel(d.category)) : s('not_yet')}</small>
      </a>
    {/each}
  </div>

  {#if count === total}
    <div class="banner" style="margin-top: 16px; text-align: center">{s('all_done')}</div>
  {/if}
</div>

<style>
  .sets { display: grid; gap: 10px; margin-bottom: 18px; }
  .set {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 12px 14px;
    box-shadow: var(--shadow);
  }
  .set.complete { border-color: color-mix(in srgb, var(--gold) 55%, var(--line)); }
  .set .ico { font-size: 1.5rem; }
  .set .info { display: grid; }

  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .stamp {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 16px 14px;
    text-align: center;
    display: grid;
    gap: 5px;
    justify-items: center;
    box-shadow: var(--shadow);
  }
  .stamp .name { font-weight: 600; }
  .stamp:not(.got) { box-shadow: none; }
  .stamp:not(.got) .name { color: var(--muted); }

  .seal {
    width: 76px; height: 76px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-family: var(--font-display);
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: 4px;
    border: 2px dashed var(--line);
    color: var(--muted);
  }
  .stamp.got .seal {
    border: 2px solid var(--cat);
    box-shadow: inset 0 0 0 4px color-mix(in srgb, var(--cat) 14%, var(--surface));
    background: color-mix(in srgb, var(--cat) 9%, var(--surface));
    color: var(--cat);
    transform: rotate(-5deg);
  }
  .lock { font-family: var(--font-body); font-weight: 500; }
</style>
