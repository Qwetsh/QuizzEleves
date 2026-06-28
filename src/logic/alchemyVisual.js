// Couleurs déterministes des objets d'alchimie (orbes, liquide mélangé, fioles) :
// une teinte stable dérivée de la clé. Source unique partagée par l'atelier mobile
// (MobileApp) et l'atelier TBI (AlchemyModal).
export function alcHslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h / 30) % 12; const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(255 * c).toString(16).padStart(2, '0'); };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function alcColor(key) {
  let h = 0; const s = key || '';
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return alcHslToHex(h % 360, 56 + (h >> 8) % 20, 54 + (h >> 16) % 12);
}

// Mélange (assombri) de plusieurs couleurs hex → couleur du liquide du chaudron.
export function alcMix(colors) {
  if (!colors.length) return '#3b3050';
  let r = 0, g = 0, b = 0;
  for (const c of colors) { r += parseInt(c.slice(1, 3), 16); g += parseInt(c.slice(3, 5), 16); b += parseInt(c.slice(5, 7), 16); }
  const f = (v) => Math.round((v / colors.length) * 0.82).toString(16).padStart(2, '0');
  return `#${f(r)}${f(g)}${f(b)}`;
}
