// Heading cone for the user-location dot: a translucent fan showing which way the
// device faces. Progressive enhancement, never a hard dependency —
//   heading source, best-first:
//     1. device compass (deviceorientation) where permitted — Android via
//        `deviceorientationabsolute` (alpha), iOS via `webkitCompassHeading` after a
//        DeviceOrientationEvent.requestPermission() tap (HTTPS). iOS installed-PWA
//        compass is unreliable, so:
//     2. GPS course (`coords.heading`) while walking — works iOS + Android, tab + PWA,
//        no extra permission. `null` when stationary.
//     3. neither -> the cone stays hidden; the plain dot is enough.
//
// MapLibre 6 has no built-in heading indicator (showUserHeading was Mapbox-only),
// so this draws its own Marker and rotates it. rotationAlignment 'map' keeps the fan
// pointing at a real-world bearing as the map rotates.

const css = () => getComputedStyle(document.documentElement);

/**
 * @param {typeof import('maplibre-gl')} maplibregl
 * @param {import('maplibre-gl').Map} map
 */
export function createHeadingCone(maplibregl, map) {
  const teal = css().getPropertyValue('--teal').trim() || '#2f7d76';
  // The apex sits at the ELEMENT CENTRE (80,80) — MapLibre rotates a marker around its
  // centre, so apex-at-centre makes the fan pivot on the GPS point (default anchor),
  // not swing around its own centroid. Fan opens upward = north at rotation 0.
  const el = document.createElement('div');
  el.style.pointerEvents = 'none';
  // Google-style beam: a narrow (~50°) cone, brightest at the apex/dot and fading
  // radially outward with soft edges. Apex at (80,80) = element centre = the GPS point.
  el.innerHTML =
    `<svg width="160" height="160" viewBox="0 0 160 160" aria-hidden="true">` +
    `<defs><radialGradient id="hc-g" gradientUnits="userSpaceOnUse" cx="80" cy="80" r="80">` +
    `<stop offset="0" stop-color="${teal}" stop-opacity="0.5"/>` +
    `<stop offset="0.6" stop-color="${teal}" stop-opacity="0.16"/>` +
    `<stop offset="1" stop-color="${teal}" stop-opacity="0"/></radialGradient></defs>` +
    `<path d="M80 80 L46 6 Q80 -14 114 6 Z" fill="url(#hc-g)"/></svg>`;

  const marker = new maplibregl.Marker({
    element: el,
    rotationAlignment: 'map',
    pitchAlignment: 'map'
  });

  let compass = null; // degrees clockwise from north, or null
  let gps = null;
  let placed = false;

  function apply() {
    const h = compass ?? gps;
    el.style.visibility = h == null ? 'hidden' : 'visible';
    if (h != null) marker.setRotation(h);
  }

  function onOrient(e) {
    let deg = null;
    if (typeof e.webkitCompassHeading === 'number') deg = e.webkitCompassHeading; // iOS: CW from north
    else if (e.absolute && typeof e.alpha === 'number') deg = 360 - e.alpha; // Android abs: CCW alpha
    if (deg != null && !Number.isNaN(deg)) {
      compass = (deg + 360) % 360;
      apply();
    }
  }

  function addListeners() {
    window.addEventListener('deviceorientationabsolute', onOrient, true);
    window.addEventListener('deviceorientation', onOrient, true);
  }

  return {
    // Call from the locate tap (a user gesture) — iOS needs that to grant the compass.
    enableCompass() {
      const DOE = window.DeviceOrientationEvent;
      if (!DOE) return;
      if (typeof DOE.requestPermission === 'function') {
        DOE.requestPermission().then((s) => s === 'granted' && addListeners()).catch(() => {});
      } else {
        addListeners();
      }
    },
    onFix(coords) {
      if (!coords) return;
      marker.setLngLat([coords.longitude, coords.latitude]);
      if (!placed) {
        marker.addTo(map);
        placed = true;
      }
      gps = typeof coords.heading === 'number' && !Number.isNaN(coords.heading) ? coords.heading : null;
      apply();
    },
    hide() {
      el.style.visibility = 'hidden';
    },
    destroy() {
      window.removeEventListener('deviceorientationabsolute', onOrient, true);
      window.removeEventListener('deviceorientation', onOrient, true);
      marker.remove();
    }
  };
}
