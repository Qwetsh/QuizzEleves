// Univers « espace » (maps v2) — calibration du continent générique.
//
// ✏️ CALIBRATION : ouvre l'outil DEV `?calibrate` (MapCalibrator), ajuste les
// ancres sur l'image, « Exporter » copie le JSON → colle-le ici à la place du
// littéral CONTINENT (même forme exacte). Pour un futur continent : détoure-le
// via scripts/space-assets.mjs, dépose le PNG dans src/assets/space/, calibre,
// et ajoute l'objet exporté au registre.
//
// Coordonnées en pixels de l'asset DÉTOURÉ (src/assets/space/continent-generique.png,
// 1437×1075). Le mapComposer place les continents côte à côte et convertit ces
// ancres en coordonnées plateau (translation par continent + CONT_SCALE).
//
// Topologie du continent : ponton OUEST → case d'entrée → UNE route de cases
// qui suit la grande route pavée peinte → case de sortie → porte fortifiée EST.
// (1 continent = 1 voie : un seul tracé par asset — décision 2026-07-06.)
//
// La route expose ses ancres ; le composer occupe `casesParVoie` d'entre elles
// en sous-ensemble régulier — les ancres inutilisées restent du décor peint.

export const CONTINENT = {
  img: 'continent-generique',
  w: 1437,
  h: 1075,
  // Points de jonction avec l'espace (bout du ponton / seuil de la porte)
  in: { x: 12, y: 516 },
  out: { x: 1344, y: 461 },
  // Première / dernière case de la traversée (extrémités de la route)
  // Calibration utilisateur du 2026-07-06 (outil ?calibrate, v2)
  jin: { x: 165, y: 530 },
  jout: { x: 1258, y: 551 },
  // La grande route pavée, ouest → est
  route: [
    { x: 279, y: 557 }, { x: 394, y: 531 }, { x: 523, y: 479 }, { x: 661, y: 471 },
    { x: 765, y: 523 }, { x: 910, y: 518 }, { x: 1021, y: 570 }, { x: 1152, y: 589 },
  ],
};

// ---------------------------------------------------------------------------
// CONTINENTS THÉMATIQUES — un asset cont-{theme}.png par thème de voie
// (générés/détourés par scripts/space-continents.mjs, dims dans continentsGen.js).
//
// Calibration : par défaut, la calibration du continent générique est reportée
// PROPORTIONNELLEMENT (les lots partagent le même gabarit : ponton ouest, route
// centrale, porte est). Pour affiner un continent : outil ?calibrate → « Exporter »
// → coller l'objet dans CALIBRATIONS ci-dessous, clé = nom d'asset (cont-…).

import { CONTINENT_DIMS } from './continentsGen.js';
// Calibrations fines par asset (exports du MapCalibrator, fichier dédié) —
// prioritaires sur la projection proportionnelle du générique.
import { CALIBRATIONS } from './calibrations.js';
export { CALIBRATIONS };

function derivedFromGeneric(img, w, h) {
  const sx = w / CONTINENT.w, sy = h / CONTINENT.h;
  const pt = (p) => ({ x: Math.round(p.x * sx), y: Math.round(p.y * sy) });
  return {
    img, w, h,
    in: pt(CONTINENT.in), out: pt(CONTINENT.out),
    jin: pt(CONTINENT.jin), jout: pt(CONTINENT.jout),
    route: CONTINENT.route.map(pt),
    calibrated: false,
  };
}

