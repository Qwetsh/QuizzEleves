// Navigation dans le graphe de nœuds du plateau (avance/recul, jonctions).
// Premier fichier migré en TypeScript (référence) — logique pure, couverte par
// src/__tests__/pathfinding.test.js.
import type { Board } from '../types';

export type Predecessors = Record<string, string[]>;

/** Map des prédécesseurs du graphe : { nodeId: [predId, ...] }. */
export function buildPredecessors(nodes: Board): Predecessors {
  const preds: Predecessors = {};
  for (const [id, node] of Object.entries(nodes)) {
    for (const nxt of node.next) {
      if (!preds[nxt]) preds[nxt] = [];
      preds[nxt].push(id);
    }
  }
  return preds;
}

export interface MoveForwardOpts {
  /** Traverse les jonctions via next[0] sans s'arrêter (déplacements d'événements). */
  throughJunctions?: boolean;
}
export interface MoveForwardResult {
  finalPos: string;
  stoppedAtJunction: boolean;
  remaining: number;
  path: string[];
}

/**
 * Avance de `steps` cases en suivant next[0]. S'arrête aux jonctions (choix
 * requis) ou à l'arrivée. Si la case de départ est une jonction multi-branches,
 * s'arrête immédiatement (remaining = steps) pour demander le choix.
 */
export function moveForward(nodes: Board, currentPos: string, steps: number, opts: MoveForwardOpts = {}): MoveForwardResult {
  const { throughJunctions = false } = opts;
  let pos = currentPos;
  const path = [currentPos];

  for (let i = 0; i < steps; i++) {
    const node = nodes[pos];
    if (!node || node.next.length === 0) break;

    if (!throughJunctions && node.next.length > 1) {
      return { finalPos: pos, stoppedAtJunction: true, remaining: steps - i, path };
    }

    pos = node.next[0];
    path.push(pos);

    if (nodes[pos].type === 'arrivee') break;
  }

  return { finalPos: pos, stoppedAtJunction: false, remaining: 0, path };
}

export interface MoveBackResult {
  finalPos: string;
  path: string[];
}

/**
 * Recule de `steps` cases en suivant les prédécesseurs. En cas de jonction
 * (plusieurs prédécesseurs), prend le premier.
 */
export function moveBack(nodes: Board, currentPos: string, steps: number, preds?: Predecessors): MoveBackResult {
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

/** Prochaine jonction (ou arrivée) en avançant — événement Téléporteur. */
export function findNextJunction(nodes: Board, currentPos: string): string {
  let pos = currentPos;
  const visited = new Set<string>();
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

/** Dernière jonction (ou départ) en reculant — événement Embuscade. */
export function findPrevJunction(nodes: Board, currentPos: string, preds?: Predecessors): string {
  if (!preds) preds = buildPredecessors(nodes);

  let pos = currentPos;
  const visited = new Set<string>();
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
