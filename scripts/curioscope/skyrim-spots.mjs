// Lieux iconiques de Skyrim / Bordeciel (univers `skyrim`).
// label + coordonnées normalisées 0..1 (x = cx = est, y = cy = sud) MESURÉES sur
// la carte parchemin PROPRE du jeu (in-game map « Province of Skyrim », 2560×1920,
// sans grille ni filigrane) puis VÉRIFIÉES par overlay (.tmp-skyrim/overlay.png).
// make-tiles n'a PAS recadré l'image (sans --ref) → ces fractions tombent
// DIRECTEMENT dans l'espace 0..1 de la carte tuilée. Source unique pour
// seed-skyrim.mjs (table quete_spots). Noms FR standards de Skyrim.
export const SKYRIM_SPOTS = [
  // --- Les 9 capitales de Hold (icônes labellisées, mesurées directement) ---
  { label: 'Blancherive', x: 0.500, y: 0.470 },        // Whiterun — centre (icône cheval)
  { label: 'Solitude', x: 0.300, y: 0.180 },           // Solitude — presqu'île NO
  { label: 'Vendeaume', x: 0.785, y: 0.385 },          // Windhelm — NE (grosse icône)
  { label: 'Faillaise', x: 0.830, y: 0.760 },          // Riften — SE (grosse icône)
  { label: 'Markarth', x: 0.088, y: 0.485 },           // Markarth — extrême O (crâne de bélier)
  { label: 'Falkreath', x: 0.450, y: 0.645 },          // Falkreath — S (icône bouclier)
  { label: 'Aubétoile', x: 0.545, y: 0.215 },          // Dawnstar — côte N (bouclier)
  { label: 'Morthal', x: 0.398, y: 0.270 },            // Morthal — marais NO
  { label: 'Fortdhiver', x: 0.710, y: 0.215 },         // Winterhold — côte NE

  // --- Villages / lieux nommés ---
  { label: 'Rivebois', x: 0.505, y: 0.630 },           // Riverwood — centre-sud
  { label: 'Helgen', x: 0.520, y: 0.700 },             // Helgen — sud (sous Rivebois)
  { label: 'Ivarstead', x: 0.650, y: 0.680 },          // Ivarstead — pied de la Gorge
  { label: 'Pont-du-Dragon', x: 0.205, y: 0.265 },     // Dragon Bridge — NO
  { label: 'Karthwasten', x: 0.135, y: 0.385 },        // Karthwasten — mines O
  { label: 'Fort Dragon', x: 0.505, y: 0.455 },        // Dragonsreach — à Blancherive
  { label: 'Le Collège de Fortdhiver', x: 0.715, y: 0.165 }, // College of Winterhold, au N

  // --- Reliefs / donjons emblématiques ---
  { label: 'La Gorge du Monde', x: 0.575, y: 0.550 },  // Throat of the World — plus haute montagne
  { label: 'Hautgard', x: 0.580, y: 0.575 },           // High Hrothgar — sous le sommet
  { label: 'Le Tumulus de Bleak Falls', x: 0.470, y: 0.605 }, // Bleak Falls Barrow — au-dessus de Rivebois
  { label: 'Labyrinthides', x: 0.440, y: 0.380 },      // Labyrinthian — centre-nord (mont. Hjaalmarch)
  { label: 'Le Sanctuaire d\'Azura', x: 0.715, y: 0.290 }, // Shrine of Azura — montagnes SE de Fortdhiver

  // --- Autres lieux connus, bien répartis ---
  { label: 'Le Temple du Ciel', x: 0.150, y: 0.525 },  // Sky Haven Temple — Crevasse ouest (S de Markarth)
  { label: 'Le mont Anthor', x: 0.620, y: 0.290 },     // Mount Anthor — montagnes du Pale
  { label: 'Vertepré', x: 0.790, y: 0.440 },           // Kynesgrove — juste sous Vendeaume
  { label: 'Le Bastion de Faillepeau', x: 0.655, y: 0.695 }, // Shroud Hearth Barrow — à Ivarstead
  { label: 'Fort Neugrad', x: 0.550, y: 0.730 },       // Fort Neugrad — sud, SE de Helgen
  { label: 'La Grotte de Pinepeak', x: 0.630, y: 0.655 }, // Pinepeak Cavern — est de la Gorge
  { label: 'Vieux-Hroldan', x: 0.200, y: 0.510 },      // Old Hroldan — vallée de la Karth (O)
  { label: 'La Tour de Valtheim', x: 0.610, y: 0.475 }, // Valtheim Towers — entre Blancherive et Vendeaume
  { label: 'La Pierre du Seigneur', x: 0.400, y: 0.620 }, // The Lady Stone — île du lac Ilinalta (NO de Falkreath)
  { label: 'La Baie des Épées', x: 0.140, y: 0.130 },  // Northwatch Keep — côte NO, O de Solitude
];
