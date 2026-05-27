import { EVENTS } from '../data/events.js';

/**
 * Tirage pondere d'un evenement parmi les evenements actifs.
 * @param {string[]} enabledKeys - cles des evenements actives (ex: ['rejouer','recul',...])
 * @returns {{ key: string, event: object }} l'evenement tire
 */
export function pickRandomEvent(enabledKeys) {
  const pool = enabledKeys
    .filter((k) => EVENTS[k])
    .map((k) => ({ key: k, event: EVENTS[k], weight: EVENTS[k].weight }));

  if (pool.length === 0) return null;

  const totalWeight = pool.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return { key: entry.key, event: entry.event };
  }

  // fallback (ne devrait pas arriver)
  return { key: pool[0].key, event: pool[0].event };
}
