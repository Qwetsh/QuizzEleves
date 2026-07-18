// Maths PURES de la pyramide de tuiles Curioscope (testées sans sharp/réseau).
// Convention : tuiles 256 px, origine en haut-gauche, nommage {z}/{x}/{y}
// (z = 0 → 1 tuile ; z = maxZoom → pleine résolution), style gdal2tiles --xyz.

export const TILE = 256;

// Niveau de zoom natif maximal pour couvrir l'image en tuiles de 256 px.
export function maxZoomFor(w, h) {
  return Math.max(0, Math.ceil(Math.log2(Math.max(w, h) / TILE)));
}

// Dimensions de l'image réduite au niveau z (pleine résolution à z = maxZoom).
export function levelSize(w, h, z, maxZoom) {
  const f = 2 ** (maxZoom - z);
  return { w: Math.max(1, Math.ceil(w / f)), h: Math.max(1, Math.ceil(h / f)) };
}

// Grille de tuiles d'un niveau : [{ z, x, y, left, top, w, h }] en px du niveau.
export function tileGrid(w, h, z, maxZoom) {
  const { w: lw, h: lh } = levelSize(w, h, z, maxZoom);
  const tiles = [];
  for (let ty = 0; ty * TILE < lh; ty++) {
    for (let tx = 0; tx * TILE < lw; tx++) {
      tiles.push({
        z, x: tx, y: ty,
        left: tx * TILE, top: ty * TILE,
        w: Math.min(TILE, lw - tx * TILE),
        h: Math.min(TILE, lh - ty * TILE),
      });
    }
  }
  return tiles;
}

export function totalTiles(w, h, maxZoom) {
  let n = 0;
  for (let z = 0; z <= maxZoom; z++) n += tileGrid(w, h, z, maxZoom).length;
  return n;
}

// Cadres monde des cartes de CONTINENT uiMap (build 2.5.6 Anniversary/TBC,
// table UiMapAssignment via wago.tools, lignes UiMin 0,0 → UiMax 1,1).
// Convention WoW : u (droite sur la carte) croît quand worldY DÉCROÎT (est),
// v (bas) croît quand worldX DÉCROÎT (sud).
export const WOW_UIMAP_FRAMES = {
  wow_kalimdor: { minX: -11733.2998, maxX: 12799.9004, minY: -19733.2109, maxY: 17066.5996 },
  wow_royaumes_est: { minX: -15973.3438, maxX: 11176.3438, minY: -22569.2109, maxY: 18171.9707 },
  wow_outremonde: { minX: -5821.3594, maxX: 5821.3594, minY: -4468.0391, maxY: 12996.0391 },
};

// Une tuile ADT couvre 533,33 yards ; la grille est indexée depuis le coin
// nord-ouest du monde : bord ouest de la colonne c → worldY = (32−c)·533,33,
// bord nord de la ligne r → worldX = (32−r)·533,33.
const ADT_YARDS = 533.33333;

/**
 * Points de référence du cadre uiMap d'un continent WoW dans les pixels d'un
 * assemblage de tuiles ADT (assemble-tex.mjs) : renvoie les 2 refs (coins
 * 0,0 et 1,1) à passer à make-tiles — calibration 100 % mathématique.
 */
export function adtFrameRefs(universe, minCol, minRow, tilePx) {
  const f = WOW_UIMAP_FRAMES[universe];
  if (!f) throw new Error(`adtFrameRefs : univers inconnu ${universe}`);
  const px = (worldY) => ((32 - worldY / ADT_YARDS) - minCol) * tilePx;
  const py = (worldX) => ((32 - worldX / ADT_YARDS) - minRow) * tilePx;
  return [
    { cx: 0, cy: 0, px: px(f.maxY), py: py(f.maxX) }, // coin haut-gauche (nord-ouest)
    { cx: 1, cy: 1, px: px(f.minY), py: py(f.minX) }, // coin bas-droite (sud-est)
  ];
}

/**
 * Cadre uiMap dans les pixels de l'image source, résolu par ≥2 points de
 * référence { cx, cy, px, py } : cx/cy = coords normalisées uiMap (imprimées
 * par l'addon CurioSnap), px/py = position du même lieu en pixels sur l'image.
 * Résout px = A·cx + B par moindres carrés → cadre = [B, A+B] par axe.
 * Retourne { left, top, width, height } (peut déborder de l'image : la
 * découpe étend alors avec un fond).
 */
export function solveFrame(refs) {
  if (!refs || refs.length < 2) throw new Error('solveFrame : au moins 2 points de référence');
  const fit = (us, ps) => {
    const n = us.length;
    const su = us.reduce((a, b) => a + b, 0);
    const sp = ps.reduce((a, b) => a + b, 0);
    const suu = us.reduce((a, b) => a + b * b, 0);
    const sup = us.reduce((a, u, i) => a + u * ps[i], 0);
    const den = n * suu - su * su;
    if (Math.abs(den) < 1e-9) throw new Error('solveFrame : points de référence dégénérés (même cx ou même cy)');
    const A = (n * sup - su * sp) / den;
    const B = (sp - A * su) / n;
    return { A, B };
  };
  const fx = fit(refs.map((r) => r.cx), refs.map((r) => r.px));
  const fy = fit(refs.map((r) => r.cy), refs.map((r) => r.py));
  return {
    left: Math.round(fx.B),
    top: Math.round(fy.B),
    width: Math.round(fx.A),
    height: Math.round(fy.A),
  };
}
