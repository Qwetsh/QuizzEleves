// Curioscope — registre des UNIVERS du mini-jeu « guessr » (photo → pin sur la
// carte → points à la distance). Un univers = une carte + une métrique + un
// barème + une banque de spots. Ajouter un univers = AJOUTER UNE ENTRÉE ici
// (cf. DESIGN_CURIOSCOPE.md), le moteur (Curioscope.jsx) est agnostique.
//
// Deux systèmes de coordonnées (`crs`) :
// - 'geo'  : la carte est une projection équirectangulaire du monde réel ;
//            les positions normalisées 0..1 se convertissent en lat/lon et la
//            distance est le haversine en km.
// - 'flat' : monde fictif — la carte est un plan ; distance euclidienne dans
//            l'espace de la carte, exprimée en « lieues » arbitraires
//            (`mapUnits` = hauteur de la carte en lieues).
//
// Spots : { id, label, x, y (0..1), kind: 'photo'|'label', photo?, image?,
// showName? } — `photo` = slug d'asset local (src/assets/places/<slug>.jpg),
// `image` = URL complète (Storage, univers futurs). Les coordonnées sont DÉJÀ
// dans l'espace de la carte de l'univers (conversion faite au seed, pas au
// runtime).

import worldMap from '../assets/world-equirect.jpg';
import {
  GEO_PLACES, GEO_CAPITALS, lonLatToXY, haversineKm,
} from '../components/Fight/minigames/placementData.jsx';

// Course au score : premier à 10 000 pts = victoire directe du duel
// (2 manches parfaites suffisent, les matchs restent courts).
export const CURIO_TARGET_SCORE = 10000;

// --- Assets distants (Supabase Storage, bucket quete-spots) ---------------
// La DB ne stocke que des chemins RELATIFS ; changer d'hébergeur = changer
// cette base (cf. DESIGN_CURIOSCOPE.md §1.5 bis, palier Cloudflare R2).
export const SPOTS_BASE_URL = (import.meta.env?.VITE_SPOTS_BASE_URL
  || 'https://tppecozmygtjmbcdqgfc.supabase.co/storage/v1/object/public/quete-spots').replace(/\/+$/, '');

export function spotImageUrl(path) {
  if (!path) return undefined;
  return /^https?:/.test(path) ? path : `${SPOTS_BASE_URL}/${path.replace(/^\/+/, '')}`;
}

// Photos locales des lieux du monde réel (Wikimedia Commons, crédits dans
// src/data/placePhotoCredits.json) ; les univers DB portent des URLs complètes
// (spot.image). Résolution ici (et pas dans un composant) : le moteur de duel
// côté STORE en a besoin pour les surfaces téléphone/en ligne.
const PHOTO_URLS = import.meta.glob('../assets/places/*.jpg', {
  eager: true, query: '?url', import: 'default',
});

export function spotPhoto(spot) {
  if (!spot) return undefined;
  if (spot.image) return spot.image;
  return spot.photo ? PHOTO_URLS[`../assets/places/${spot.photo}.jpg`] : undefined;
}

// --- Spots dynamiques (table quete_spots, chargés par spotsConfig.js) -----
// { universeId: [spot, ...] } — les univers fictifs n'ont AUCUN spot en dur :
// tant que la DB n'a rien livré, ils sont vides et le duel retombe sur le
// duel générique (garde-fou dans getMinigame).
const CURIO_SPOTS = {};

export function setCurioSpots(byUniverse) {
  for (const k of Object.keys(CURIO_SPOTS)) delete CURIO_SPOTS[k];
  Object.assign(CURIO_SPOTS, byUniverse || {});
}

export function universeHasSpots(id) {
  const u = getUniverse(id);
  return !!u && (u.spots() || []).length > 0;
}

