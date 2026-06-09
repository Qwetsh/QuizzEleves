/**
 * Calcule la map des predecesseurs pour le graphe de noeuds.
 * @param {object} nodes - { id: { next: [id, ...] }, ... }
 * @returns {object} { nodeId: [predecessorId, ...] }
 */
export function buildPredecessors(nodes) {
  const preds = {};
  for (const [id, node] of Object.entries(nodes)) {
    for (const nxt of node.next) {
      if (!preds[nxt]) preds[nxt] = [];
      preds[nxt].push(id);
    }
  }
  return preds;
}

/**
 * Avance de n cases en suivant next[0] (chemin par defaut).
 * S'arrete aux jonctions (choix requis) ou a l'arrivee.
 *
 * @param {object} nodes - graphe
 * @param {string} currentPos - id du noeud actuel
 * @param {number} steps - nombre de pas
 * @returns {{ finalPos: string, stoppedAtJunction: boolean, remaining: number }}
 */
export function moveForward(nodes, currentPos, steps) {
  let pos = currentPos;
  const path = [currentPos];

  for (let i = 0; i < steps; i++) {
    const node = nodes[pos];
    if (!node || node.next.length === 0) break;

    if (node.next.length > 1 && i > 0) {
      return { finalPos: pos, stoppedAtJunction: true, remaining: steps - i, path };
    }

    pos = node.next[0];
    path.push(pos);

    if (nodes[pos].type === 'arrivee') break;
  }

  return { finalPos: pos, stoppedAtJunction: false, remaining: 0, path };
}

/**
 * Recule de n cases en suivant les predecesseurs.
 * En cas de multiples predecesseurs (jonction), prend le premier.
 *
 * @param {object} nodes - graphe
 * @param {string} currentPos - id du noeud actuel
 * @param {number} steps - nombre de pas en arriere
 * @param {object} [preds] - map de predecesseurs (optionnel, calcule si absent)
 * @returns {string} id du noeud final
 */
export function moveBack(nodes, currentPos, steps, preds) {
  if (!preds) preds = buildPredecessors(nodes);

  let pos = currentPos;
  const path = [currentPos];
  for (let i = 0; i < steps; i++) {
    const p = preds[pos];
    if (!p || p.length === 0) break;
    pos = p[0];
    path.push(pos);
  }
  return { finalPos: pos, path };
}

/**
 * Trouve la prochaine jonction en avancant depuis une position.
 * Utilise pour l'evenement Teleporteur.
 */
export function findNextJunction(nodes, currentPos) {
  let pos = currentPos;
  const visited = new Set();
  let iter = 0;
  while (pos) {
    if (++iter > 1000) break;
    if (visited.has(pos)) break;
    visited.add(pos);
    const node = nodes[pos];
    if (!node || node.next.length === 0) break;
    pos = node.next[0];
    if (nodes[pos].type === 'jonction' || nodes[pos].type === 'arrivee') return pos;
  }
  return currentPos;
}

/**
 * Trouve la derniere jonction en reculant depuis une position.
 * Utilise pour l'evenement Embuscade.
 */
export function findPrevJunction(nodes, currentPos, preds) {
  if (!preds) preds = buildPredecessors(nodes);

  let pos = currentPos;
  const visited = new Set();
  let iter = 0;
  while (pos) {
    if (++iter > 1000) break;
    if (visited.has(pos)) break;
    visited.add(pos);
    const p = preds[pos];
    if (!p || p.length === 0) break;
    pos = p[0];
    if (nodes[pos].type === 'jonction' || nodes[pos].type === 'depart') return pos;
  }
  return currentPos;
}
