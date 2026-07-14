// Reconnaissance de tracés « $1 Unistroke Recognizer » (Wobbrock, Wilson & Li,
// UIST 2007) pour les runes de l'extension Magie — zéro dépendance, que de la
// géométrie. Pipeline : resample(64 points équidistants) → rotation à l'angle
// indicatif (centroïde → premier point) → mise à l'échelle sur un carré SIZE
// → translation du centroïde à l'origine ; puis, contre chaque gabarit
// pré-traité, distance moyenne point à point au meilleur angle (golden section
// search sur ±45°, précision 2°). Score = 1 − d / (0.5·√2·SIZE).
//
// ⚠️ L'angle indicatif rend la reco sensible au SENS du tracé : c'est voulu
// (les runes traçables dans les deux sens portent un variant inversé dans
// data/runes.js). ⚠️ Pièges $1 : jamais de division par zéro (longueur de
// tracé nulle, bounding box nulle) → on rejette en amont / on borne à EPS.
import { RUNES } from '../data/runes.js';
import { MAGIC } from './balanceConfig.js';

const N = 64;                        // points après ré-échantillonnage
const SIZE = 250;                    // côté du carré de référence
const HALF_DIAGONAL = 0.5 * Math.sqrt(2) * SIZE; // borne de distance → score 0
const ANGLE_RANGE = rad(45);         // recherche du meilleur angle sur ±45°
const ANGLE_PRECISION = rad(2);
const PHI = (Math.sqrt(5) - 1) / 2;  // nombre d'or (golden section search)
const MIN_POINTS = 8;                // en dessous : tap/accident, pas un tracé
const EPS = 1e-6;

function rad(deg) { return (deg * Math.PI) / 180; }
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

const pathLength = (pts) => pts.slice(1).reduce((s, p, i) => s + dist(pts[i], p), 0);

function centroid(pts) {
  let x = 0, y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  return { x: x / pts.length, y: y / pts.length };
}

// Boîte englobante d'un tracé brut (aussi utile aux vues pour cadrer le rendu).
export function strokeBounds(pts) {
  if (!Array.isArray(pts) || !pts.length) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// Ré-échantillonne en n points équidistants LE LONG du tracé (pas dans le
// temps) : gomme les différences de vitesse du doigt. null si longueur nulle.
function resample(points, n = N) {
  const total = pathLength(points);
  if (!(total > 0)) return null; // tous points identiques (ou NaN) → dégénéré
  const interval = total / (n - 1);
  const src = points.map((p) => ({ x: p.x, y: p.y })); // copie : on insère dedans
  const out = [{ ...src[0] }];
  let acc = 0;
  for (let i = 1; i < src.length && out.length < n; i++) {
    const d = dist(src[i - 1], src[i]);
    if (d > 0 && acc + d >= interval) {
      const t = (interval - acc) / d;
      const q = {
        x: src[i - 1].x + t * (src[i].x - src[i - 1].x),
        y: src[i - 1].y + t * (src[i].y - src[i - 1].y),
      };
      out.push(q);
      src.splice(i, 0, q); // q devient le départ du pas suivant
      acc = 0;
    } else {
      acc += d;
    }
  }
  while (out.length < n) out.push({ ...src[src.length - 1] }); // arrondi flottant
  return out;
}

// Angle indicatif : centroïde → premier point (c'est lui qui encode le sens).
const indicativeAngle = (pts) => {
  const c = centroid(pts);
  return Math.atan2(c.y - pts[0].y, c.x - pts[0].x);
};

// Rotation autour du centroïde.
function rotateBy(pts, angle) {
  const c = centroid(pts);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return pts.map((p) => ({
    x: (p.x - c.x) * cos - (p.y - c.y) * sin + c.x,
    y: (p.x - c.x) * sin + (p.y - c.y) * cos + c.y,
  }));
}

// Étirement (non uniforme, comme le $1 original) sur le carré de référence.
// Bbox quasi nulle sur un axe (trait parfaitement droit) : borne à EPS — le
// bruit explose, le score s'effondre, mais pas de division par zéro ni de NaN.
function scaleTo(pts, size = SIZE) {
  const b = strokeBounds(pts);
  const w = Math.max(b.width, EPS), h = Math.max(b.height, EPS);
  return pts.map((p) => ({ x: (p.x * size) / w, y: (p.y * size) / h }));
}

// Translation du centroïde sur `to`.
function translateTo(pts, to = { x: 0, y: 0 }) {
  const c = centroid(pts);
  return pts.map((p) => ({ x: p.x + to.x - c.x, y: p.y + to.y - c.y }));
}

// Normalisation complète $1 (candidat comme gabarit) : null si dégénéré.
function normalize(points) {
  const pts = resample(points, N);
  if (!pts) return null;
  const rotated = rotateBy(pts, -indicativeAngle(pts));
  return translateTo(scaleTo(rotated, SIZE), { x: 0, y: 0 });
}

// Distance moyenne point à point entre deux tracés normalisés (même longueur).
const pathDistance = (a, b) => a.reduce((s, p, i) => s + dist(p, b[i]), 0) / a.length;

const distanceAtAngle = (pts, template, angle) => pathDistance(rotateBy(pts, angle), template);

// Golden section search : minimum de distanceAtAngle sur [a, b] (fonction
// unimodale en pratique), sans dériver — exactement le schéma du papier $1.
function distanceAtBestAngle(pts, template, a, b, precision) {
  let x1 = PHI * a + (1 - PHI) * b;
  let f1 = distanceAtAngle(pts, template, x1);
  let x2 = (1 - PHI) * a + PHI * b;
  let f2 = distanceAtAngle(pts, template, x2);
  while (Math.abs(b - a) > precision) {
    if (f1 < f2) {
      b = x2; x2 = x1; f2 = f1;
      x1 = PHI * a + (1 - PHI) * b;
      f1 = distanceAtAngle(pts, template, x1);
    } else {
      a = x1; x1 = x2; f1 = f2;
      x2 = (1 - PHI) * a + PHI * b;
      f2 = distanceAtAngle(pts, template, x2);
    }
  }
  return Math.min(f1, f2);
}

// Gabarits pré-traités UNE FOIS au chargement du module : tous les `variants`
// de toutes les runes (chaque variant est un gabarit indépendant de même clé).
const TEMPLATES = [];
for (const rune of Object.values(RUNES)) {
  for (const variant of rune.variants || []) {
    const pts = normalize(variant);
    if (pts) TEMPLATES.push({ key: rune.key, points: pts });
  }
}

// Reconnaît une rune dans un tracé brut ({x,y}[], repère quelconque).
// → { key, score } du meilleur gabarit si score ≥ (threshold ?? MAGIC.recogThreshold),
//   sinon null. Défensif : tracé trop court ou géométrie dégénérée → null sans throw.
export function recognizeRune(points, { threshold } = {}) {
  if (!Array.isArray(points) || points.length < MIN_POINTS) return null;
  const b = strokeBounds(points);
  if (!(Math.max(b.width, b.height) > EPS)) return null; // tap immobile / NaN
  const candidate = normalize(points);
  if (!candidate) return null;
  let bestKey = null, bestD = Infinity;
  for (const t of TEMPLATES) {
    const d = distanceAtBestAngle(candidate, t.points, -ANGLE_RANGE, ANGLE_RANGE, ANGLE_PRECISION);
    if (d < bestD) { bestD = d; bestKey = t.key; }
  }
  if (bestKey == null) return null;
  const score = 1 - bestD / HALF_DIAGONAL;
  return score >= (threshold ?? MAGIC.recogThreshold) ? { key: bestKey, score } : null;
}
