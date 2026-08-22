<script>
  import { s } from '$lib/strings.js';
  // Danh sách | Bản đồ segmented control, shared by the picker and the Explore tab.
  let { mode = $bindable('list') } = $props();
</script>

<div class="viewtabs" role="tablist" aria-label={s('view_mode')}>
  <button class="vtab" class:on={mode === 'list'} role="tab" aria-selected={mode === 'list'} onclick={() => (mode = 'list')}>
    {s('view_list')}
  </button>
  <button class="vtab" class:on={mode === 'map'} role="tab" aria-selected={mode === 'map'} onclick={() => (mode = 'map')}>
    {s('view_map')}
  </button>
</div>

<style>
  .viewtabs {
    display: flex; gap: 4px; padding: 4px;
    background: var(--surface); border: 1px solid var(--line); border-radius: 999px;
  }
  .vtab {
    flex: 1; padding: 9px 12px; border: 0; border-radius: 999px;
    background: none; color: var(--muted);
    font-family: var(--font-body); font-weight: 700; font-size: 0.9rem; cursor: pointer;
  }
  .vtab.on { background: var(--brand); color: #fff; }
  .vtab:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
</style>
