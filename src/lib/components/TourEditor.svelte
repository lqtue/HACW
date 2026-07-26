<script>
  import tours from '$lib/data/tours.json';
  import destinations from '$lib/data/destinations.json';
  import { checkTours } from '$lib/editor.js';
  import { t, i18n } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';
  import { routeStats, formatDistance } from '$lib/route.js';
  import JsonFile from './JsonFile.svelte';
  import Bi from './Bi.svelte';

  const ids = destinations.map((d) => d.id);
  const byId = Object.fromEntries(destinations.map((d) => [d.id, d]));

  // Stop order is the walking order, so show what a reorder costs.
  const walk = (stops) => {
    const pts = stops.map((id) => byId[id]).filter(Boolean);
    return pts.length > 1 ? routeStats(pts) : null;
  };

  const move = (stops, i, by) => {
    const to = i + by;
    if (to < 0 || to >= stops.length) return;
    stops.splice(to, 0, stops.splice(i, 1)[0]);
  };

  // First site not already claimed by any tour — the validator rejects a stop in
  // two tours, so offering one would just be offering an error.
  const unused = (list) => {
    const taken = new Set(list.flatMap((x) => x.stops));
    return ids.find((id) => !taken.has(id));
  };

  const blankTour = (list) => ({
    id: `tuyen-${list.length + 1}`,
    title: { vi: '', en: '' },
    theme: { vi: '', en: '' },
    description: { vi: '', en: '' },
    voucher: { vi: '', en: '' },
    stops: []
  });
</script>

<JsonFile name="tours.json" original={tours} check={(d) => checkTours(d, ids)}>
  {#snippet children(list)}
    <p class="muted"><small>{s('org_tours_hint')}</small></p>

    {#each list as tour, ti (tour.id)}
      {@const w = walk(tour.stops)}
      <details class="ed-item">
        <summary>
          <strong>{tour.title.vi || tour.id}</strong>
          <small class="muted">· {s('stops', tour.stops.length)}{#if w} · {formatDistance(w.meters, i18n.lang)}{/if}</small>
          <button class="mini danger" onclick={() => list.splice(ti, 1)}>{s('org_del_tour')}</button>
        </summary>

        <!-- The id is the URL segment (/tours/<id>) and the redeemed-voucher key in
             every visitor's localStorage — renaming one after launch un-redeems it. -->
        <label class="ed-row"><span>id</span><input bind:value={tour.id} /></label>
        <Bi field={tour.title} label={s('f_title')} />
        <Bi field={tour.theme} label={s('f_theme')} />
        <Bi field={tour.description} label={s('f_desc')} rows={3} />
        <Bi field={tour.voucher} label={s('f_voucher')} />

        <fieldset class="ed-fieldset">
          <legend>{s('f_stops')} {#if w}<small class="muted">· {s('walk', formatDistance(w.meters, i18n.lang), w.minutes)}</small>{/if}</legend>
          {#each tour.stops as stop, si}
            <div class="stop">
              <span class="n">{si + 1}</span>
              <select bind:value={tour.stops[si]}>
                {#each destinations as d}<option value={d.id}>{d.code} · {t(d.name)}</option>{/each}
              </select>
              <button class="mini" disabled={si === 0} onclick={() => move(tour.stops, si, -1)}>↑</button>
              <button class="mini" disabled={si === tour.stops.length - 1} onclick={() => move(tour.stops, si, 1)}>↓</button>
              <button class="mini danger" onclick={() => tour.stops.splice(si, 1)}>✕</button>
            </div>
          {/each}
          <button
            class="mini"
            disabled={!unused(list)}
            onclick={() => tour.stops.push(unused(list))}
          >
            {s('org_add_stop')}
          </button>
        </fieldset>
      </details>
    {/each}

    <button class="btn secondary" onclick={() => list.push(blankTour(list))}>{s('org_add_tour')}</button>
  {/snippet}
</JsonFile>

<style>
  .stop { display: grid; grid-template-columns: 22px 1fr auto auto auto; gap: 6px; align-items: center; margin: 4px 0; }
  .stop .n { font-size: 0.8rem; color: var(--muted); text-align: right; }
  .stop select {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid var(--line);
    border-radius: 8px;
    font-family: var(--font-body);
    font-size: 0.9rem;
    background: var(--bg);
  }
</style>
