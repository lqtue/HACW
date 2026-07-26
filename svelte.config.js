import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Cloudflare Pages serves at the domain root. BASE_PATH stays supported only so a
// subpath preview still works; leave it empty for the real deploy.
const base = process.env.BASE_PATH ?? '';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    // Cloudflare Pages: `functions/` is picked up automatically, so /api/checkin
    // and /api/passport are live. Bind the CHECKINS KV namespace in the project.
    adapter: adapter(),
    paths: { base }
  }
};
