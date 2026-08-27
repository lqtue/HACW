<script>
  import destinations from '$lib/data/destinations.json';
  import categories from '$lib/data/categories.json';
  import { checkDestinations } from '$lib/editor.js';
  import { t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';
  import JsonFile from './JsonFile.svelte';
  import Bi from './Bi.svelte';

  const catIds = categories.map((c) => c.id);
  const LEVELS = ['low', 'medium', 'high'];

  // Which rows have their detail open — a map, not a single id, because comparing
  // the intro copy of two sites is a normal thing to want. A $state object is a
  // deep proxy, so mutating one key is enough to re-render that row.
  let open = $state({});
  const toggle = (id) => (open[id] = !open[id]);

  const blank = () => ({
    question: { vi: '', en: '' },
    options: [
      { vi: '', en: '' },
      { vi: '', en: '' }
    ],
    answer: 0
  });
</script>

<JsonFile name="destinations.json" original={destinations} check={(d) => checkDestinations(d, catIds)}>
  {#snippet children(list)}
    <div class="ed-scroll">
      <table class="ed-table">
        <thead>
          <tr>
            <th></th>
            <th>{s('f_code')}</th>
            <th>{s('f_name')} vi</th>
            <th>{s('f_name')} en</th>
            <th>{s('f_category')}</th>
            <th class="num">lat</th>
            <th class="num">lng</th>
            <th class="num">{s('f_radius')}</th>
            <th>{s('org_traffic')}</th>
            <th>{s('org_priority')}</th>
            <th>{s('org_needs_survey')}</th>
            <th class="num">{s('f_question')}</th>
          </tr>
        </thead>
        {#each list as d (d.id)}
          <tbody class:open={open[d.id]}>
            <tr>
              <td>
                <button class="mini" onclick={() => toggle(d.id)} title={s('org_details')}>
                  {open[d.id] ? '▾' : '▸'}
                </button>
              </td>
              <td class="code">{d.code}</td>
              <td><input bind:value={d.name.vi} /></td>
              <td><input bind:value={d.name.en} /></td>
              <td>
                <select bind:value={d.category}>
                  {#each categories as c}<option value={c.id}>{t(c.label)}</option>{/each}
                </select>
              </td>
              <td><input class="short" type="number" step="0.0000001" bind:value={d.lat} /></td>
              <td><input class="short" type="number" step="0.0000001" bind:value={d.lng} /></td>
              <td><input class="short" type="number" step="5" bind:value={d.radius} /></td>
              <td>
                <select bind:value={d.traffic}>
                  {#each LEVELS as v}<option value={v}>{s(`lvl_${v}`)}</option>{/each}
                </select>
              </td>
              <td>
                <select bind:value={d.promoPriority}>
                  {#each LEVELS as v}<option value={v}>{s(`lvl_${v}`)}</option>{/each}
                </select>
              </td>
              <td><input type="checkbox" bind:checked={d.needsSurvey} /></td>
              <td class="num">
                {d.quizBank.length}
              </td>
            </tr>

            {#if open[d.id]}
              <tr class="ed-detail">
                <td colspan="12">
                  <Bi field={d.address} label={s('f_address')} />
                  <Bi field={d.hours} label={s('f_hours')} />
                  <Bi field={d.description} label={s('f_desc')} rows={4} />

                  {#each d.quizBank as q, qi}
                    <fieldset class="ed-fieldset">
                      <legend>
                        {s('f_question')} {qi + 1}
                        <button class="mini danger" onclick={() => d.quizBank.splice(qi, 1)}>{s('org_del_q')}</button>
                      </legend>

                      <Bi field={q.question} label={s('f_question')} rows={2} />

                      <p class="muted"><small>{s('org_answer')} ◉</small></p>
                      {#each q.options as o, oi}
                        <div class="ed-opt">
                          <input type="radio" name="{d.id}-{qi}" value={oi} bind:group={q.answer} />
                          <input bind:value={o.vi} placeholder="vi" />
                          <input bind:value={o.en} placeholder="en" />
                          <button
                            class="mini danger"
                            disabled={q.options.length <= 2}
                            onclick={() => {
                              q.options.splice(oi, 1);
                              if (q.answer >= q.options.length) q.answer = 0;
                            }}
                          >
                            {s('org_del_opt')}
                          </button>
                        </div>
                      {/each}
                      <button class="mini" onclick={() => q.options.push({ vi: '', en: '' })}>{s('org_add_opt')}</button>
                    </fieldset>
                  {/each}

                  <button class="btn secondary" onclick={() => d.quizBank.push(blank())}>{s('org_add_q')}</button>
                </td>
              </tr>
            {/if}
          </tbody>
        {/each}
      </table>
    </div>
  {/snippet}
</JsonFile>
