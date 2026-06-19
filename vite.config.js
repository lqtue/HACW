import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

// Match SvelteKit's base path so the PWA manifest/SW resolve under /<repo> on GitHub Pages.
const base = process.env.BASE_PATH ?? '';

export default defineConfig({
  plugins: [
    sveltekit(),
    SvelteKitPWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Hội An Creative Week',
        short_name: 'HACW',
        description: 'Khám phá, check-in và sưu tầm tem Hội An Creative Week',
        lang: 'vi',
        theme_color: '#b8472a',
        background_color: '#fdf6ec',
        display: 'standalone',
        start_url: base + '/',
        scope: base + '/',
        // ponytail: SVG icon works on Android/Chrome installs. Add 192/512 PNGs for full iOS install fidelity.
        icons: [{ src: base + '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
      },
      workbox: {
        // Precache all built assets incl. the content JSON -> destinations/quizzes work fully offline.
        globPatterns: ['**/*.{js,css,html,json,svg,png,webmanifest,woff2}']
      }
    })
  ]
});
