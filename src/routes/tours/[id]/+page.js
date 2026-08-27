import tours from '$lib/data/tours.json';
import destinations from '$lib/data/sites.js';
import { error } from '@sveltejs/kit';

export const prerender = true;

export function entries() {
  return tours.map((t) => ({ id: t.id }));
}

export function load({ params }) {
  const tour = tours.find((t) => t.id === params.id);
  if (!tour) throw error(404, 'Không tìm thấy tuyến');
  const byId = (id) => destinations.find((d) => d.id === id);
  const stops = tour.stops.map(byId).filter(Boolean);
  // `extra` = sites the survey team recommends nearby but that are NOT part of the
  // 5-slot ticket set: they don't count toward completing the tour.
  const extra = (tour.extra ?? []).map(byId).filter(Boolean);
  return { tour, stops, extra };
}
