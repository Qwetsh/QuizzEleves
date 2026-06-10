// Donnees du moteur de placement commit-reveal : scenes SVT (silhouettes SVG)
// et lieux geographiques (lat/lon) pour le mini-GeoGuessr.
// Coordonnees de cibles normalisees 0..1 (x vers la droite, y vers le bas).

// ============================================================
// SVT — silhouettes a legender
// ============================================================

function HumanScene() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="100" height="100" fill="#f8f1de" />
      <g fill="#cdb289" stroke="#a98f63" strokeWidth="0.8">
        {/* tete */}
        <circle cx="50" cy="9" r="7.5" />
        {/* cou */}
        <rect x="47" y="15.5" width="6" height="4" />
        {/* torse */}
        <path d="M 36 20 Q 50 17 64 20 L 66 45 Q 62 50 60 58 L 40 58 Q 38 50 34 45 Z" />
        {/* bras */}
        <path d="M 36 21 Q 28 24 27 38 L 25 52 L 30 53 L 33 39 Q 35 30 37 26 Z" />
        <path d="M 64 21 Q 72 24 73 38 L 75 52 L 70 53 L 67 39 Q 65 30 63 26 Z" />
        {/* jambes */}
        <path d="M 40 58 L 38 78 L 41 95 L 47 95 L 47 76 L 49 60 Z" />
        <path d="M 60 58 L 62 78 L 59 95 L 53 95 L 53 76 L 51 60 Z" />
      </g>
    </svg>
  );
}

function FlowerScene() {
  const petals = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * 2 * Math.PI;
    return { cx: 50 + 9 * Math.cos(a), cy: 24 + 9 * Math.sin(a) };
  });
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="100" height="100" fill="#eef6fb" />
      {/* sol et sous-sol */}
      <rect y="70" width="100" height="30" fill="#9b7448" />
      <rect y="68" width="100" height="4" fill="#6f9e4a" />
      {/* racines */}
      <g stroke="#e8dcc2" strokeWidth="1.6" fill="none" strokeLinecap="round">
        <path d="M 50 72 L 50 84" />
        <path d="M 50 76 L 42 86" />
        <path d="M 50 76 L 58 86" />
        <path d="M 50 80 L 45 90" />
        <path d="M 50 80 L 55 90" />
      </g>
      {/* tige */}
      <rect x="48.6" y="34" width="2.8" height="36" fill="#4f8a3d" rx="1.4" />
      {/* feuilles */}
      <path d="M 49 56 Q 36 52 33 58 Q 38 64 49 59 Z" fill="#5fa44a" stroke="#3f7a30" strokeWidth="0.6" />
      <path d="M 51 47 Q 64 43 67 49 Q 62 55 51 50 Z" fill="#5fa44a" stroke="#3f7a30" strokeWidth="0.6" />
      {/* sepales */}
      <path d="M 50 36 L 44 33 L 50 32 L 56 33 Z" fill="#3f7a30" />
      {/* petales */}
      {petals.map((p, i) => (
        <circle key={i} cx={p.cx} cy={p.cy} r="6.5" fill="#f3a7c0" stroke="#d97ba0" strokeWidth="0.6" />
      ))}
      {/* etamines */}
      <g stroke="#caa42a" strokeWidth="0.8" fill="#e8c33c">
        <line x1="50" y1="24" x2="45" y2="18" /><circle cx="45" cy="18" r="1.4" />
        <line x1="50" y1="24" x2="55" y2="18" /><circle cx="55" cy="18" r="1.4" />
        <line x1="50" y1="24" x2="44" y2="26" /><circle cx="44" cy="26" r="1.4" />
        <line x1="50" y1="24" x2="56" y2="26" /><circle cx="56" cy="26" r="1.4" />
      </g>
      {/* pistil */}
      <circle cx="50" cy="24" r="3" fill="#c9472f" stroke="#9a3320" strokeWidth="0.6" />
    </svg>
  );
}

