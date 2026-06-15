// Résolution des visuels d'équipement (src/assets/items/{key}.png) et des
// illustrations de sets (src/assets/sets/{setKey}.png), chargés par Vite via
// import.meta.glob. Les consommables n'ont pas d'image (emoji).
const base = (p) => p.split('/').pop().replace(/\.png$/, '');
const ITEM_ASSET_URLS = import.meta.glob('../assets/items/*.png', { eager: true, query: '?url', import: 'default' });
const SET_ASSET_URLS = import.meta.glob('../assets/sets/*.png', { eager: true, query: '?url', import: 'default' });

// Illustrations de sets indexées par clé de set (coiffe + armure + amulette) :
// pour setImg() + l'encart de détail d'objet.
const SET_ASSETS = Object.fromEntries(
  Object.entries(SET_ASSET_URLS).map(([p, url]) => [base(p), url])
);

// Map des images assignables à un objet. Les visuels de sets y sont AUSSI
// exposés sous une clé préfixée `set-…` : sélectionnables dans l'éditeur et
// résolus par itemImg/assetUrl, sans collision avec les clés d'objets.
const ITEM_ASSETS = {
  ...Object.fromEntries(Object.entries(SET_ASSETS).map(([k, url]) => ['set-' + k, url])),
  ...Object.fromEntries(Object.entries(ITEM_ASSET_URLS).map(([p, url]) => [base(p), url])),
};

// Clés des images embarquées (sets en tête pour visibilité dans le sélecteur).
export const ITEM_ASSET_KEYS = Object.keys(ITEM_ASSETS);

// URL de l'illustration d'un set à partir de sa clé (null si absente).
export function setImg(setKey) {
  return SET_ASSETS[setKey] || null;
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
