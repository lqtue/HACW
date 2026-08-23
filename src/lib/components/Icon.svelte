<script>
  /**
   * Line-art icon set drawn at the mắt cửa's stroke weight — the app's own marks,
   * not platform emoji (which render differently per device and read as templated).
   * currentColor, so an icon inherits the ink of whatever it sits in.
   *
   * @type {{ name: string, size?: number, stroke?: number, fill?: boolean }}
   * `fill` only affects `spark` (the one solid glyph, matching the gold spotlight spark).
   */
  let { name, size = 18, stroke = 1.7 } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={stroke}
  stroke-linecap="round"
  stroke-linejoin="round"
  role="img"
  aria-hidden="true"
  style="display:inline-block;vertical-align:-0.16em;flex:none"
>
  {#if name === 'pin'}
    <path d="M12 21s6-5.4 6-10a6 6 0 1 0-12 0c0 4.6 6 10 6 10Z" />
    <circle cx="12" cy="11" r="2.2" />
  {:else if name === 'clock'}
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7.5V12l3 2" />
  {:else if name === 'ticket'}
    <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4Z" />
    <path d="M13 6v2M13 11v2M13 16v0" stroke-dasharray="0.1 3" />
  {:else if name === 'compass'}
    <circle cx="12" cy="12" r="8.5" />
    <path d="M15 9 10.5 10.5 9 15 13.5 13.5Z" fill="currentColor" stroke="none" />
  {:else if name === 'map'}
    <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" />
    <path d="M9 4v14M15 6v14" />
  {:else if name === 'spark'}
    <!-- four-petal spark, the gold spotlight mark (solid) -->
    <path d="M12 2.5c.9 5.4 3.2 7.7 8.5 8.6-5.3.9-7.6 3.2-8.5 8.5-.9-5.3-3.2-7.6-8.5-8.5 5.3-.9 7.6-3.2 8.5-8.6Z" fill="currentColor" stroke="none" />
  {:else if name === 'check'}
    <path d="M5 13l4 4 10-11" />
  {:else if name === 'camera'}
    <path d="M4 8.5h3l1.4-2h7l1.4 2H20a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="3.1" />
  {:else if name === 'bulb'}
    <path d="M12 3a6 6 0 0 0-3.8 10.6c.7.6 1.1 1.4 1.2 2.4h5.2c.1-1 .5-1.8 1.2-2.4A6 6 0 0 0 12 3Z" />
    <path d="M9.5 19h5M10.5 21.5h3" />
  {:else if name === 'arrow'}
    <path d="M4 12h14M13 6.5l5.5 5.5-5.5 5.5" />
  {:else if name === 'globe'}
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17" />
    <path d="M12 3.5c-3 3-3 14 0 17M12 3.5c3 3 3 14 0 17" />
  {/if}
</svg>
