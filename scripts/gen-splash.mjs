// Generates iOS home-screen splash images + the <link> block for app.html.
// iOS ignores the manifest; it wants one apple-touch-startup-image per exact
// device pixel size or it white-flashes on launch. Each splash is the app's page
// ground (--paper) with the app icon centred — built here from static/icon-512.png
// and node:zlib, no image dependency. Light + dark because the app has both themes
// and the splash paints before any JS can pick one.
// ponytail: portrait only + icon pasted at native 512 (no resample). Add landscape / scaling if it matters.
// Re-run after changing --paper in app.css or the icon:  node scripts/gen-splash.mjs
import zlib from 'node:zlib';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
// Encode a raw 8-bit RGB buffer (w*h*3, no filter bytes) as a PNG.
const encodePng = (w, h, rgb) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // 8-bit, colour type 2 (RGB)
  ihdr[9] = 2;
  const stride = w * 3;
  const raw = Buffer.alloc(h * (stride + 1)); // filter byte 0 per scanline
  for (let y = 0; y < h; y++) rgb.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};
// Decode an 8-bit, colour-type-2 (RGB), non-interlaced PNG -> {w, h, rgb}.
const decodePng = (buf) => {
  let p = 8;
  let w, h, depth, ctype;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      depth = data[8];
      ctype = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8 || ctype !== 2) throw new Error(`decodePng: need 8-bit RGB, got depth=${depth} ctype=${ctype}`);
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 3;
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  const paeth = (a, b, c) => {
    const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < h; y++) {
    const f = inflated[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const rv = inflated[src + x];
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      let v;
      switch (f) {
        case 0: v = rv; break;
        case 1: v = rv + a; break;
        case 2: v = rv + b; break;
        case 3: v = rv + ((a + b) >> 1); break;
        case 4: v = rv + paeth(a, b, c); break;
        default: throw new Error(`decodePng: bad filter ${f}`);
      }
      out[y * stride + x] = v & 0xff;
    }
  }
  return { w, h, rgb: out };
};
// Solid ground filled with [r,g,b], icon blitted centred (opaque paste).
const compose = (pw, ph, [r, g, b], icon) => {
  const buf = Buffer.alloc(pw * ph * 3);
  for (let i = 0; i < buf.length; i += 3) {
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
  }
  const oX = Math.floor((pw - icon.w) / 2);
  const oY = Math.floor((ph - icon.h) / 2);
  for (let y = 0; y < icon.h; y++) {
    const dY = oY + y;
    if (dY < 0 || dY >= ph) continue;
    for (let x = 0; x < icon.w; x++) {
      const dX = oX + x;
      if (dX < 0 || dX >= pw) continue;
      const s = (y * icon.w + x) * 3;
      const d = (dY * pw + dX) * 3;
      buf[d] = icon.rgb[s];
      buf[d + 1] = icon.rgb[s + 1];
      buf[d + 2] = icon.rgb[s + 2];
    }
  }
  return buf;
};

const hex = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); // 6-digit, no '#'
if (hex('fbf1ea').join() !== '251,241,234') throw new Error('hex() broken');
const THEMES = { light: hex('fbf1ea'), dark: hex('0c0b0a') }; // --paper, both themes (app.css)
const icon = decodePng(readFileSync('static/icon-512.png'));

// [pxW, pxH, logicalW, logicalH, dpr] — portrait. Covers iPhone SE..16 Pro Max.
const devices = [
  [1320, 2868, 440, 956, 3], [1206, 2622, 402, 874, 3], [1290, 2796, 430, 932, 3],
  [1179, 2556, 393, 852, 3], [1284, 2778, 428, 926, 3], [1170, 2532, 390, 844, 3],
  [1125, 2436, 375, 812, 3], [1242, 2688, 414, 896, 3], [828, 1792, 414, 896, 2],
  [1242, 2208, 414, 736, 3], [750, 1334, 375, 667, 2], [1080, 2340, 360, 780, 3],
];

mkdirSync('static/splash', { recursive: true });
const links = [];
for (const [pw, ph, lw, lh, dpr] of devices) {
  for (const [theme, rgb] of Object.entries(THEMES)) {
    const file = `${lw}x${lh}@${dpr}-${theme}.png`;
    writeFileSync(`static/splash/${file}`, encodePng(pw, ph, compose(pw, ph, rgb, icon)));
    links.push(
      `    <link rel="apple-touch-startup-image" href="%sveltekit.assets%/splash/${file}"` +
        ` media="(device-width: ${lw}px) and (device-height: ${lh}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait) and (prefers-color-scheme: ${theme})" />`
    );
  }
}
writeFileSync('static/splash/links.html', links.join('\n') + '\n');
console.log(`wrote ${devices.length * 2} splash PNGs + static/splash/links.html`);
