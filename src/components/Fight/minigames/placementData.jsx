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

// Capitales du monde (nom affiché SANS photo : « Place : <capitale> »).
// Le GeoDuel alterne une manche photo / une manche capitale.
export const GEO_CAPITALS = [
  { name: 'Paris (France)', lat: 48.85, lon: 2.35 },
  { name: 'Londres (Royaume-Uni)', lat: 51.51, lon: -0.13 },
  { name: 'Madrid (Espagne)', lat: 40.42, lon: -3.70 },
  { name: 'Rome (Italie)', lat: 41.90, lon: 12.50 },
  { name: 'Berlin (Allemagne)', lat: 52.52, lon: 13.40 },
  { name: 'Lisbonne (Portugal)', lat: 38.72, lon: -9.14 },
  { name: 'Bruxelles (Belgique)', lat: 50.85, lon: 4.35 },
  { name: 'Amsterdam (Pays-Bas)', lat: 52.37, lon: 4.90 },
  { name: 'Berne (Suisse)', lat: 46.95, lon: 7.45 },
  { name: 'Vienne (Autriche)', lat: 48.21, lon: 16.37 },
  { name: 'Athènes (Grèce)', lat: 37.98, lon: 23.73 },
  { name: 'Stockholm (Suède)', lat: 59.33, lon: 18.07 },
  { name: 'Oslo (Norvège)', lat: 59.91, lon: 10.75 },
  { name: 'Copenhague (Danemark)', lat: 55.68, lon: 12.57 },
  { name: 'Helsinki (Finlande)', lat: 60.17, lon: 24.94 },
  { name: 'Varsovie (Pologne)', lat: 52.23, lon: 21.01 },
  { name: 'Moscou (Russie)', lat: 55.75, lon: 37.62 },
  { name: 'Dublin (Irlande)', lat: 53.35, lon: -6.26 },
  { name: 'Reykjavik (Islande)', lat: 64.15, lon: -21.94 },
  { name: 'Budapest (Hongrie)', lat: 47.50, lon: 19.04 },
  { name: 'Prague (Tchéquie)', lat: 50.09, lon: 14.42 },
  { name: 'Kiev (Ukraine)', lat: 50.45, lon: 30.52 },
  { name: 'Bucarest (Roumanie)', lat: 44.43, lon: 26.10 },
  { name: 'Ankara (Turquie)', lat: 39.93, lon: 32.85 },
  { name: 'Le Caire (Égypte)', lat: 30.04, lon: 31.24 },
  { name: 'Rabat (Maroc)', lat: 34.02, lon: -6.83 },
  { name: 'Alger (Algérie)', lat: 36.75, lon: 3.06 },
  { name: 'Tunis (Tunisie)', lat: 36.81, lon: 10.18 },
  { name: 'Dakar (Sénégal)', lat: 14.69, lon: -17.45 },
  { name: 'Abuja (Nigéria)', lat: 9.08, lon: 7.40 },
  { name: 'Nairobi (Kenya)', lat: -1.29, lon: 36.82 },
  { name: 'Pretoria (Afrique du Sud)', lat: -25.75, lon: 28.19 },
  { name: 'Addis-Abeba (Éthiopie)', lat: 9.03, lon: 38.74 },
  { name: 'Pékin (Chine)', lat: 39.90, lon: 116.40 },
  { name: 'Tokyo (Japon)', lat: 35.68, lon: 139.69 },
  { name: 'New Delhi (Inde)', lat: 28.61, lon: 77.21 },
  { name: 'Séoul (Corée du Sud)', lat: 37.57, lon: 126.98 },
  { name: 'Bangkok (Thaïlande)', lat: 13.75, lon: 100.50 },
  { name: 'Jakarta (Indonésie)', lat: -6.21, lon: 106.85 },
  { name: 'Hanoï (Viêt Nam)', lat: 21.03, lon: 105.85 },
  { name: 'Téhéran (Iran)', lat: 35.69, lon: 51.39 },
  { name: 'Riyad (Arabie saoudite)', lat: 24.71, lon: 46.68 },
  { name: 'Washington (États-Unis)', lat: 38.90, lon: -77.04 },
  { name: 'Ottawa (Canada)', lat: 45.42, lon: -75.70 },
  { name: 'Mexico (Mexique)', lat: 19.43, lon: -99.13 },
  { name: 'Brasília (Brésil)', lat: -15.79, lon: -47.88 },
  { name: 'Buenos Aires (Argentine)', lat: -34.61, lon: -58.38 },
  { name: 'Lima (Pérou)', lat: -12.05, lon: -77.04 },
  { name: 'Santiago (Chili)', lat: -33.45, lon: -70.67 },
  { name: 'Bogota (Colombie)', lat: 4.71, lon: -74.07 },
  { name: 'La Havane (Cuba)', lat: 23.11, lon: -82.37 },
  { name: 'Canberra (Australie)', lat: -35.28, lon: 149.13 },
  { name: 'Wellington (Nouvelle-Zélande)', lat: -41.29, lon: 174.78 },
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
