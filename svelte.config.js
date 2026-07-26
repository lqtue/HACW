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
    paths: { base }
  }
};
