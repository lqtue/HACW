// DEV-ONLY preview aid: desktop has no GPS or compass, so the location dot + our
// heading cone never appear. This patches navigator.geolocation to emit a fixed fix
// at Chùa Cầu and dispatches fake compass events with a slowly-spinning heading, so
// clicking locate shows the real dot, accuracy circle and the rotating heading cone.
// Loaded only behind import.meta.env.DEV (see +layout.svelte) -> stripped from prod.
// ponytail: hardcoded Hội An centre — good enough to eyeball the UI; not a sim.
const FIX = { latitude: 15.8770873, longitude: 108.3260704, accuracy: 30 };

export function installFakeGeo() {
  // Fake the COMPASS only with ?fakeheading=<deg> (desktop preview — steady, no spin).
  // Default OFF, so on a real phone the device's own magnetometer drives the cone
  // while the position stays pinned to Hội An. e.g. ?fakeheading=35
  const fakeHeading = new URLSearchParams(location.search).get('fakeheading');
  const pos = () => ({
    coords: { ...FIX, altitude: null, altitudeAccuracy: null, heading: null, speed: 0 },
    timestamp: Date.now()
  });

  // Dispatch a steady fake compass event so the cone points somewhere on desktop.
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

  const geo = {
    getCurrentPosition: (ok) => ok(pos()),
    watchPosition: (ok) => {
      ok(pos());
      emitHeading();
      return setInterval(() => {
        ok(pos());
        emitHeading();
      }, 2000);
    },
    clearWatch: (id) => clearInterval(id)
  };

  try {
    Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
    console.info('[dev-geo] fake GPS installed — click 📍 locate to see the dot + heading beam');
  } catch {
    // navigator.geolocation non-configurable in this browser — use DevTools Sensors instead
  }
}
