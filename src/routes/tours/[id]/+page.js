import tours from '$lib/data/tours.json';
import destinations from '$lib/data/destinations.json';
import { error } from '@sveltejs/kit';

export const prerender = true;

export function entries() {
  return tours.map((t) => ({ id: t.id }));
}

export function load({ params }) {
  const tour = tours.find((t) => t.id === params.id);
  if (!tour) throw error(404, 'Không tìm thấy tuyến');
  const stops = tour.stops.map((id) => destinations.find((d) => d.id === id)).filter(Boolean);
  return { tour, stops };
}