export const UNIVERSES = {
  monde_reel: {
    id: 'monde_reel',
    crs: 'geo',
    map: { src: worldMap, aspect: 2 },
    // ≤100 km = 5000 pts, puis décroissance exponentielle (k en km).
    score: { max: 5000, freeDist: 100, k: 2000 },
    unit: 'km', // clés i18n fight.geo.km / fight.geo.pileDessus (<1)
    // Alternance historique du GeoDuel : manche impaire = photo d'un lieu,
    // manche paire = nom d'une capitale à placer.
    pickPlan: 'alternate',
    spots: () => [
      ...GEO_PLACES.map((p) => ({
        ...lonLatToXY(p.lon, p.lat),
        id: p.name, label: p.name, kind: 'photo',
        photo: p.photo, showName: p.showName,
      })),
      ...GEO_CAPITALS.map((p) => ({
        ...lonLatToXY(p.lon, p.lat),
        id: p.name, label: p.name, kind: 'label',
      })),
    ],
  },

  // --- World of Warcraft (spots en DB, cartes dans le bucket quete-spots) --
  // cx/cy des spots = position sur la carte du CONTINENT en jeu (uiMap),
  // enregistrée directement par l'addon CurioSnap. Cartes en PYRAMIDE DE
  // TUILES (rendu « satellite » zoomable) générée par make-tiles.mjs — le
  // cadre des tuiles = cadre uiMap (recadrage par points de référence --ref
  // pour un assemblage minimap wow.export). Après chaque run, reporter ici
  // w/h/maxNativeZoom affichés par le script. Pyramide actuelle = art de
  // carte Classic 1002 px (provisoire, flou au zoom) — l'export minimap HD
  // la remplace au même chemin. `mapUnits` = hauteur en « lieues » ;
  // score.k de départ ≈ largeur/8 → À CALIBRER en jouant ([TOI], P3).
  wow_kalimdor: {
    id: 'wow_kalimdor',
    crs: 'flat',
    map: { type: 'tiles', path: 'maps/wow_kalimdor', w: 16384, h: 10923, maxNativeZoom: 6 },
    mapUnits: 100,
    score: { max: 5000, freeDist: 1.5, k: 18 },
    unit: 'lieues',
    spots: () => CURIO_SPOTS.wow_kalimdor || [],
  },
  wow_royaumes_est: {
    id: 'wow_royaumes_est',
    crs: 'flat',
    map: { type: 'tiles', path: 'maps/wow_royaumes_est', w: 16384, h: 10918, maxNativeZoom: 6 },
    mapUnits: 100,
    score: { max: 5000, freeDist: 1.5, k: 18 },
    unit: 'lieues',
    spots: () => CURIO_SPOTS.wow_royaumes_est || [],
  },

  // --- Terre du Milieu (Le Seigneur des Anneaux) — carte parchemin navigable --
  // Art de carte ORIGINAL de Jean-Tinland (dépôt GitHub « middle-earth »,
  // GPL-3.0) — usage fan non commercial AVEC ATTRIBUTION (cf. attribution
  // ci-dessous, à créditer dans l'UI/crédits). Les spots sont des LIEUX NOMMÉS
  // (kind:'label', render:'label' en DB) : le duel affiche « Place : X » et
  // demande de pointer le lieu sur la carte (pas de photo, comme les capitales
  // du monde réel). Tuiles générées par make-tiles.mjs (image 22800×15600,
  // ratio 1.4615 = cadre POIs 1900×1300, calage direct des % → x,y).
  // score.k ≈ largeur/8 → À CALIBRER en jouant.
  terre_du_milieu: {
    id: 'terre_du_milieu',
    crs: 'flat',
    map: { type: 'tiles', path: 'maps/terre_du_milieu', w: 16384, h: 11210, maxNativeZoom: 6 },
    mapUnits: 100,
    score: { max: 5000, freeDist: 1.5, k: 18 },
    unit: 'lieues',
    attribution: 'Carte : Jean-Tinland (« middle-earth », GitHub, GPL-3.0)',
    spots: () => CURIO_SPOTS.terre_du_milieu || [],
  },

  // --- Terre du Milieu « ATLAS » — carte parchemin alternative (variante en
  // test, plus « belle » que la Jean-Tinland) — le thème LOTR pointe ici.
  // ⚠️ CARTE PLACEHOLDER USAGE PERSO : source Internet Archive
  // (« ThirdageMiddle-earth.jpg », auteur inconnu, licence NON claire) —
  // assumée par l'utilisateur pour son usage personnel, À REMPLACER par une
  // carte proprement licenciée AVANT toute publication. Teinte parchemin +
  // vignette appliquées en pleine résolution (scripts/curioscope/
  // tint-arda-atlas.mjs), tuiles dans le bucket (make-tiles.mjs). Spots PROPRES
  // à ce cadrage (seed-terre-du-milieu-atlas.mjs) — le cadre diffère de la
  // Jean-Tinland, les spots de terre_du_milieu ne collent PAS ici.
  // score.k ≈ largeur/8 → À CALIBRER en jouant.
  terre_du_milieu_atlas: {
    id: 'terre_du_milieu_atlas',
    crs: 'flat',
    map: { type: 'tiles', path: 'maps/terre_du_milieu_atlas', w: 8740, h: 8208, maxNativeZoom: 6 },
    mapUnits: 100,
    score: { max: 5000, freeDist: 1.5, k: 18 },
    unit: 'lieues',
    attribution: 'Carte placeholder (usage perso, à remplacer avant publication)',
    spots: () => CURIO_SPOTS.terre_du_milieu_atlas || [],
  },

  // --- Skyrim (Bordeciel) — carte parchemin navigable (The Elder Scrolls V) ---
  // ⚠️ CARTE PLACEHOLDER USAGE PERSO : art de carte de la province de Bordeciel
  // (source Elder Scrolls Fandom, IP Bethesda) — assumée par l'utilisateur pour
  // son usage personnel, À REMPLACER par une carte proprement licenciée AVANT
  // toute publication (comme les autres univers « fan » : la carte reste HORS
  // dépôt git, seules les tuiles vivent dans le bucket). Les spots sont des LIEUX
  // NOMMÉS (kind:'label', render:'label' en DB) : le duel affiche « Place : X »
  // et demande de pointer le lieu sur la carte (pas de photo). Tuiles générées
  // par make-tiles.mjs (carte parchemin propre 2560×1920, PAS de --ref : cadre = image
  // → calage direct des x,y normalisés). score.k ≈ largeur/8 → À CALIBRER en jouant.
  skyrim: {
    id: 'skyrim',
    crs: 'flat',
    map: { type: 'tiles', path: 'maps/skyrim', w: 2560, h: 1920, maxNativeZoom: 4 },
    mapUnits: 100,
    score: { max: 5000, freeDist: 1.5, k: 18 },
    unit: 'lieues',
    attribution: 'Carte : Bethesda (The Elder Scrolls V: Skyrim), via Elder Scrolls Fandom — placeholder usage perso, à remplacer avant publication',
    spots: () => CURIO_SPOTS.skyrim || [],
  },
};

