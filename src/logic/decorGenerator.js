// Props thématiques du plateau : chaque matière voit ses objets posés PRÈS de
// ses cases, SUR l'herbe de l'île (jamais sur le sable ni l'eau), sans
// chevaucher cases, chemins ni autres props.
// Appelé une fois à la création du plateau ; le résultat est PERSISTÉ avec la
// partie (state boardDecor) — pas besoin de seed, on stocke la sortie.
// Toute la géométrie (rayons de tuiles, île, courbes des chemins) vient de
// boardGeometry.js, la même source que le rendu BoardSVG.
import { tileRadius, bezierPoint, islandCircles, GRASS_RENDER_RATIO } from './boardGeometry.js';

const GRASS_MARGIN = 0.04; // marge de sécurité sous le ratio de rendu
const EDGE_CLEAR = 58;  // distance min aux chemins (pierres de gué)
const PROP_CLEAR = 92;  // distance min entre deux props
const PROP_W = 84;      // largeur de rendu par défaut
const DUP_RADIUS = 320; // pas deux fois le même prop à moins de cette distance
const TILE_GUARD = 2;   // garde au-delà du rayon visuel de la tuile

// --- Phase 3 : décor de bordure, ponts, bannières, fanions ---
const SAND_INNER = 0.78; // au-delà de la frange d'herbe rendue (0.75)
const SAND_OUTER = 0.90; // en deçà du bord d'île rogné par le filtre gooey
const SAND_EDGE_CLEAR = 34;  // les éléments de plage tolèrent d'être plus près des chemins
const SAND_PROP_CLEAR = 96;  // espacement entre éléments de bordure

// Végétation/rochers de plage, posés sur la couronne de SABLE (jamais sur l'herbe)
const BORDER_PROPS = [
  'palmier-a', 'palmier-b', 'palmier-c',
  'buisson-jaune', 'buisson-rose', 'buisson-rouge',
  'rocher-a', 'rocher-b', 'rocher-c', 'rocher-corde', 'rocher-grave-a', 'rocher-grave-rune',
];
const BUNTING = ['fanion-jaune', 'fanion-rouge'];

export const SUBJECT_PROPS = {
  francais: [
    'prop-francais-livres', 'prop-francais-livre-ouvert', 'prop-francais-plume', 'prop-francais-parchemin', 'prop-francais-pupitre', 'prop-francais-lettres',
    // fournee 2 (sheet7, 12 juin)
    'prop-francais-livres-b', 'prop-francais-livre-ouvert-b', 'prop-francais-encrier-plume', 'prop-francais-parchemin-b',
    'prop-francais-enveloppe', 'prop-francais-feuilles', 'prop-francais-ecritoire', 'prop-francais-marque-page',
    'prop-francais-rouleau', 'prop-francais-encre', 'prop-francais-plume-laurier',
  ],
  histoire: [
    'prop-histoire-colonne', 'prop-histoire-arche', 'prop-histoire-amphore', 'prop-histoire-casque', 'prop-histoire-ruines-stele',
    // fournee 2 (sheet11, 12 juin)
    'prop-histoire-colonne-b', 'prop-histoire-arche-b', 'prop-histoire-amphore-b', 'prop-histoire-casque-b',
    'prop-histoire-tablette', 'prop-histoire-buste', 'prop-histoire-laurier', 'prop-histoire-mosaique',
    'prop-histoire-rouleau', 'prop-histoire-temple', 'prop-histoire-medaille', 'prop-histoire-bouclier',
  ],
  geographie: [
    'prop-geographie-valise', 'prop-geographie-photo', 'prop-geographie-globe-petit', 'prop-geographie-panneau', 'prop-geographie-carte', 'prop-geographie-longuevue', 'prop-geographie-boussole', 'prop-geographie-globe', 'prop-geographie-rouleau', 'prop-geographie-monuments', 'prop-geographie-cactus',
    // fournee 2 (sheet12, 12 juin)
    'prop-geographie-boussole-b', 'prop-geographie-globe-c', 'prop-geographie-carte-rouleau', 'prop-geographie-telescope',
    'prop-geographie-panneau-b', 'prop-geographie-carte-b', 'prop-geographie-ile', 'prop-geographie-cactus-b',
    'prop-geographie-oasis-b', 'prop-geographie-jumelles', 'prop-geographie-valise-b', 'prop-geographie-dolmen',
  ],
  anglais: [
    'prop-anglais-bus',
    // fournee 2 (sheet8, 12 juin)
    'prop-anglais-valise', 'prop-anglais-dictionnaire', 'prop-anglais-bulle', 'prop-anglais-globe',
    'prop-anglais-photo', 'prop-anglais-bus-b', 'prop-anglais-panneau', 'prop-anglais-livre',
    'prop-anglais-the', 'prop-anglais-casque', 'prop-anglais-lettre', 'prop-anglais-cabine',
  ],
  svt: [
    'prop-svt-serre', 'prop-svt-microscope', 'prop-svt-cloche', 'prop-svt-ammonite', 'prop-svt-fioles', 'prop-svt-pots', 'prop-svt-crane',
    // fournee 2 (sheet10, 12 juin)
    'prop-svt-microscope-b', 'prop-svt-fioles-b', 'prop-svt-pots-b', 'prop-svt-fougere',
    'prop-svt-ammonite-b', 'prop-svt-crane-b', 'prop-svt-cloche-b', 'prop-svt-serre-b',
    'prop-svt-arrosoir', 'prop-svt-pelle', 'prop-svt-herbier', 'prop-svt-loupe',
  ],
  maths: [
    'prop-maths-tableau-compas', 'prop-maths-equerre', 'prop-maths-regle', 'prop-maths-solides', 'prop-maths-calculatrice', 'prop-maths-cubes',
    // fournee 2 (sheet9, 12 juin)
    'prop-maths-calculatrice-b', 'prop-maths-regles', 'prop-maths-equerre-b', 'prop-maths-compas',
    'prop-maths-tableau', 'prop-maths-solides-b', 'prop-maths-boulier', 'prop-maths-rapporteur',
    'prop-maths-cubes-b', 'prop-maths-metre', 'prop-maths-graphique', 'prop-maths-operations',
  ],
};

