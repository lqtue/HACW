<script>
  /**
   * Mắt cửa — the carved wooden "door eyes" above old-town doorways: a scalloped
   * petal rim around a spiral or an âm-dương. Hội An's own ornament, and the
   * shape the stamp seals will eventually be pressed from, so the app borrows it
   * as its one recurring mark instead of a generic badge.
   *
   * @type {{
   *   size?: number, petals?: number, motif?: 'spiral' | 'am-duong',
   *   color?: string, inner?: string, ink?: string, ghost?: boolean, spin?: boolean
   * }}
   */
  let {
    size = 96,
    petals = 9,
    motif = 'spiral',
    color = 'var(--brand)',
    inner = 'var(--gold)',
    ink = 'var(--brand-dark)',
    ghost = false,
    spin = false
  } = $props();

  const R = 31; // petal ring radius
  const PR = 13; // petal radius

  const rim = $derived(
    Array.from({ length: petals }, (_, i) => {
      const a = (i / petals) * Math.PI * 2 - Math.PI / 2;
      return { cx: 50 + R * Math.cos(a), cy: 50 + R * Math.sin(a) };
    })
  );

  // Archimedean spiral, ~1.6 turns — the carvers' most common centre.
  const spiral = (() => {
    const pts = [];
    for (let t = 0; t <= Math.PI * 3.2; t += 0.15) {
      const r = 2.5 + 2.2 * t;
      pts.push(`${(50 + r * Math.cos(t)).toFixed(2)},${(50 + r * Math.sin(t)).toFixed(2)}`);
    }
    return `M${pts.join('L')}`;
  })();
</script>

<svg
  class="matcua"
  class:ghost
  class:spin
  width={size}
  height={size}
  viewBox="0 0 100 100"
  aria-hidden="true"
  style="--c: {color}; --i: {inner}; --k: {ink}"
>
  <g class="rim">
    {#each rim as p}
      <circle cx={p.cx} cy={p.cy} r={PR} />
    {/each}
    <circle cx="50" cy="50" r={R + 2} />
  </g>

  <circle class="face" cx="50" cy="50" r="24" />

  {#if motif === 'am-duong'}
    <!-- âm dương: the other half of the door-eye vocabulary -->
    <path class="yin" d="M50 30a10 10 0 0 1 0 20 10 10 0 0 0 0 20 20 20 0 0 1 0-40z" />
    <circle class="dot" cx="50" cy="40" r="2.6" />
    <circle class="dot light" cx="50" cy="60" r="2.6" />
    <circle class="ring" cx="50" cy="50" r="20" />
  {:else}
    <path class="swirl" d={spiral} />
    <circle class="ring" cx="50" cy="50" r="20" />
  {/if}
</svg>

<style>
  .matcua { display: block; overflow: visible; }
  .rim { fill: var(--c); }
  .face { fill: var(--i); }
  .swirl { fill: none; stroke: var(--k); stroke-width: 2.6; stroke-linecap: round; }
  .ring { fill: none; stroke: var(--k); stroke-width: 1.4; opacity: 0.55; }
  .yin { fill: var(--k); }
  .dot { fill: var(--i); }
  .dot.light { fill: var(--k); }

  /* not yet earned: the carving is there, the paint is not */
  .ghost .rim { fill: none; stroke: var(--c); stroke-width: 1.6; opacity: 0.45; }
  .ghost .face { fill: none; }
  .ghost .swirl, .ghost .yin, .ghost .ring { opacity: 0.3; }
  .ghost .dot { fill: none; }

  .spin { animation: turn 34s linear infinite; }
  @keyframes turn { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    .spin { animation: none; }
  }
</style>
