// Géométrie partagée du plateau — SOURCE UNIQUE pour BoardSVG (rendu) et
// decorGenerator (placement des props, persisté avec la partie). Toute
// retouche de taille de tuile, de rayon d'île ou du tracé des chemins se
// fait ici : les deux consommateurs restent alignés sans synchro manuelle.

// Rayon logique des cases par type (espacement, zone cliquable)
export const NODE_RADIUS = {
  depart: 52,
  arrivee: 52,
  jonction: 46,
  event: 44,
  subject: 46,
};

// Largeur de l'asset de tuile par type, en multiples du rayon (w = r * scale)
export const TILE_SCALE = {
  depart: 4.0,
  arrivee: 4.4,
  jonction: 3.1,
  event: 3.2,
  subject: 3.1,
};

// Rayon VISUEL d'une tuile posée (demi-largeur de l'asset rendu)
export function tileRadius(type) {
  return ((NODE_RADIUS[type] || 32) * (TILE_SCALE[type] || 3.1)) / 2;
}

// Île organique : rayons des cercles fusionnés par le filtre gooey
export const ISLAND_NODE_R = 170;
export const ISLAND_EDGE_R = 145;
// L'herbe est rendue à ce ratio du rayon de l'île (grass-mask de BoardSVG)
export const GRASS_RENDER_RATIO = 0.72;

// Courbe d'un chemin entre deux cases :
// Bézier cubique M(x0,y0) C(cx,y0) (cx,y1) (x1,y1) avec cx au milieu
export function bezierPoint(x0, y0, x1, y1, t) {
  const cx = x0 + (x1 - x0) * 0.5;
  const u = 1 - t;
  return {
    x: u * u * u * x0 + 3 * u * u * t * cx + 3 * u * t * t * cx + t * t * t * x1,
    y: u * u * u * y0 + 3 * u * u * t * y0 + 3 * u * t * t * y1 + t * t * t * y1,
  };
}

// Cercles de l'île pour un plateau donné : un par case + le long des chemins
export function islandCircles(board, edgeSamples = 4) {
  const circles = [];
  for (const node of Object.values(board)) {
    circles.push({ x: node.x, y: node.y, r: ISLAND_NODE_R });
    for (const toId of node.next) {
      const t2 = board[toId];
      if (!t2) continue;
      for (let i = 1; i < edgeSamples; i++) {
        const p = bezierPoint(node.x, node.y, t2.x, t2.y, i / edgeSamples);
        circles.push({ x: p.x, y: p.y, r: ISLAND_EDGE_R });
      }
    }
  }
  return circles;
}
