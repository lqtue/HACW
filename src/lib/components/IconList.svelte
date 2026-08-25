<script>
  // The onboarding "points" list: one row per item, a badge at the left, a line of
  // text at the right. Badge = the item's icon in a soft tile, or its 1-based number
  // in a brand disc when no icon is given (install steps). One shape for the welcome
  // features, the permission rows and the install steps, so they line up screen to
  // screen. Text arrives resolved (s()/t() at the call site) — this only lays it out.
  import Icon from '$lib/components/Icon.svelte';

  /** @type {{ items: { icon?: string, text: string }[] }} */
  let { items } = $props();
</script>

<ol class="ilist">
  {#each items as it, i (i)}
    <li>
      <span class="badge" class:num={!it.icon} aria-hidden="true">
        {#if it.icon}<Icon name={it.icon} size={22} />{:else}{i + 1}{/if}
      </span>
      <span class="text">{it.text}</span>
    </li>
  {/each}
</ol>

<style>
  .ilist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 16px; }
  .ilist li { display: flex; align-items: center; gap: 13px; }
  .badge {
    flex: none; display: grid; place-items: center;
    width: 34px; height: 34px; border-radius: 10px;
    background: color-mix(in srgb, var(--brand) 10%, transparent); color: var(--brand);
  }
  .badge.num {
    width: 28px; height: 28px; border-radius: 50%; margin-inline: 3px;
    background: var(--grad-brand, var(--brand)); color: #fff; font-weight: 800; font-size: 0.9rem;
  }
  .text { color: var(--ink); font-weight: 600; font-size: 0.98rem; line-height: 1.35; }
</style>
