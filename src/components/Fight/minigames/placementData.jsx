// Donnees du moteur de placement commit-reveal (mini-GeoGuessr).
// Coordonnees normalisees 0..1 (x vers la droite, y vers le bas).

// Lieux celebres (lat/lon). Le champ photo correspond au fichier
// src/assets/places/<photo>.jpg (credits dans src/data/placePhotoCredits.json).
export const GEO_PLACES = [
  { name: 'La tour Eiffel (Paris)', lat: 48.86, lon: 2.29, photo: 'tour-eiffel' },
  { name: 'Le Mont-Saint-Michel', lat: 48.64, lon: -1.51, photo: 'mont-saint-michel' },
  { name: 'La statue de la Liberté (New York)', lat: 40.69, lon: -74.04, photo: 'statue-liberte' },
  { name: 'Le Machu Picchu (Pérou)', lat: -13.16, lon: -72.54, photo: 'machu-picchu' },
  { name: 'Les pyramides de Gizeh (Égypte)', lat: 29.98, lon: 31.13, photo: 'pyramides-gizeh' },
  { name: 'La Grande Muraille de Chine', lat: 40.36, lon: 115.99, photo: 'grande-muraille' },
  { name: 'Le Taj Mahal (Inde)', lat: 27.17, lon: 78.04, photo: 'taj-mahal' },
  { name: "L'opéra de Sydney (Australie)", lat: -33.86, lon: 151.21, photo: 'opera-sydney' },
  { name: 'Le mont Fuji (Japon)', lat: 35.36, lon: 138.73, photo: 'mont-fuji' },
  { name: 'Le Kilimandjaro (Tanzanie)', lat: -3.07, lon: 37.35, photo: 'kilimandjaro' },
  { name: 'Le Christ Rédempteur (Rio de Janeiro)', lat: -22.95, lon: -43.21, photo: 'christ-redempteur' },
  { name: 'Le Colisée (Rome)', lat: 41.89, lon: 12.49, photo: 'colisee' },
  { name: "L'Acropole (Athènes)", lat: 37.97, lon: 23.73, photo: 'acropole' },
  { name: 'Big Ben (Londres)', lat: 51.50, lon: -0.12, photo: 'big-ben' },
  { name: 'Le Kremlin (Moscou)', lat: 55.75, lon: 37.62, photo: 'kremlin' },
  { name: 'La Sagrada Família (Barcelone)', lat: 41.40, lon: 2.17, photo: 'sagrada-familia' },
  { name: 'Les chutes du Niagara', lat: 43.08, lon: -79.07, photo: 'chutes-niagara' },
  { name: 'Le Grand Canyon (États-Unis)', lat: 36.10, lon: -112.10, photo: 'grand-canyon' },
  { name: "L'Everest (Himalaya)", lat: 27.99, lon: 86.93, photo: 'everest' },
  { name: 'Pétra (Jordanie)', lat: 30.33, lon: 35.44, photo: 'petra' },
  { name: 'Angkor Vat (Cambodge)', lat: 13.41, lon: 103.87, photo: 'angkor-vat' },
  { name: "Les moaï de l'île de Pâques", lat: -27.13, lon: -109.35, photo: 'ile-paques' },
  { name: 'Chichén Itzá (Mexique)', lat: 20.68, lon: -88.57, photo: 'chichen-itza' },
  { name: 'Burj Khalifa (Dubaï)', lat: 25.20, lon: 55.27, photo: 'burj-khalifa' },
  { name: "La forêt amazonienne (Manaus)", lat: -3.10, lon: -60.00, photo: 'amazonie' },
  { name: 'Le Golden Gate (San Francisco)', lat: 37.82, lon: -122.48, photo: 'golden-gate' },
  { name: 'Sainte-Sophie (Istanbul)', lat: 41.01, lon: 28.98, photo: 'sainte-sophie' },
  { name: 'La montagne de la Table (Le Cap)', lat: -33.96, lon: 18.40, photo: 'montagne-table' },
  { name: 'Les chutes Victoria (Zambèze)', lat: -17.92, lon: 25.86, photo: 'chutes-victoria' },
  { name: 'Uluru (Australie)', lat: -25.34, lon: 131.04, photo: 'uluru' },
  { name: 'Les geysers de Geysir (Islande)', lat: 64.31, lon: -20.30, photo: 'geysir' },
  { name: 'Le lac Baïkal (Sibérie)', lat: 53.50, lon: 108.00, photo: 'lac-baikal' },
  { name: 'Le Cervin / Matterhorn (Alpes)', lat: 45.98, lon: 7.66, photo: 'cervin' },
  { name: 'Stonehenge (Angleterre)', lat: 51.18, lon: -1.83, photo: 'stonehenge' },
  { name: 'Le cap Horn (Chili)', lat: -55.98, lon: -67.27, photo: 'cap-horn' },
  { name: "L'allée des baobabs (Madagascar)", lat: -20.25, lon: 44.42, photo: 'baobabs' },
  { name: 'Le parc de Yellowstone (États-Unis)', lat: 44.60, lon: -110.50, photo: 'yellowstone' },
  { name: 'Le volcan Kīlauea (Hawaï)', lat: 19.41, lon: -155.28, photo: 'kilauea' },
  { name: 'La porte de Brandebourg (Berlin)', lat: 52.52, lon: 13.38, photo: 'porte-brandebourg' },
  { name: 'Venise (Italie)', lat: 45.43, lon: 12.34, photo: 'venise' },
];

// Conversions equirectangulaires : lat/lon <-> coordonnees normalisees 0..1
export function lonLatToXY(lon, lat) {
  return { x: (lon + 180) / 360, y: (90 - lat) / 180 };
}

export function xyToLonLat(x, y) {
  return { lon: x * 360 - 180, lat: 90 - y * 180 };
}

// Distance haversine en km entre deux points normalises de la carte
export function haversineKm(p1, p2) {
  const a1 = xyToLonLat(p1.x, p1.y);
  const a2 = xyToLonLat(p2.x, p2.y);
  const rad = Math.PI / 180;
  const dLat = (a2.lat - a1.lat) * rad;
  const dLon = (a2.lon - a1.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a1.lat * rad) * Math.cos(a2.lat * rad) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)));
}
