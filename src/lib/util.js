import categories from './data/categories.json';

const byId = Object.fromEntries(categories.map((c) => [c.id, c]));

export function categoryLabel(id) {
  return byId[id]?.label ?? id;
}

export function categoryIcon(id) {
  return byId[id]?.icon ?? '📍';
}

// External Google Maps walking-navigation handoff.
export function mapsUrl(dest) {
  return `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=walking`;
}
