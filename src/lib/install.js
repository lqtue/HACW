import { s } from './strings.js';

// The two "add to home screen" steps as pictures: a number and the screenshot of the
// button it means. No visible caption — the shot shows the exact button, in the
// browser's own language, which no translation of ours can match. The step text
// survives as the image's alt, which is all a screen reader has here.
// Shots are static/install/*.webp (~39 KB total, precached like every other asset).
// Which guide to show is a *browser* question, not a device one. Chromium fires
// beforeinstallprompt and carries the install item in its ⋮ menu; WebKit has neither
// and installs from the Share sheet. Sniffing the UA for "iphone" showed Safari users
// the Chrome guide, because desktop Safari — and iPadOS Safari since 13 — say
// "Macintosh". The missing API is the honest signal, and it is the same one that
// decides whether the one-tap install button below can work at all.
export const shareSheetInstall = () =>
  typeof window !== 'undefined' && !('onbeforeinstallprompt' in window);

/** @param {string} base @param {boolean} [share] pass it when the caller resolved it on mount */
export function installSteps(base, share = shareSheetInstall()) {
  const os = share ? 'ios' : 'android';
  return [1, 2].map((n) => ({
    alt: s(`install_${os}_${n}`),
    shot: `${base}/install/${os}-${n}.webp`
  }));
}
