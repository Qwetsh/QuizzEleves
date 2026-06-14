// Images d'événements (assets dessinés) — clé = clé d'événement (cf. events.js).
// Chargées via import.meta.glob (même mécanisme que les assets du plateau).
// Fallback emoji conservé dans les composants si une clé n'a pas d'image.
const urls = import.meta.glob('../assets/events/*.png', { eager: true, query: '?url', import: 'default' });

export const EVENT_IMG = {};
for (const path in urls) {
  const key = path.split('/').pop().replace('.png', '');
  EVENT_IMG[key] = urls[path];
}

// Liste des URLs disponibles (pour la roulette de révélation)
export const EVENT_IMG_LIST = Object.values(EVENT_IMG);
