<script>
  import rewards from '$lib/data/rewards.json';
  import destinations from '$lib/data/destinations.json';
  import tours from '$lib/data/tours.json';
  import { checkRewards } from '$lib/editor.js';
  import { maxPossiblePoints } from '$lib/score.js';
  import { s } from '$lib/strings.js';
  import JsonFile from './JsonFile.svelte';

  // Tiers gate on points. The ceiling is what a visitor reaches by stamping every
  // site and finishing every tour with no bonuses — above that a tier is a prize
  // nobody can be sure of winning.
  const maxPoints = maxPossiblePoints(destinations.length, tours.length);

  const blankTier = (list) => ({
    id: `tier-${list.length + 1}`,
    points: (list.at(-1)?.points ?? 0) + 10,
    icon: '🎖️',
    title: { vi: '', en: '' },
    reward: { vi: '', en: '' }
  });
</script>

<!-- Four tiers of five flat fields: this one is a table all the way down, no
     detail row needed. -->
<JsonFile name="rewards.json" original={rewards} check={(d) => checkRewards(d, maxPoints)}>
  {#snippet children(list)}
    <p class="muted"><small>{s('org_rewards_hint', maxPoints)}</small></p>

    <div class="ed-scroll">
      <table class="ed-table">
        <thead>
          <tr>
            <th>id</th>
            <th>{s('f_icon')}</th>
            <th class="num">{s('f_points')}</th>
            <th>{s('f_title')} vi</th>
            <th>{s('f_title')} en</th>
            <th>{s('f_reward')} vi</th>
            <th>{s('f_reward')} en</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each list as tier, i (tier.id)}
            <tr>
              <!-- Tier ids persist in every visitor's localStorage as redeemed markers. -->
              <td><input bind:value={tier.id} /></td>
              <td><input class="short" bind:value={tier.icon} /></td>
              <td><input class="short" type="number" min="1" max={maxPoints} step="10" bind:value={tier.points} /></td>
              <td><input bind:value={tier.title.vi} /></td>
              <td><input bind:value={tier.title.en} /></td>
              <td><input bind:value={tier.reward.vi} /></td>
              <td><input bind:value={tier.reward.en} /></td>
              <td><button class="mini danger" onclick={() => list.splice(i, 1)}>{s('org_del_tier')}</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <button class="btn secondary" onclick={() => list.push(blankTier(list))}>{s('org_add_tier')}</button>
  {/snippet}
</JsonFile>
