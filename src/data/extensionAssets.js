// Affiches des extensions (posters dessinés) — clé = id d'extension (cf. extensions/registry.js).
// Chargées via import.meta.glob (même mécanisme que les assets d'événements/plateau).
// Fallback emoji (ext.icon) conservé dans le composant si une clé n'a pas d'affiche.
const urls = import.meta.glob('../assets/extensions/*.jpg', { eager: true, query: '?url', import: 'default' });

export const EXTENSION_IMG = {};
for (const path in urls) {
  const key = path.split('/').pop().replace('.jpg', '');
  EXTENSION_IMG[key] = urls[path];
}

// Extensions « À VENIR » : affiches montrées dans la galerie en APERÇU, NON
// sélectionnables (pas dans le registre → aucun impact sur la logique de jeu).
// `id` = nom du fichier d'affiche (src/assets/extensions/<id>.jpg).
export const COMING_SOON = [
  { id: 'quetes', icon: '🗺️', name: 'Quêtes et aventures', name_en: 'Quests & adventures' },
  { id: 'runes', icon: '🔮', name: 'Maîtrise des runes', name_en: 'Rune mastery' },
  { id: 'rencontres', icon: '🤝', name: 'Rencontres', name_en: 'Encounters' },
];
