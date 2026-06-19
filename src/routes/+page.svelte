<script>
  import event from '$lib/data/event.json';
  import { base } from '$app/paths';
  import { passport } from '$lib/passport.svelte.js';
  import destinations from '$lib/data/destinations.json';
</script>

<div class="topbar">
  <h1>{event.title}</h1>
  <small>{event.subtitle} · {event.dates}</small>
</div>

<div class="page">
  <p>{event.intro}</p>

  <div class="banner">
    📖 Bạn đã sưu tầm <strong>{passport.stamps.length}/{destinations.length}</strong> tem.
    <a href="{base}/passport" style="color: var(--brand); font-weight: 600">Xem hộ chiếu →</a>
  </div>

  <h2>Cách hoạt động</h2>
  <ol>
    {#each event.howItWorks as step}
      <li style="margin-bottom: 6px">{step}</li>
    {/each}
  </ol>
  <p class="muted"><small>{event.note}</small></p>

  <div style="display: flex; gap: 10px; margin-top: 20px">
    <a class="btn" href="{base}/destinations">🗺️ Khám phá bản đồ</a>
    <a class="btn secondary" href="{base}/tours">🚶 Xem tuyến đi bộ</a>
  </div>
</div>
