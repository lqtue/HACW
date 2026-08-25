// Generates iOS home-screen splash images + the <link> block for app.html.
// iOS ignores the manifest; it wants one apple-touch-startup-image per exact
// device pixel size or it white-flashes on launch. The splash is just the app's
// page ground (--paper), so a solid-colour PNG is enough — built here with
// node:zlib, no image dependency. Light + dark because the app has both themes
// and the splash paints before any JS can pick one.
// ponytail: portrait only; landscape launch may still flash. Add landscape rows if it matters.
// Re-run after changing --paper in app.css:  node scripts/gen-splash.mjs
import zlib from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

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
const solidPng = (w, h, [r, g, b]) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // 8-bit, colour type 2 (RGB)
  ihdr[9] = 2;
  const row = Buffer.alloc(1 + w * 3); // filter byte 0 + RGB pixels
  for (let x = 0; x < w; x++) {
    row[1 + x * 3] = r;
    row[2 + x * 3] = g;
    row[3 + x * 3] = b;
  }
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const THEMES = { light: hex('fbf1ea'), dark: hex('0c0b0a') }; // --paper, both themes (app.css)

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
    writeFileSync(`static/splash/${file}`, solidPng(pw, ph, rgb));
    links.push(
      `    <link rel="apple-touch-startup-image" href="%sveltekit.assets%/splash/${file}"` +
        ` media="(device-width: ${lw}px) and (device-height: ${lh}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait) and (prefers-color-scheme: ${theme})" />`
    );
  }
}
writeFileSync('static/splash/links.html', links.join('\n') + '\n');
console.log(`wrote ${devices.length * 2} splash PNGs + static/splash/links.html`);
