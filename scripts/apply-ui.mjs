// Apply an edited ui-text.json back into src/lib/strings.js.
//   node scripts/apply-ui.mjs "<edited ui-text.json>"
// Only writes values that CHANGED and match exactly one source literal in the
// right language block. Interpolated ({0},{1}) values are rebuilt into their
// original arrow function, reusing the original parameter names. Anything that
// doesn't match uniquely is reported and skipped — never guessed.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const SRC = join(dir, '../src/lib/strings.js');
const edited = JSON.parse(readFileSync(process.argv[2], 'utf8'));

// current source values (reuse the extractor's eval so templates render to {i})
const text = readFileSync(SRC, 'utf8');
const objStart = text.indexOf('{', text.indexOf('const UI ='));
const UI = eval('(' + text.slice(objStart, text.indexOf('\n};', objStart) + 2) + ')');
const render = (v) =>
  typeof v === 'function' ? v(...Array.from({ length: v.length }, (_, i) => `{${i}}`)) : v;

let src = text;
const applied = [];
const skipped = [];

// language block bounds so we only touch the intended lang's literal
const bounds = (lang) => {
  const a = src.indexOf(`${lang}: {`);
  const b = lang === 'vi' ? src.indexOf('\n  en: {') : src.indexOf('\n  }\n};');
  return [a, b < 0 ? src.length : b];
};

for (const key of Object.keys(edited)) {
  for (const lang of ['vi', 'en']) {
    const cur = render(UI[lang]?.[key]);
    const next = edited[key]?.[lang];
    if (next == null || next === cur) continue;
    const isFn = typeof UI[lang]?.[key] === 'function';
    const [lo, hi] = bounds(lang);
    const region = src.slice(lo, hi);

    if (isFn) {
      // reconstruct the arrow fn: {i} -> ${paramName_i}
      const m = region.match(new RegExp(`(\\b${key}\\s*:\\s*)\\(([^)]*)\\)(\\s*=>\\s*)\`([^\`]*)\``));
      if (!m) { skipped.push(`${key}.${lang} (fn source not found)`); continue; }
      const params = m[2].split(',').map((s) => s.trim());
      const body = next.replace(/\{(\d+)\}/g, (_, i) => '${' + params[+i] + '}');
      const repl = `${m[1]}(${m[2]})${m[3]}\`${body}\``;
      src = src.slice(0, lo) + region.replace(m[0], repl) + src.slice(hi);
      applied.push(`${key}.${lang}`);
      continue;
    }

    // plain string: anchor on the KEY (values repeat: 3 keys share "Đang mở"),
    // capture its quoted literal, verify it matches, replace the inner text.
    const re = new RegExp(`(\\b${key}\\s*:\\s*)(['"])((?:\\\\.|(?!\\2).)*)\\2`);
    const m = region.match(re);
    if (!m) { skipped.push(`${key}.${lang} (key not found)`); continue; }
    const q = m[2];
    const unesc = m[3].replace(/\\(.)/g, '$1');
    if (unesc !== cur) { skipped.push(`${key}.${lang} (value moved — src="${unesc}")`); continue; }
    const inner = next.split('\\').join('\\\\').split(q).join('\\' + q);
    src = src.slice(0, lo) + region.replace(m[0], `${m[1]}${q}${inner}${q}`) + src.slice(hi);
    applied.push(`${key}.${lang}`);
  }
}

writeFileSync(SRC, src);
console.log(`applied ${applied.length}: ${applied.join(', ')}`);
if (skipped.length) console.log(`\nSKIPPED ${skipped.length}:\n  ${skipped.join('\n  ')}`);
