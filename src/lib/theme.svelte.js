import { browser } from '$app/environment';

// Light/dark toggle. The concrete theme is set on <html data-theme> by a tiny
// inline script in app.html *before paint* (no flash), resolving a stored choice
// or the system preference. This store just mirrors + flips that attribute.
const KEY = 'hacw_theme';

export const theme = $state({
  mode: browser && document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
});

export function toggleTheme() {
  theme.mode = theme.mode === 'dark' ? 'light' : 'dark';
  if (!browser) return;
  document.documentElement.dataset.theme = theme.mode;
  localStorage.setItem(KEY, theme.mode);
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = theme.mode === 'dark' ? '#0c0b0a' : '#fbf1ea';
}
