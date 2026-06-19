<script>
  import { base } from '$app/paths';
  import destinations from '$lib/data/destinations.json';
  import { passport, hasStamp } from '$lib/passport.svelte.js';
  import { categoryLabel } from '$lib/util.js';

  const total = destinations.length;
  const count = $derived(passport.stamps.length);
</script>

<div class="topbar"><h1>Hộ chiếu của tôi</h1><small>{count}/{total} tem đã sưu tầm</small></div>

<div class="page">
  <div class="grid">
    {#each destinations as d}
      {@const got = hasStamp(d.id)}
      <a class="stamp" class:got href="{base}/destinations/{d.id}" style="--cat: var(--c-{d.category})">
        <div class="seal">
          {#if got}<span>{d.name.charAt(0)}</span>{:else}<span class="lock">?</span>{/if}
        </div>
        <small class="name">{d.name}</small>
        <small class="muted">{got ? categoryLabel(d.category) : 'Chưa check-in'}</small>
      </a>
    {/each}
  </div>

  {#if count === total}
    <div class="banner" style="margin-top: 16px; text-align: center">
      🎉 Hoàn thành! Bạn đã check-in tất cả điểm đến.
    </div>
  {/if}
</div>

<style>
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .stamp {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 16px 14px;
    text-align: center;
    display: grid;
    gap: 5px;
    justify-items: center;
    box-shadow: var(--shadow);
  }
  .stamp .name { font-weight: 600; }
  .stamp:not(.got) { box-shadow: none; }
  .stamp:not(.got) .name { color: var(--muted); }

  .seal {
    width: 76px; height: 76px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-family: var(--font-display);
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: 4px;
    border: 2px dashed var(--line);
    color: var(--muted);
  }
  /* collected = inked wax seal: double ring, tinted fill, slight stamp tilt */
  .stamp.got .seal {
    border: 2px solid var(--cat);
    box-shadow: inset 0 0 0 4px color-mix(in srgb, var(--cat) 14%, var(--surface));
    background: color-mix(in srgb, var(--cat) 9%, var(--surface));
    color: var(--cat);
    transform: rotate(-5deg);
  }
  .lock { font-family: var(--font-body); font-weight: 500; }
</style>
