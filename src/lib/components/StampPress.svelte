<script>
  import MatCua from './MatCua.svelte';

  /**
   * The check-in payoff: a mắt cửa chop pressed onto the page. One orchestrated
   * moment — descend, land short, settle askew — with an ink-spread ring and a
   * displacement filter so the edge is uneven the way a hand-inked seal is.
   *
   * @type {{ color?: string, motif?: 'spiral' | 'am-duong', glyph?: string, size?: number }}
   */
  let { color = 'var(--brand)', motif = 'spiral', glyph = '', size = 116 } = $props();
</script>

<!-- One press is on screen at a time, so a fixed filter id is enough. -->
<svg class="defs" aria-hidden="true">
  <filter id="hacw-ink">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7" result="grain" />
    <feDisplacementMap in="SourceGraphic" in2="grain" scale="1.8" xChannelSelector="R" yChannelSelector="G" />
  </filter>
</svg>

<div class="press" style="--c: {color}; --s: {size}px">
  <span class="ink" aria-hidden="true"></span>
  <span class="chop">
    <MatCua {size} {motif} color="var(--c)" inner="#fbe0b8" ink="var(--c)" />
    {#if glyph}<span class="glyph">{glyph}</span>{/if}
  </span>
</div>

<style>
  .defs { position: absolute; width: 0; height: 0; }

  .press {
    position: relative;
    width: var(--s);
    height: var(--s);
    margin: 4px auto 10px;
    display: grid;
    place-items: center;
  }

  .chop {
    grid-area: 1 / 1;
    display: grid;
    place-items: center;
    filter: url(#hacw-ink) drop-shadow(0 6px 10px rgba(126, 31, 19, 0.28));
    animation: press 620ms cubic-bezier(0.2, 0.9, 0.2, 1) both;
  }
  .chop > :global(*) { grid-area: 1 / 1; }
  .glyph {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: calc(var(--s) * 0.24);
    color: var(--brand-dark);
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.55);
  }

  /* ink pushed out from under the seal on contact */
  .ink {
    grid-area: 1 / 1;
    width: var(--s);
    height: var(--s);
    border-radius: 50%;
    background: radial-gradient(circle, color-mix(in srgb, var(--c) 35%, transparent) 40%, transparent 70%);
    animation: spread 700ms ease-out 300ms both;
  }

  @keyframes press {
    0% { transform: translateY(-46px) scale(1.85) rotate(-17deg); opacity: 0; }
    40% { opacity: 1; }
    52% { transform: translateY(0) scale(0.93) rotate(-3deg); }
    68% { transform: translateY(0) scale(1.05) rotate(-7deg); }
    100% { transform: translateY(0) scale(1) rotate(-5deg); opacity: 1; }
  }
  @keyframes spread {
    0% { transform: scale(0.55); opacity: 0.75; }
    100% { transform: scale(1.7); opacity: 0; }
  }

  /* the seal still lands, it just does not fly in */
  @media (prefers-reduced-motion: reduce) {
    .chop { animation: none; transform: rotate(-5deg); }
    .ink { animation: none; opacity: 0; }
  }
</style>
