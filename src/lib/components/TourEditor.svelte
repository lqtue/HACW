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

  let open = $state({});
  const toggle = (id) => (open[id] = !open[id]);

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

    <div class="ed-scroll">
      <table class="ed-table">
        <thead>
          <tr>
            <th></th>
            <th>id</th>
            <th>{s('f_title')} vi</th>
            <th>{s('f_title')} en</th>
            <th>{s('f_theme')} vi</th>
            <th>{s('f_voucher')} vi</th>
            <th class="num">{s('f_stops')}</th>
            <th class="num">{s('route')}</th>
            <th></th>
          </tr>
        </thead>
        {#each list as tour, ti (tour.id)}
          {@const w = walk(tour.stops)}
          <tbody class:open={open[tour.id]}>
            <tr>
              <td>
                <button class="mini" onclick={() => toggle(tour.id)} title={s('org_details')}>
                  {open[tour.id] ? '▾' : '▸'}
                </button>
              </td>
              <!-- The id is the URL segment (/tours/<id>) and the redeemed-voucher key
                   in every visitor's localStorage — renaming one un-redeems it. -->
              <td><input bind:value={tour.id} /></td>
              <td><input bind:value={tour.title.vi} /></td>
              <td><input bind:value={tour.title.en} /></td>
              <td><input bind:value={tour.theme.vi} /></td>
              <td><input bind:value={tour.voucher.vi} /></td>
              <td class="num">{tour.stops.length}</td>
              <td class="num">{w ? formatDistance(w.meters, i18n.lang) : '—'}</td>
              <td>
                <button class="mini danger" onclick={() => list.splice(ti, 1)}>{s('org_del_tour')}</button>
              </td>
            </tr>

            {#if open[tour.id]}
              <tr class="ed-detail">
                <td colspan="9">
                  <Bi field={tour.theme} label={s('f_theme')} />
                  <Bi field={tour.description} label={s('f_desc')} rows={3} />
                  <Bi field={tour.voucher} label={s('f_voucher')} />

                  <fieldset class="ed-fieldset">
                    <legend>
                      {s('f_stops')}
                      {#if w}<small class="muted">· {s('walk', formatDistance(w.meters, i18n.lang), w.minutes)}</small>{/if}
                    </legend>
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
                    <button class="mini" disabled={!unused(list)} onclick={() => tour.stops.push(unused(list))}>
                      {s('org_add_stop')}
                    </button>
                  </fieldset>
                </td>
              </tr>
            {/if}
          </tbody>
        {/each}
      </table>
    </div>

    <button class="btn secondary" onclick={() => list.push(blankTour(list))}>{s('org_add_tour')}</button>
  {/snippet}
</JsonFile>

<style>
  .stop { display: grid; grid-template-columns: 22px minmax(0, 380px) auto auto auto; gap: 6px; align-items: center; margin: 4px 0; }
  .stop .n { font-size: var(--fs-sm); color: var(--muted); text-align: right; }
  .stop select {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid var(--line);
    border-radius: 8px;
    font-family: var(--font-body);
    font-size: var(--fs-sm);
    background: var(--bg);
  }
</style>
