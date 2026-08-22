import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Cloudflare Pages serves at the domain root. BASE_PATH stays supported only so a
// subpath preview still works; leave it empty for the real deploy.
const base = process.env.BASE_PATH ?? '';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    // Cloudflare Pages: this adapter emits a `_worker.js`, which makes Pages
    // ignore `functions/` — so /api/checkin and /api/passport are ordinary
    // +server.js routes reading D1 from platform.env.DB. Bind a D1 database
    // named DB in the project (Settings → Bindings), on Production *and* Preview.
    adapter: adapter(),
    paths: { base },
    // Everything the app needs is same-origin and self-hosted (fonts, the pmtiles
    // basemap, the /api routes), so the policy is 'self' with two exceptions:
    // inline style="" attributes (popup labels, maplibre) need style 'unsafe-inline',
    // and canvas pins / the maplibre worker need img+worker blob:/data:. Scripts get
    // hashes from SvelteKit (mode: 'hash') — required because pages are prerendered,
    // so there is no per-request nonce. No third-party host appears anywhere.
    csp: {
      mode: 'hash',
      directives: {
        'default-src': ['self'],
        // The one hand-written inline script is app.html's before-paint theme
        // bootstrap (no-FOUC); SvelteKit's mode:'hash' only hashes scripts it
        // injects, so this one needs an explicit hash.
        // ponytail: recompute if that <script> changes —
        //   node -e 'const f=require("fs"),c=require("crypto");const m=f.readFileSync("src/app.html","utf8").match(/<script>([\s\S]*?)<\/script>/);console.log("sha256-"+c.createHash("sha256").update(m[1]).digest("base64"))'
        'script-src': ['self', 'sha256-8s7nGt+v2XDjY4FUSwxPjMlAaIMq+9FEgu6A3rURRbQ='],
        'style-src': ['self', 'unsafe-inline'],
        'img-src': ['self', 'data:', 'blob:'],
        'font-src': ['self'],
        'connect-src': ['self'],
        'worker-src': ['self', 'blob:'],
        'frame-ancestors': ['none'],
        'base-uri': ['self'],
        'form-action': ['self'],
        'object-src': ['none']
      }
    }
  }
};
