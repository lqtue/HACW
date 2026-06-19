import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// GitHub Pages serves at /<repo>; CI sets BASE_PATH=/HACW. Empty in dev.
const base = process.env.BASE_PATH ?? '';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    // Fully static (GitHub Pages). For the Cloudflare check-in counter, swap back to adapter-cloudflare.
    adapter: adapter({ fallback: '404.html' }),
    paths: { base }
  }
};