function LandscapeScene() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      {/* ciel */}
      <rect width="100" height="60" fill="#bfe0f2" />
      {/* soleil */}
      <circle cx="88" cy="10" r="6" fill="#f6d35e" />
      {/* nuage */}
      <g fill="#ffffff" opacity="0.95">
        <ellipse cx="24" cy="12" rx="9" ry="4.5" />
        <ellipse cx="31" cy="10" rx="6" ry="3.5" />
        <ellipse cx="18" cy="10" rx="5" ry="3" />
      </g>
      {/* pluie */}
      <g stroke="#7fb6d9" strokeWidth="0.7">
        <line x1="20" y1="17" x2="18.5" y2="22" />
        <line x1="25" y1="17" x2="23.5" y2="22" />
        <line x1="30" y1="17" x2="28.5" y2="22" />
      </g>
      {/* sol */}
      <rect y="55" width="100" height="23" fill="#8cb866" />
      {/* montagne */}
      <path d="M 48 55 L 70 14 L 94 55 Z" fill="#8a7a66" />
      <path d="M 64 25 L 70 14 L 76 25 L 72 24 L 70 27 L 67 24 Z" fill="#ffffff" />
      {/* riviere : source sur la montagne -> mer */}
      <path d="M 66 38 Q 58 48 48 52 Q 36 57 28 58 L 24 60 L 30 62 Q 42 60 52 56 Q 62 51 68 40 Z" fill="#5da8d8" />
      {/* mer */}
      <path d="M 0 58 Q 12 56 24 60 L 26 78 L 0 78 Z" fill="#3f87c2" />
      {/* foret */}
      <g>
        <path d="M 38 47 L 42 54 L 34 54 Z" fill="#2f6e35" />
        <path d="M 44 44 L 48 52 L 40 52 Z" fill="#3d7d42" />
        <path d="M 33 44 L 36 51 L 30 51 Z" fill="#3d7d42" />
        <rect x="37.2" y="54" width="1.6" height="3" fill="#6b4d2e" />
        <rect x="43.2" y="52" width="1.6" height="3.5" fill="#6b4d2e" />
      </g>
      {/* sous-sol */}
      <rect y="78" width="100" height="22" fill="#7a5a38" />
      <rect y="78" width="100" height="2" fill="#5f4429" />
      {/* nappe phreatique */}
      <path d="M 4 88 Q 12 86 20 88 T 36 88 T 52 88 T 68 88 T 84 88 T 98 88 L 98 93 Q 90 95 82 93 T 66 93 T 50 93 T 34 93 T 18 93 T 4 93 Z" fill="#4f9ed0" opacity="0.85" />
    </svg>
  );
}

export const ANATOMY_SCENES = [
  {
    id: 'humain',
    name: 'Corps humain',
    Scene: HumanScene,
    targets: [
      { id: 'cerveau', label: 'le cerveau', x: 0.50, y: 0.08 },
      { id: 'coeur', label: 'le cœur', x: 0.54, y: 0.30 },
      { id: 'poumon-droit', label: 'le poumon droit', x: 0.44, y: 0.29 },
      { id: 'foie', label: 'le foie', x: 0.45, y: 0.41 },
      { id: 'estomac', label: "l'estomac", x: 0.56, y: 0.40 },
      { id: 'pancreas', label: 'le pancréas', x: 0.52, y: 0.44 },
      { id: 'intestin-grele', label: "l'intestin grêle", x: 0.50, y: 0.52 },
      { id: 'vessie', label: 'la vessie', x: 0.50, y: 0.59 },
      { id: 'rein-droit', label: 'le rein droit', x: 0.42, y: 0.44 },
      { id: 'genou-gauche', label: 'le genou gauche', x: 0.56, y: 0.78 },
    ],
  },
  {
    id: 'fleur',
    name: 'Fleur',
    Scene: FlowerScene,
    targets: [
      { id: 'petale', label: 'un pétale', x: 0.59, y: 0.18 },
      { id: 'pistil', label: 'le pistil', x: 0.50, y: 0.24 },
      { id: 'etamine', label: 'une étamine', x: 0.45, y: 0.18 },
      { id: 'sepale', label: 'un sépale', x: 0.50, y: 0.335 },
      { id: 'tige', label: 'la tige', x: 0.50, y: 0.52 },
      { id: 'feuille', label: 'une feuille', x: 0.40, y: 0.575 },
      { id: 'racines', label: 'les racines', x: 0.50, y: 0.82 },
    ],
  },
  {
    id: 'paysage',
    name: 'Paysage',
    Scene: LandscapeScene,
    targets: [
      { id: 'nuage', label: 'le nuage (condensation)', x: 0.24, y: 0.12 },
      { id: 'precipitations', label: 'les précipitations', x: 0.24, y: 0.20 },
      { id: 'sommet', label: 'le sommet enneigé', x: 0.70, y: 0.17 },
      { id: 'source', label: 'la source de la rivière', x: 0.66, y: 0.39 },
      { id: 'embouchure', label: "l'embouchure de la rivière", x: 0.26, y: 0.60 },
      { id: 'mer', label: 'la mer', x: 0.10, y: 0.66 },
      { id: 'foret', label: 'la forêt', x: 0.40, y: 0.49 },
      { id: 'nappe', label: 'la nappe phréatique', x: 0.50, y: 0.90 },
    ],
  },
];

// ============================================================
// GEO — lieux celebres (lat/lon). Le champ photo est optionnel :
// quand les photos validees seront integrees, elles remplaceront
// l'affichage du nom (mode devinette par l'image).
// ============================================================

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
