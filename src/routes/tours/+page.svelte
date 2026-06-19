<script>
  import { base } from '$app/paths';
  import tours from '$lib/data/tours.json';
</script>

<div class="topbar"><h1>Tuyến đi bộ</h1><small>Khám phá phố cổ theo chủ đề</small></div>

<div class="page">
  {#each tours as tour}
    <a class="card" href="{base}/tours/{tour.id}">
      <div class="thumb">🚶</div>
      <div class="body">
        <span class="tag" style="background: var(--teal)">{tour.theme}</span>
        <h3>{tour.title}</h3>
        <small>{tour.stops.length} điểm dừng</small>
      </div>
    </a>
  {/each}
</div>