export function getUniverse(id) {
  return UNIVERSES[id] || null;
}

// Distance entre deux points normalisés 0..1 dans l'unité de l'univers.
export function universeMetric(u, a, b) {
  if (u.crs === 'geo') return haversineKm(a, b);
  const units = u.mapUnits ?? 100; // hauteur de la carte en lieues
  const aspect = u.map?.aspect ?? 1;
  return Math.round(Math.hypot((a.x - b.x) * aspect, a.y - b.y) * units);
}

// Barème façon GeoGuessr : plein pot sous freeDist, puis exponentielle.
export function universeScore(u, d) {
  const { max, freeDist, k } = u.score;
  if (d <= freeDist) return max;
  return Math.round(max * Math.exp(-(d - freeDist) / k));
}

/**
 * Tirage d'un spot avec anti-répétition « moins récemment vu » :
 * - `seen` = { spotId: seq } persisté par sauvegarde (curioSeen du store) —
 *   un spot montré au TBI est connu de TOUTE la classe, on préfère donc
 *   toujours les jamais-vus (seq 0), puis les plus anciens ;
 * - `exclude` = ids déjà joués DANS CE DUEL (jamais deux fois par match) ;
 * - `roundNo` sert au plan 'alternate' (photo / nom à placer).
 */
export function pickSpot(u, seen = {}, roundNo = 1, exclude = new Set(), rand = Math.random) {
  let pool = u.spots();
  if (u.pickPlan === 'alternate') {
    const want = roundNo % 2 === 1 ? 'photo' : 'label';
    const sub = pool.filter((s) => s.kind === want);
    if (sub.length) pool = sub;
  }
  const fresh = pool.filter((s) => !exclude.has(s.id));
  if (fresh.length) pool = fresh;
  if (!pool.length) return null;
  let best = [];
  let bestSeq = Infinity;
  for (const s of pool) {
    const seq = seen[s.id] || 0;
    if (seq < bestSeq) { bestSeq = seq; best = [s]; }
    else if (seq === bestSeq) best.push(s);
  }
  return best[Math.floor(rand() * best.length)] || null;
}
