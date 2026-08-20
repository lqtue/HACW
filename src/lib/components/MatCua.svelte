<script>
  /**
   * Mắt cửa — Hội An's carved "door-eye". Rebuilt for the dark UI as a clean
   * eight-petal rosette with a hollow centre: the app's one recurring mark, used
   * as pin, stamp, ticket slot and category dot. Category carried by `color`.
   *
   * Prop API kept compatible with every caller:
   * @type {{
   *   size?: number, color?: string, inner?: string, ink?: string,
   *   ghost?: boolean, petals?: number, motif?: string, spin?: boolean
   * }}
   * `inner` fills the centre hole (pass the surface colour to punch it, or
   * 'transparent' to let the background show). `ghost` = faint, unfilled state.
   */
  let {
    size = 96,
    color = 'var(--brand)',
    inner = 'var(--bg)',
    ghost = false,
    petals = 8
  } = $props();

  const R = 24;
  const ring = 13.5;
  const pr = 6.4;
  const pts = Array.from({ length: petals }, (_, i) => {
    const a = (i / petals) * Math.PI * 2 - Math.PI / 2;
    return { x: +(R + Math.cos(a) * ring).toFixed(2), y: +(R + Math.sin(a) * ring).toFixed(2) };
  });
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 48 48"
  fill="none"
  role="img"
  aria-label="mắt cửa"
  style="display:block;opacity:{ghost ? 0.4 : 1}"
>
  {#each pts as p, i (i)}
    <circle cx={p.x} cy={p.y} r={pr} fill={ghost ? 'none' : color} stroke={ghost ? color : 'none'} stroke-width={ghost ? 1.4 : 0} />
  {/each}
  <circle cx="24" cy="24" r="12.5" fill={ghost ? 'none' : color} stroke={ghost ? color : 'none'} stroke-width={ghost ? 1.4 : 0} />
  <circle cx="24" cy="24" r="7" fill={inner} />
  <circle cx="24" cy="24" r="3" fill={color} opacity={ghost ? 0.6 : 1} />
</svg>
