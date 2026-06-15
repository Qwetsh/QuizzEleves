// Résolution des visuels chargés par Vite via import.meta.glob :
//  - objets    : src/assets/items/{key}.png
//  - sets      : src/assets/sets/{setKey}.png      → COMPOSITE (3 pièces),
//                pour l'illustration de l'encart de set uniquement.
//  - pièces    : src/assets/sets/pieces/{setKey}-{coiffe|armure|amulette}.png
//                → pièces SÉPARÉES, assignables à un objet individuel.
// Les consommables n'ont pas d'image (emoji).
const base = (p) => p.split('/').pop().replace(/\.png$/, '');
const ITEM_ASSET_URLS = import.meta.glob('../assets/items/*.png', { eager: true, query: '?url', import: 'default' });
const SET_ASSET_URLS = import.meta.glob('../assets/sets/*.png', { eager: true, query: '?url', import: 'default' });
const SET_PIECE_URLS = import.meta.glob('../assets/sets/pieces/*.png', { eager: true, query: '?url', import: 'default' });

// Composites indexés par clé de set — pour setImg() / l'encart de détail.
const SET_ASSETS = Object.fromEntries(
  Object.entries(SET_ASSET_URLS).map(([p, url]) => [base(p), url])
);
// Pièces de set séparées, exposées sous clé `set-{setKey}-{pièce}`.
const SET_PIECE_ASSETS = Object.fromEntries(
  Object.entries(SET_PIECE_URLS).map(([p, url]) => ['set-' + base(p), url])
);

// Map des images assignables à un objet (résolution par itemImg/assetUrl).
// On inclut les pièces de set ET — pour compat — les composites (clé `set-X`),
// même si ces derniers ne sont PLUS proposés dans le sélecteur.
const ITEM_ASSETS = {
  ...Object.fromEntries(Object.entries(SET_ASSETS).map(([k, url]) => ['set-' + k, url])),
  ...SET_PIECE_ASSETS,
  ...Object.fromEntries(Object.entries(ITEM_ASSET_URLS).map(([p, url]) => [base(p), url])),
};

// Sélecteur de l'éditeur : pièces de set (en tête) puis objets — PAS les
// composites (un objet = une seule pièce).
export const ITEM_ASSET_KEYS = [
  ...Object.keys(SET_PIECE_ASSETS),
  ...Object.keys(ITEM_ASSET_URLS).map(base),
];

// URL du composite d'un set à partir de sa clé (null si absente).
export function setImg(setKey) {
  return SET_ASSETS[setKey] || null;
}

// Pièces SÉPARÉES d'un set (détourées proprement), dans l'ordre coiffe/armure/
// amulette (= head/body/feet), pour l'affichage « 3 pièces » de l'encart de set.
const SET_PIECE_ORDER = ['coiffe', 'armure', 'amulette'];
export function setPieceImgs(setKey) {
  return SET_PIECE_ORDER.map((piece) => ({ piece, url: SET_PIECE_ASSETS['set-' + setKey + '-' + piece] || null }));
}

// URL d'une image embarquée à partir de sa clé.
export function assetUrl(key) {
  return ITEM_ASSETS[key] || null;
}

// URL de l'image d'un objet : soit une URL/Data directe (upload Supabase
// Storage), soit la clé d'une image embarquée. null si pas de visuel.
export function itemImg(item) {
  const img = item?.img;
  if (!img) return null;
  if (/^(https?:|data:|blob:)/.test(img)) return img;
  return ITEM_ASSETS[img] || null;
}

// Liseré de rareté : box-shadow d'anneau coloré (+ glow pour le légendaire).
// base = ombres internes du slot à conserver sous l'anneau.
export function rarityRing(rarity, color, { width = 3, base = '' } = {}) {
  const ring = `0 0 0 ${width}px ${color}`;
  const glow = rarity === 'legendaire' ? `, 0 0 14px ${color}99` : '';
  return (base ? base + ', ' : '') + ring + glow;
}
