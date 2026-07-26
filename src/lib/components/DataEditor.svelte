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

  const blank = () => ({
    difficulty: 'easy',
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
    {#each list as d (d.id)}
      <details class="ed-item">
        <summary>
          <strong>{d.code}</strong>
          {d.name.vi}
          <small class="muted">· {d.quizBank.length} q</small>
          {#if d.needsSurvey}<small class="ed-tag">{s('org_needs_survey')}</small>{/if}
          {#if d.quizBank.some((q) => q.generated)}<small class="ed-tag">{s('org_generated')}</small>{/if}
        </summary>

        <Bi field={d.name} label={s('f_name')} />
        <Bi field={d.address} label={s('f_address')} />
        <Bi field={d.hours} label={s('f_hours')} />
        <Bi field={d.description} label={s('f_desc')} rows={4} />

        <div class="ed-grid">
          <label class="ed-row">
            <span>{s('f_category')}</span>
            <select bind:value={d.category}>
              {#each categories as c}<option value={c.id}>{t(c.label)}</option>{/each}
            </select>
          </label>
          <label class="ed-row"><span>lat</span><input type="number" step="0.0000001" bind:value={d.lat} /></label>
          <label class="ed-row"><span>lng</span><input type="number" step="0.0000001" bind:value={d.lng} /></label>
          <label class="ed-row"><span>{s('f_radius')}</span><input type="number" step="5" bind:value={d.radius} /></label>
          <label class="ed-row">
            <span>{s('org_traffic')}</span>
            <select bind:value={d.traffic}>
              {#each LEVELS as v}<option value={v}>{s(`lvl_${v}`)}</option>{/each}
            </select>
          </label>
          <label class="ed-row">
            <span>{s('org_priority')}</span>
            <select bind:value={d.promoPriority}>
              {#each LEVELS as v}<option value={v}>{s(`lvl_${v}`)}</option>{/each}
            </select>
          </label>
          <label class="ed-row check">
            <input type="checkbox" bind:checked={d.needsSurvey} />
            <span>{s('org_needs_survey')}</span>
          </label>
        </div>

        {#each d.quizBank as q, qi}
          <fieldset class="ed-fieldset">
            <legend>
              {s('f_question')} {qi + 1}
              {#if q.generated}
                <small class="ed-tag">{s('org_generated')}</small>
                <!-- The flag is what /organizer lists as to-do, so clearing it is the "done" button. -->
                <button class="mini" onclick={() => delete d.quizBank[qi].generated}>{s('org_reviewed')}</button>
              {/if}
              <button class="mini danger" onclick={() => d.quizBank.splice(qi, 1)}>{s('org_del_q')}</button>
            </legend>

            <label class="ed-row">
              <span>{s('f_difficulty')}</span>
              <select bind:value={q.difficulty}>
                {#each ['easy', 'hard'] as v}<option value={v}>{s(`lvl_${v}`)}</option>{/each}
              </select>
            </label>
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
      </details>
    {/each}
  {/snippet}
</JsonFile>