const SIZES = {
  'prop-anglais-bus': 92,
  'prop-svt-serre': 96,
  'prop-geographie-monuments': 98,
  'prop-histoire-arche': 92,
  'prop-histoire-ruines-stele': 96,
  // fournee 2 : les pieces architecturales un peu plus grandes
  'prop-anglais-cabine': 90,
  'prop-histoire-temple': 94,
  'prop-histoire-arche-b': 92,
  'prop-svt-serre-b': 96,
  'prop-geographie-ile': 96,
  'prop-geographie-telescope': 90,
  'prop-geographie-dolmen': 88,
  // Phase 3 : bordure / structures
  'palmier-a': 104, 'palmier-b': 104, 'palmier-c': 104,
  'buisson-jaune': 70, 'buisson-rose': 70, 'buisson-rouge': 70,
  'rocher-a': 64, 'rocher-b': 64, 'rocher-c': 64,
  'rocher-corde': 70, 'rocher-grave-a': 70, 'rocher-grave-rune': 70,
  'fanion-jaune': 56, 'fanion-rouge': 56,
  'banner-francais': 88, 'banner-maths': 88, 'banner-histoire': 88,
  'banner-geographie': 88, 'banner-svt': 88, 'banner-anglais': 88,
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function generateDecor(board) {
  const nodes = Object.values(board);

  // Cercles de l'île (test "suis-je sur l'herbe / le sable ?") et points de chemin
  const circles = islandCircles(board);
  const edgePoints = [];
  for (const node of nodes) {
    for (const toId of node.next) {
      const t2 = board[toId];
      if (!t2) continue;
      for (let i = 1; i < 8; i++) {
        edgePoints.push(bezierPoint(node.x, node.y, t2.x, t2.y, i / 8));
      }
    }
  }

  const grassRatio = GRASS_RENDER_RATIO - GRASS_MARGIN;
  const inIsland = (x, y, ratio) =>
    circles.some((c) => Math.hypot(c.x - x, c.y - y) < c.r * ratio);
  const onGrass = (x, y) => inIsland(x, y, grassRatio);
  // Couronne de sable : dans l'île mais hors de l'herbe rendue (et de sa frange)
  const onSand = (x, y) => inIsland(x, y, SAND_OUTER) && !inIsland(x, y, SAND_INNER);

  const placed = [];
  const farFromPaths = (x, y, clear) =>
    edgePoints.every((p) => Math.hypot(p.x - x, p.y - y) >= clear);
  const farFromTiles = (x, y, w) =>
    nodes.every((n) => Math.hypot(n.x - x, n.y - y) >= tileR(n) + w * 0.5 - 6);
  // Distance min au centre d'une case : rayon visuel de SA tuile + demi-prop,
  // pour qu'un prop ne soit jamais rogné par une tuile (socles compris)
  const tileR = (n) => tileRadius(n.type) + TILE_GUARD;
  const isValid = (x, y, w) =>
    onGrass(x, y) && farFromTiles(x, y, w) &&
    farFromPaths(x, y, EDGE_CLEAR) &&
    placed.every((d) => Math.hypot(d.x - x, d.y - y) >= PROP_CLEAR);

  // 1) Props de matière : ~1 case sur 2, posé en couronne autour de SA case
  const subjectNodes = nodes.filter((n) => n.type === 'subject' && SUBJECT_PROPS[n.subject]);
  for (const n of subjectNodes) {
    if (Math.random() < 0.5) continue;
    // Pas le même objet qu'un prop déjà posé dans le voisinage
    const nearby = new Set(
      placed.filter((d) => Math.hypot(d.x - n.x, d.y - n.y) < DUP_RADIUS).map((d) => d.img)
    );
    let pool = SUBJECT_PROPS[n.subject].filter((im) => !nearby.has(im));
    if (!pool.length) pool = SUBJECT_PROPS[n.subject];
    const img = pick(pool);
    const w = SIZES[img] || PROP_W;
    const ring = tileR(n) + w * 0.5 - 4;
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = ring + Math.random() * 26;
      const x = n.x + Math.cos(angle) * dist;
      const y = n.y + Math.sin(angle) * dist;
      if (isValid(x, y, w)) {
        placed.push({ img, x: Math.round(x), y: Math.round(y), w });
        break;
      }
    }
  }

  // 2) Bannières de matière : une par matière, plantée au-dessus d'une de ses cases
  const seenSubjects = new Set();
  for (const n of subjectNodes) {
    if (seenSubjects.has(n.subject)) continue;
    const img = `banner-${n.subject}`;
    if (!SIZES[img]) continue;
    const w = SIZES[img];
    // au-dessus de la case (dy négatif), légèrement décalée
    const ring = tileR(n) + w * 0.5 - 8;
    const angles = [-Math.PI / 2, -Math.PI / 2.6, -Math.PI / 1.55];
    for (const a of angles) {
      const x = n.x + Math.cos(a) * ring;
      const y = n.y + Math.sin(a) * ring;
      if (isValid(x, y, w)) {
        placed.push({ img, x: Math.round(x), y: Math.round(y), w });
        seenSubjects.add(n.subject);
        break;
      }
    }
  }

  // 3) Végétation et rochers de bordure : sur la couronne de SABLE
  const sandValid = (x, y, w) =>
    onSand(x, y) && farFromTiles(x, y, w) &&
    farFromPaths(x, y, SAND_EDGE_CLEAR) &&
    placed.every((d) => Math.hypot(d.x - x, d.y - y) >= SAND_PROP_CLEAR);
  const nodeCircles = nodes.map((n) => ({ x: n.x, y: n.y }));
  for (const c of nodeCircles) {
    if (Math.random() < 0.45) continue; // densité modérée
    const img = pick(BORDER_PROPS);
    const w = SIZES[img] || PROP_W;
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const ratio = SAND_INNER + Math.random() * (SAND_OUTER - SAND_INNER);
      const x = c.x + Math.cos(angle) * 170 * ratio;
      const y = c.y + Math.sin(angle) * 170 * ratio;
      if (sandValid(x, y, w)) {
        placed.push({ img, x: Math.round(x), y: Math.round(y), w });
        break;
      }
    }
  }

  // 4) Fanions : petits accents festifs parsemés sur l'herbe
  for (const n of subjectNodes) {
    if (Math.random() < 0.85) continue;
    const img = pick(BUNTING);
    const w = SIZES[img] || PROP_W;
    const ring = tileR(n) + w * 0.5;
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const x = n.x + Math.cos(angle) * (ring + Math.random() * 30);
      const y = n.y + Math.sin(angle) * (ring + Math.random() * 30);
      if (isValid(x, y, w)) {
        placed.push({ img, x: Math.round(x), y: Math.round(y), w });
        break;
      }
    }
  }

  // Ordre de peinture : de haut en bas
  placed.sort((a, b) => a.y - b.y);
  return placed;
}
