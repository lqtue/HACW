<script>
  // The themed-set accordion, shared by the planner's "Gợi ý cho bạn" and the passport's
  // "Hành trình đề xuất": one card per set, single-open, the head carrying title, theme
  // and walk cost, the body its narrative, numbered stops and one action.
  //
  // The two screens differ only in what the action does — the planner adopts the set as
  // your plan (`onpick`), the passport opens the tour page (`hrefFor`) — and in whether a
  // stop is already stamped, which `stamped` answers.
  import { routeStats, formatDistance } from '$lib/route.js';
  import { i18n, t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';

  /** @type {{
   *   sets: any[],                      // { id, title, theme, description, stops: dest[] , walkM?, walkMin? }
   *   badge?: boolean,                  // mark the first card as the recommendation
   *   open?: string | null,             // id of the open card (bindable)
   *   actionLabel: string,
   *   onpick?: (set: any) => void,      // button action
   *   hrefFor?: (set: any) => string,   // link action (wins over onpick)
   *   stamped?: (id: string) => boolean // stop already checked in → ✓ and a dimmed number
   * }} */
  let { sets, badge = false, open = $bindable(null), actionLabel, onpick, hrefFor, stamped } = $props();

  // rankSets pre-computes the cost for the planner; the passport passes plain tours, so
  // fall back to measuring the authored order here
  const cost = (set) =>
    set.walkM != null ? { meters: set.walkM, minutes: set.walkMin } : routeStats(set.stops);
  const doneCount = (set) => (stamped ? set.stops.filter((d) => stamped(d.id)).length : 0);
</script>

<ul class="sets">
  {#each sets as set, i (set.id)}
    {@const isOpen = open === set.id}
    {@const c = cost(set)}
    {@const done = doneCount(set)}
    <li class="setcard" class:top={badge && i === 0}>
      <button class="set-head" onclick={() => (open = isOpen ? null : set.id)} aria-expanded={isOpen}>
        <span class="set-h-body">
          {#if badge && i === 0}<span class="rec-badge">✦ {s('rec_badge')}</span>{/if}
          <b>{t(set.title)}</b>
          <small>{t(set.theme)}</small>
          {#if !isOpen}
            <small class="set-dist">
              {formatDistance(c.meters, i18n.lang)} · {s('walk_time', c.minutes)}{#if stamped} · {done}/{set.stops.length} ✓{/if}
            </small>
          {/if}
        </span>
        <span class="caret" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
      </button>
      {#if isOpen}
        <div class="set-body">
          {#if set.description}<p class="narr">{t(set.description)}</p>{/if}
          <ul class="stops">
            {#each set.stops as d, si (d.id)}
              {@const got = stamped?.(d.id)}
              <li class:got>
                <span class="n" style="--cat: var(--c-{d.category})">{got ? '✓' : si + 1}</span>
                <b>{t(d.name)}</b>
              </li>
            {/each}
          </ul>
          {#if hrefFor}
            <a class="btn" href={hrefFor(set)}>{actionLabel}</a>
          {:else}
            <button class="btn" onclick={() => onpick?.(set)}>{actionLabel}</button>
          {/if}
        </div>
      {/if}
    </li>
  {/each}
</ul>

<style>
  .sets { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
  .setcard {
    position: relative;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .setcard.top { border-color: color-mix(in srgb, var(--brand) 55%, var(--line)); }
  .set-head {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border: 0;
    background: none;
    cursor: pointer;
    text-align: left;
  }
  .set-h-body { flex: 1 1 auto; min-width: 0; display: grid; gap: 2px; }
  .set-h-body b { font-size: var(--fs-lg); font-weight: 700; letter-spacing: -0.01em; }
  .set-h-body small { color: var(--muted); font-size: var(--fs-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .set-h-body .set-dist { color: var(--ink); font-weight: 600; margin-top: 2px; }
  .caret { flex: 0 0 auto; color: var(--muted); }
  .set-body { padding: 0 16px 16px; display: flex; flex-direction: column; gap: 10px; }
  .rec-badge {
    justify-self: start;
    background: var(--brand);
    color: #fff;
    font-size: var(--fs-xs);
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 2px 9px;
    border-radius: 999px;
    margin-bottom: 2px;
  }
  .narr { margin: 0; color: var(--muted); font-size: var(--fs-sm); line-height: 1.5; }
  .stops { list-style: none; margin: 0; padding: 8px 0 0; border-top: 1px solid var(--line); display: flex; flex-direction: column; gap: 8px; }
  .stops li { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .stops b { font-weight: 600; font-size: var(--fs-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .stops li.got b { color: var(--muted); }
  .stops .n {
    flex: 0 0 auto;
    width: 24px; height: 24px;
    display: grid; place-items: center;
    border-radius: 999px;
    background: var(--cat);
    color: #fff;
    font-size: var(--fs-sm);
    font-weight: 700;
  }
  .btn { margin-top: 2px; text-align: center; }
</style>
