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
  { name: 'Le Cervin / Matterhorn (Alpes)', lat: 45.98, lon: 7.66, photo: 'cervin' },
  { name: 'Stonehenge (Angleterre)', lat: 51.18, lon: -1.83, photo: 'stonehenge' },
  { name: 'Le cap Horn (Chili)', lat: -55.98, lon: -67.27, photo: 'cap-horn' },
  { name: "L'allée des baobabs (Madagascar)", lat: -20.25, lon: 44.42, photo: 'baobabs' },
  { name: 'Le parc de Yellowstone (États-Unis)', lat: 44.60, lon: -110.50, photo: 'yellowstone' },
  { name: 'Le volcan Kīlauea (Hawaï)', lat: 19.41, lon: -155.28, photo: 'kilauea' },
  { name: 'La porte de Brandebourg (Berlin)', lat: 52.52, lon: 13.38, photo: 'porte-brandebourg' },
  { name: 'Venise (Italie)', lat: 45.43, lon: 12.34, photo: 'venise' },
  // --- Vague 2 : programme de geo college (metropoles, mondialisation,
  // deserts, littoraux, amenagement) + lieux celebres ---
  { name: 'Le carrefour de Shibuya (Tokyo)', lat: 35.66, lon: 139.70, photo: 'tokyo' },
  { name: 'Pudong, le quartier d\'affaires de Shanghai', lat: 31.24, lon: 121.50, photo: 'shanghai' },
  { name: 'Marina Bay (Singapour)', lat: 1.28, lon: 103.86, photo: 'singapour' },
  { name: 'Le port Victoria (Hong Kong)', lat: 22.29, lon: 114.17, photo: 'hong-kong' },
  { name: 'La Cité interdite (Pékin)', lat: 39.92, lon: 116.40, photo: 'cite-interdite' },
  { name: 'La porte de l\'Inde (Mumbai)', lat: 18.92, lon: 72.83, photo: 'mumbai' },
  { name: 'Hollywood (Los Angeles)', lat: 34.13, lon: -118.32, photo: 'hollywood' },
  // Canaux et detroits : la photo seule n'est pas parlante, le nom est affiche
  { name: 'Le canal de Suez (Égypte)', lat: 30.45, lon: 32.35, photo: 'canal-suez', showName: true },
  { name: 'Le canal de Panamá', lat: 9.08, lon: -79.68, photo: 'canal-panama', showName: true },
  { name: 'Le détroit de Gibraltar', lat: 35.95, lon: -5.60, photo: 'gibraltar', showName: true },
  { name: 'Le port de Rotterdam (Pays-Bas)', lat: 51.95, lon: 4.14, photo: 'rotterdam' },
  { name: 'Les tours Petronas (Kuala Lumpur)', lat: 3.16, lon: 101.71, photo: 'petronas' },
  { name: 'Les dunes du Sahara (erg Chebbi)', lat: 31.15, lon: -4.00, photo: 'sahara' },
  { name: 'Le désert d\'Atacama (Chili)', lat: -24.50, lon: -69.25, photo: 'atacama' },
  { name: 'Les icebergs d\'Ilulissat (Groenland)', lat: 69.22, lon: -51.10, photo: 'ilulissat' },
  { name: 'L\'Antarctique', lat: -77.50, lon: 0.00, photo: 'antarctique' },
  { name: 'La Grande Barrière de corail (Australie)', lat: -18.16, lon: 147.00, photo: 'barriere-corail' },
  { name: 'Les moulins de Kinderdijk (polders néerlandais)', lat: 51.88, lon: 4.64, photo: 'kinderdijk' },
  { name: 'Le barrage des Trois-Gorges (Chine)', lat: 30.82, lon: 111.00, photo: 'trois-gorges' },
  { name: 'Les rizières en terrasses de Banaue (Philippines)', lat: 16.92, lon: 121.06, photo: 'banaue' },
  { name: 'Le delta du Mékong (Viêt Nam)', lat: 9.80, lon: 106.30, photo: 'mekong' },
  { name: 'Le mont Blanc (Alpes)', lat: 45.83, lon: 6.86, photo: 'mont-blanc' },
  { name: 'Le château de Versailles', lat: 48.80, lon: 2.12, photo: 'versailles' },
  { name: 'La dune du Pilat (Gironde)', lat: 44.59, lon: -1.21, photo: 'dune-pilat' },
  { name: 'Le pont du Gard', lat: 43.95, lon: 4.54, photo: 'pont-gard' },
  { name: 'Les calanques de Marseille', lat: 43.21, lon: 5.45, photo: 'calanques' },
  { name: 'Les chutes d\'Iguaçu (Brésil/Argentine)', lat: -25.69, lon: -54.44, photo: 'iguacu' },
  { name: 'Le salar d\'Uyuni (Bolivie)', lat: -20.13, lon: -67.49, photo: 'uyuni' },
  { name: 'Torres del Paine (Patagonie)', lat: -50.94, lon: -73.00, photo: 'torres-paine' },
  { name: 'Le mont Rushmore (États-Unis)', lat: 43.88, lon: -103.46, photo: 'rushmore' },
  { name: 'Le lac Moraine (Rocheuses canadiennes)', lat: 51.32, lon: -116.19, photo: 'lac-moraine' },
  { name: 'La grande mosquée de Djenné (Mali)', lat: 13.91, lon: -4.55, photo: 'djenne' },
  { name: 'La Cappadoce (Turquie)', lat: 38.66, lon: 34.85, photo: 'cappadoce' },
  { name: 'Pompéi et le Vésuve (Italie)', lat: 40.75, lon: 14.49, photo: 'pompei' },
  { name: 'L\'Alhambra (Grenade)', lat: 37.18, lon: -3.59, photo: 'alhambra' },
  { name: 'Le château de Neuschwanstein (Bavière)', lat: 47.56, lon: 10.75, photo: 'neuschwanstein' },
  { name: 'Les falaises de Moher (Irlande)', lat: 52.97, lon: -9.43, photo: 'moher' },
  { name: 'Le Geirangerfjord (Norvège)', lat: 62.10, lon: 7.09, photo: 'geiranger' },
  { name: 'Les temples de Bagan (Birmanie)', lat: 21.17, lon: 94.86, photo: 'bagan' },
  { name: 'Le sanctuaire Fushimi Inari (Kyoto)', lat: 34.97, lon: 135.77, photo: 'fushimi-inari' },
  { name: 'Santorin (Grèce)', lat: 36.39, lon: 25.46, photo: 'santorin' },
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
