// Résolution des visuels d'équipement (src/assets/items/{key}.png), chargés
// par Vite via import.meta.glob. Les consommables n'ont pas d'image (emoji).
const ITEM_ASSET_URLS = import.meta.glob('../assets/items/*.png', { eager: true, query: '?url', import: 'default' });

const ITEM_ASSETS = Object.fromEntries(
  Object.entries(ITEM_ASSET_URLS).map(([p, url]) => [p.split('/').pop().replace(/\.png$/, ''), url])
);

// URL de l'image d'un objet (via son champ `img`), ou null si pas de visuel.
export function itemImg(item) {
  return item?.img ? ITEM_ASSETS[item.img] || null : null;
}

// Liseré de rareté : box-shadow d'anneau coloré (+ glow pour le légendaire).
// base = ombres internes du slot à conserver sous l'anneau.
export function rarityRing(rarity, color, { width = 3, base = '' } = {}) {
  const ring = `0 0 0 ${width}px ${color}`;
  const glow = rarity === 'legendaire' ? `, 0 0 14px ${color}99` : '';
  return (base ? base + ', ' : '') + ring + glow;
}
