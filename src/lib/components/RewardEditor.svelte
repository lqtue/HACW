<script>
  import rewards from '$lib/data/rewards.json';
  import destinations from '$lib/data/destinations.json';
  import { checkRewards } from '$lib/editor.js';
  import { s } from '$lib/strings.js';
  import JsonFile from './JsonFile.svelte';
  import Bi from './Bi.svelte';

  const siteCount = destinations.length;

  const blankTier = (list) => ({
    id: `tier-${list.length + 1}`,
    stamps: (list.at(-1)?.stamps ?? 0) + 1,
    icon: '🎖️',
    title: { vi: '', en: '' },
    reward: { vi: '', en: '' }
  });
</script>

<JsonFile name="rewards.json" original={rewards} check={(d) => checkRewards(d, siteCount)}>
  {#snippet children(list)}
    <p class="muted"><small>{s('org_rewards_hint', siteCount)}</small></p>

    {#each list as tier, i (tier.id)}
      <details class="ed-item">
        <summary>
          {tier.icon} <strong>{tier.title.vi || tier.id}</strong>
          <small class="muted">· {s('stamps_at', tier.stamps)}</small>
          <button class="mini danger" onclick={() => list.splice(i, 1)}>{s('org_del_tier')}</button>
        </summary>

        <!-- Tier ids persist in every visitor's localStorage as redeemed markers. -->
        <label class="ed-row"><span>id</span><input bind:value={tier.id} /></label>
        <div class="ed-grid">
          <label class="ed-row">
            <span>{s('f_stamps')}</span>
            <input type="number" min="1" max={siteCount} step="1" bind:value={tier.stamps} />
          </label>
          <label class="ed-row"><span>{s('f_icon')}</span><input bind:value={tier.icon} /></label>
        </div>
        <Bi field={tier.title} label={s('f_title')} />
        <Bi field={tier.reward} label={s('f_reward')} rows={2} />
      </details>
    {/each}

    <button class="btn secondary" onclick={() => list.push(blankTier(list))}>{s('org_add_tier')}</button>
  {/snippet}
</JsonFile>
