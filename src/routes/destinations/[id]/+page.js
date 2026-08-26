import destinations from '$lib/data/sites.js';
import { error } from '@sveltejs/kit';

export const prerender = true;

// Tell the prerenderer which [id] pages exist.
export function entries() {
  return destinations.map((d) => ({ id: d.id }));
}

export function load({ params }) {
  const dest = destinations.find((d) => d.id === params.id);
  if (!dest) throw error(404, 'Không tìm thấy điểm đến');
  return { dest };
}
