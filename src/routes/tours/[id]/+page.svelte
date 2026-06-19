<script>
  import Card from '$lib/components/Card.svelte';
  let { data } = $props();
</script>

<div class="topbar"><h1>{data.tour.title}</h1><small>{data.tour.theme}</small></div>

<div class="page">
  <p>{data.tour.description}</p>
  <h2>Lộ trình</h2>
  {#each data.stops as dest, i}
    <Card {dest} index={i + 1} />
  {/each}
</div>