// Thèmes sans asset dédié servis par le continent d'un thème voisin.
// Décisions utilisateur (2026-07-06) : football → sports collectifs ; les
// matières SCOLAIRES réutilisent l'île culture-G la plus proche ; les cassettes
// de DOMAINE entier (★ Sport, ★ Nature…) utilisent l'île d'un sous-thème
// emblématique (choix : la plus iconique du domaine / alignée sur son biome).
const THEME_ALIASES = {
  football: 'sports_collectifs',
  // Matières scolaires
  francais: 'litterature_auteurs',
  maths: 'maths_logique',
  histoire: 'moyen_age',
  geographie: 'geographie_physique',
  svt: 'corps_humain_sante',
  anglais: 'langues_expressions',
  allemand: 'langues_expressions',
  espagnol: 'langues_expressions',
  lv2: 'langues_expressions',
  // Domaines culture-G (clés modules `_g` + clés d'arbre nues, par sûreté)
  histoire_g: 'moyen_age',
  geographie_g: 'geographie_physique',
  sciences_g: 'astronomie_espace', // biome « Le Labo Cosmos »
  sciences: 'astronomie_espace',
  nature_g: 'animaux', // biome « La Forêt Foisonnante »
  nature: 'animaux',
  arts_g: 'peinture_sculpture', // biome « La Galerie »
  arts: 'peinture_sculpture',
  divertissement_g: 'cinema', // biome « Studio & Paillettes »
  divertissement: 'cinema',
  sport_g: 'athletisme_jo', // biome « Le Stade »
  sport: 'athletisme_jo',
  societe_g: 'politique_institutions', // biome « La Grand-Place »
  societe: 'politique_institutions',
};

// Registre thème → continent. Repli sur le générique dans le composer quand un
// thème n'a pas (encore) d'asset dédié.
export const CONTINENTS = Object.fromEntries(
  Object.entries(CONTINENT_DIMS).map(([theme, { w, h }]) => {
    const img = `cont-${theme}`;
    return [theme, CALIBRATIONS[img] || derivedFromGeneric(img, w, h)];
  })
);
for (const [alias, target] of Object.entries(THEME_ALIASES)) {
  if (CONTINENTS[target]) CONTINENTS[alias] = CONTINENTS[target];
}

// Assets des socles/îlots (clés du glob src/assets/space/*.png)
export const SOCLE_KEYS = ['socle-1', 'socle-2', 'socle-3'];
export const ILOT_KEYS = ['ilot-1', 'ilot-2', 'ilot-3', 'ilot-4', 'ilot-5'];

// Dimensions des assets détourés (pour le rendu : largeur → hauteur proportionnelle)
export const SPACE_ASSET_DIMS = {
  'continent-generique': { w: 1437, h: 1075 },
  'socle-1': { w: 267, h: 187 },
  'socle-2': { w: 268, h: 187 },
  'socle-3': { w: 268, h: 189 },
  'ilot-1': { w: 340, h: 390 },
  'ilot-2': { w: 336, h: 381 },
  'ilot-3': { w: 407, h: 434 },
  'ilot-4': { w: 355, h: 392 },
  'ilot-5': { w: 415, h: 446 },
  // Cases spéciales (plateformes gravées) + marqueur de piège
  'case-depart': { w: 312, h: 250 },
  'case-arrivee': { w: 309, h: 242 },
  'case-event': { w: 306, h: 245 },
  'piege': { w: 352, h: 297 },
};

// Asset dédié par type de case spéciale (mode espace) — remplace le socle
// générique + l'ancien monument/badge. La clé du type de nœud → nom d'asset.
export const SPECIAL_CASE_ASSET = {
  depart: 'case-depart',
  arrivee: 'case-arrivee',
  event: 'case-event',
};

// Largeur de rendu (unités viewBox) des socles posés sur un continent et des
// îlots flottants dans l'espace. Le pion (r=24) déborde légèrement du socle —
// assumé : à CONT_SCALE 0.66, un socle plus large écrasait les routes peintes.
export const SOCLE_W = 78;
export const ILOT_W = 150;

// Cases spéciales (départ/arrivée/événement) : plateformes rondes gravées, plus
// prominentes qu'un socle ordinaire. Largeur selon le contexte de la case
// (posée sur un continent = échelle socle ; flottant dans l'espace = plus grand).
export const CASE_W_CONTINENT = 96;
export const CASE_W_SPACE = 132;

// Le centre « logique » d'un socle/îlot (là où se pose le pion) n'est pas le
// centre de l'image : la face supérieure est dans la moitié haute (perspective
// 3/4, débris flottants sous les îlots). Décalage vertical du centre de la
// face par rapport au centre de l'image, en fraction de la hauteur.
export const SOCLE_TOP_DY = -0.06;
export const ILOT_TOP_DY = -0.22;
// Plateformes des cases spéciales : face gravée un peu au-dessus du centre image.
export const CASE_TOP_DY = -0.08;
// Marqueur de piège (asset piege.png) : largeur de rendu + ancrage.
export const PIEGE_W = 92;
