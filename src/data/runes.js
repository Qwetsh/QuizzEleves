// Runes de l'extension « Magie » : les signes qu'on trace au doigt sur la table
// des sorts. Chaque rune porte un ou plusieurs GABARITS de tracé (`variants`,
// listes de points {x,y} dans un repère 0..100, y vers le bas) consommés par le
// recognizer $1 (src/logic/gestures.js) — qui normalise position/échelle/angle,
// donc seuls la FORME et le SENS du tracé comptent. Le premier variant sert
// aussi de glyphe d'affichage (polyline SVG) dans le codex.
//
// Un SORT = une séquence ORDONNÉE de clés de runes (voir data/spells.js).
// Catalogue volontairement court et bien séparé géométriquement : reconnaître
// rune par rune est beaucoup plus robuste qu'un tracé complexe unique.

// — Générateurs de gabarits (échantillonnage régulier) —
const line = (p0, p1, n = 16) => Array.from({ length: n }, (_, i) => ({
  x: p0.x + ((p1.x - p0.x) * i) / (n - 1),
  y: p0.y + ((p1.y - p0.y) * i) / (n - 1),
}));
// Polyligne passant par des sommets [x,y] (concatène les segments).
const poly = (...verts) => verts.slice(1).flatMap((v, i) =>
  line({ x: verts[i][0], y: verts[i][1] }, { x: v[0], y: v[1] }).slice(i ? 1 : 0));
// Arc de cercle (angles en degrés, 0° = à droite, sens horaire car y vers le bas).
const arc = (cx, cy, r, a0, a1, n = 48) => Array.from({ length: n }, (_, i) => {
  const a = ((a0 + ((a1 - a0) * i) / (n - 1)) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
});
const reverse = (pts) => [...pts].map((p) => ({ ...p })).reverse();

// Sinusoïde verticale (serpent) : une pleine période sur la hauteur.
const serpent = Array.from({ length: 48 }, (_, i) => {
  const t = i / 47;
  return { x: 50 + 24 * Math.sin(t * Math.PI * 2), y: 12 + 76 * t };
});
// Spirale rentrante (~2,5 tours), départ en haut.
const spirale = Array.from({ length: 72 }, (_, i) => {
  const t = i / 71;
  const a = (-90 + t * 2.5 * 360) * (Math.PI / 180);
  const r = 38 * (1 - 0.82 * t);
  return { x: 50 + r * Math.cos(a), y: 52 + r * Math.sin(a) };
});

export const RUNES = {
  cercle: {
    key: 'cercle', name: 'Cercle', name_en: 'Circle', icon: '⭕',
    variants: [arc(50, 50, 36, -90, 270), arc(50, 50, 36, -90, -450)],
  },
  triangle: {
    key: 'triangle', name: 'Triangle', name_en: 'Triangle', icon: '🔺',
    variants: [poly([50, 14], [86, 82], [14, 82], [50, 14]), reverse(poly([50, 14], [86, 82], [14, 82], [50, 14]))],
  },
  eclair: {
    key: 'eclair', name: 'Éclair', name_en: 'Bolt', icon: '⚡',
    variants: [poly([64, 8], [38, 46], [58, 52], [34, 92])],
  },
  fleche: {
    key: 'fleche', name: 'Flèche', name_en: 'Arrow', icon: '🏹',
    variants: [poly([12, 58], [76, 44], [60, 26], [90, 40], [64, 62])],
  },
  serpent: {
    key: 'serpent', name: 'Serpent', name_en: 'Serpent', icon: '🐍',
    variants: [serpent],
  },
  spirale: {
    key: 'spirale', name: 'Spirale', name_en: 'Spiral', icon: '🌀',
    variants: [spirale],
  },
  croix: {
    key: 'croix', name: 'Croix', name_en: 'Cross', icon: '❌',
    variants: [poly([24, 18], [76, 82], [76, 18], [24, 82])],
  },
  etoile: {
    key: 'etoile', name: 'Étoile', name_en: 'Star', icon: '⭐',
    variants: [poly([22, 88], [50, 10], [78, 88], [16, 38], [84, 38], [22, 88])],
  },
};

export const RUNE_KEYS = Object.keys(RUNES);
export const runeName = (key, lang = 'fr') =>
  (lang === 'en' ? RUNES[key]?.name_en : RUNES[key]?.name) || RUNES[key]?.name || key;
