<script>
  import event from '$lib/data/event.json';
  import { checkEvent } from '$lib/editor.js';
  import { s } from '$lib/strings.js';
  import JsonFile from './JsonFile.svelte';
  import Bi from './Bi.svelte';
</script>

<JsonFile name="event.json" original={event} check={checkEvent}>
  {#snippet children(ev)}
    <p class="muted"><small>{s('org_event_hint')}</small></p>

    <div class="ed-item">
      <!-- title and dates are proper nouns / a date range: one language on purpose. -->
      <label class="ed-row"><span>{s('f_title')}</span><input bind:value={ev.title} /></label>
      <label class="ed-row"><span>{s('f_year')}</span><input bind:value={ev.year} /></label>
      <label class="ed-row"><span>{s('f_dates')}</span><input bind:value={ev.dates} /></label>
      <Bi field={ev.tagline} label={s('f_tagline')} />
      <Bi field={ev.subtitle} label={s('f_subtitle')} />
      <Bi field={ev.venue} label={s('f_venue')} />
      <Bi field={ev.intro} label={s('f_intro')} rows={5} />
      <Bi field={ev.note} label={s('f_note')} rows={4} />
    </div>

    <fieldset class="ed-fieldset">
      <legend>{s('f_steps')}</legend>
      {#each ev.howItWorks as step, i}
        <div class="ed-item">
          <Bi field={step} label={`${i + 1}`} rows={2} />
          <button class="mini" disabled={i === 0} onclick={() => ev.howItWorks.splice(i - 1, 0, ev.howItWorks.splice(i, 1)[0])}>↑</button>
          <button class="mini danger" disabled={ev.howItWorks.length <= 1} onclick={() => ev.howItWorks.splice(i, 1)}>
            {s('org_del_step')}
          </button>
        </div>
      {/each}
      <button class="mini" onclick={() => ev.howItWorks.push({ vi: '', en: '' })}>{s('org_add_step')}</button>
    </fieldset>
  {/snippet}
</JsonFile>
