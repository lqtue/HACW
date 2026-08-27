// The one map popup, for every map: a site's name, one line about it, and at most one
// button whose label + job the screen decides (`action`: { label, onclick, secondary? }
// or null for a plain label). Used by SiteMap (explore / builder) and RouteMap (plan
// ready), so a pin reads the same wherever it is tapped. Styled by .map-pop* in app.css
// (MapLibre portals popups, so the CSS has to be global anyway).
// DOM nodes, not an HTML string — the button needs a live handler, and textContent
// escapes authored copy for free.
import { t } from './i18n.svelte.js';

const clamp = (str, n = 90) => (str.length > n ? str.slice(0, n - 1).trimEnd() + '…' : str);

/**
 * @param {any} mgl      the maplibre-gl namespace
 * @param {any} map      the map to attach to
 * @param {any} d        destination record
 * @param {{ label: string, onclick: () => void, secondary?: boolean } | null} [action]
 * @param {number} [offset]  px above the anchor (pin images sit higher than stop discs)
 */
export function sitePopup(mgl, map, d, action = null, offset = 24) {
  const node = document.createElement('div');
  node.className = 'map-pop';
  // both halves are optional: a ticket counter is a pin with one job, so its popup is
  // the Directions button and nothing else
  const label = t(d.name);
  const body = d.short ? t(d.short) : clamp(t(d.description) || '');
  if (label) {
    const name = document.createElement('strong');
    name.textContent = label;
    node.append(name);
  }
  if (body) {
    const line = document.createElement('p');
    line.textContent = body;
    node.append(line);
  }
  const popup = new mgl.Popup({ offset: [0, -offset], closeButton: false, maxWidth: '260px', className: 'map-pop-wrap' });
  if (action) {
    const btn = document.createElement('button');
    btn.className = 'map-pop-btn' + (action.secondary ? ' sec' : '');
    btn.textContent = action.label;
    btn.addEventListener('click', () => { action.onclick(); popup.remove(); });
    node.append(btn);
  }
  return popup.setLngLat([d.lng, d.lat]).setDOMContent(node).addTo(map);
}
