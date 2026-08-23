// DEV-ONLY preview aid: desktop has no GPS or compass, so the location dot + our
// heading cone never appear. This patches navigator.geolocation to emit a fix (Chùa
// Cầu by default) and dispatches fake compass events, so clicking locate shows the
// real dot, accuracy circle and rotating heading cone. Loaded only behind
// import.meta.env.DEV (see +layout.svelte) -> stripped from prod.
//
// It's also a small walk sim: `?fakepos=lat,lng` sets the start, and
// `window.__setFakePos(lat, lng)` moves the fix live (drive it from the console or an
// e2e). The position is pinned between updates, so on a real phone leave it default
// and the magnetometer still drives the cone.
// ponytail: fixed 2 s heartbeat, no speed/accuracy modelling — enough to exercise the
// UI; if you need realistic tracks, feed a GPX through __setFakePos on a timer.
const FIX = { latitude: 15.8770873, longitude: 108.3260704, accuracy: 30 };

export function installFakeGeo() {
  const params = new URLSearchParams(location.search);
  // Fake the COMPASS with ?fakeheading=<deg> (desktop preview — steady, no spin).
  // Default OFF, so on a real phone the device's own magnetometer drives the cone.
  const fakeHeading = params.get('fakeheading');

  let cur = { ...FIX };
  const fp = params.get('fakepos');
  if (fp) {
    const [la, ln] = fp.split(',').map(Number);
    if (Number.isFinite(la) && Number.isFinite(ln)) cur = { latitude: la, longitude: ln, accuracy: 30 };
  }

  const watchers = new Set();
  const pos = () => ({
    coords: { latitude: cur.latitude, longitude: cur.longitude, accuracy: cur.accuracy, altitude: null, altitudeAccuracy: null, heading: null, speed: 0 },
    timestamp: Date.now()
  });

  function emitHeading() {
    if (fakeHeading == null) return;
    const deg = Number(fakeHeading) || 0;
    const DOE = window.DeviceOrientationEvent;
    if (typeof DOE !== 'function') return;
    try {
      window.dispatchEvent(new DOE('deviceorientationabsolute', { alpha: 360 - deg, absolute: true }));
    } catch {
      // constructor rejected the init dict — dot still shows, cone just stays hidden
    }
  }

  function fire() {
    for (const ok of watchers) {
      try { ok(pos()); } catch {}
    }
    emitHeading();
  }

  const geo = {
    getCurrentPosition: (ok) => ok(pos()),
    watchPosition: (ok) => {
      watchers.add(ok);
      ok(pos());
      emitHeading();
      return setInterval(fire, 2000);
    },
    clearWatch: (id) => clearInterval(id) // watchers set is tiny + dev-only; dead entries are harmless
  };

  // Live driver for preview / e2e: move the fake fix and push it to active watchers now.
  window.__setFakePos = (lat, lng) => {
    cur = { latitude: lat, longitude: lng, accuracy: 5 };
    fire();
  };

  try {
    Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
    console.info('[dev-geo] fake GPS installed — click 📍 locate; drive it with __setFakePos(lat,lng)');
  } catch {
    // navigator.geolocation non-configurable in this browser — use DevTools Sensors instead
  }
}
