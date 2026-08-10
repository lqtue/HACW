/**
 * Svelte action: paint a thumbprint-whorl texture into a display word and clip
 * it to the glyphs — "chạm" means *touch*, so the word that says it wears a
 * fingerprint. Generated on a canvas (no asset), oxblood ridges on darker ink.
 * Falls back to solid ink where background-clip:text is unsupported or motion
 * is reduced. `use:fingerprint` on any element with `.fp` in its class.
 */
export function fingerprint(node) {
  if (typeof document === 'undefined') return; // SSR: skip, hydration re-runs it
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas');
  c.width = c.height = 150;
  const x = c.getContext('2d');
  x.fillStyle = '#6f1a10';
  x.fillRect(0, 0, 150, 150);
  x.strokeStyle = '#b5401f';
  x.lineWidth = 2.3;
  x.lineCap = 'round';
  for (let r = 8; r < 86; r += 7) {
    x.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.12) {
      const wob = Math.sin(a * 3 + r * 0.4) * 3 + Math.cos(a * 2) * 2;
      const px = 75 + (r + wob) * Math.cos(a) * 1.02;
      const py = 70 + (r + wob) * Math.sin(a) * 0.86;
      a === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.stroke();
  }
  node.style.backgroundColor = '#7e1f13';
  node.style.backgroundImage = `url(${c.toDataURL()})`;
  node.classList.add('fp-on');
}
