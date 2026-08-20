import { browser } from '$app/environment';

// Manual weather, not a live fetch: offline is a hard requirement and the visitor
// standing in the street knows the sky better than any API. 'hot' | 'mild' | 'rain'.
// ponytail: three buckets are enough to re-rank a handful of routes; add a real
// forecast only if the app ever gains a network budget.
const KEY = 'hacw_weather_v1';
const stored = browser ? localStorage.getItem(KEY) : null;

export const weather = $state({ now: stored === 'hot' || stored === 'rain' ? stored : 'mild' });

export function setWeather(w) {
  weather.now = w;
  if (browser) localStorage.setItem(KEY, w);
}
