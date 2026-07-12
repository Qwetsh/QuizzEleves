import { EVENTS } from '../data/events.js';
import { extOn } from '../extensions/registry.js';

/**
 * Tirage pondere d'un evenement parmi les evenements actifs.
 * @param {string[]} enabledKeys - cles des evenements actives (ex: ['rejouer','recul',...])
 * @param {object} [opts]
 * @param {boolean} [opts.itemsEnabled=true] - si false, exclut les evenements qui
 *   dependent du systeme d'objets (marques `needsItems`) — extension equipement coupee.
 * @param {object} [opts.extensions] - map d'extensions actives ; un event avec
 *   `requires: ['alchemy', ...]` n'est tire QUE si toutes ses extensions sont actives.
 * @param {string} [opts.connectionMode] - 'phone' | 'board' ; un event marque
 *   `requiresPhone` n'est tire QUE si les equipes ont ete creees au telephone.
 * @param {boolean} [opts.schoolSubject=true] - vrai s'il y a au moins une matiere
 *   SCOLAIRE sur le plateau ; un event marque `requiresSchool` (ex: bossProf) n'est
 *   tire QUE dans ce cas (le « Prof » n'a pas de sens en partie 100% ludique).
 * @returns {{ key: string, event: object }} l'evenement tire
 */
export function pickRandomEvent(enabledKeys, opts = {}) {
  const { itemsEnabled = true, extensions, connectionMode, schoolSubject = true } = opts;
  const ok = (ev) => (itemsEnabled || !ev.needsItems)
    && (ev.requires || []).every((ext) => extOn(extensions, ext))
    && (!ev.requiresPhone || connectionMode === 'phone')
    && (!ev.requiresSchool || schoolSubject);
  const pool = enabledKeys
    .filter((k) => EVENTS[k] && ok(EVENTS[k]))
    .map((k) => ({ key: k, event: EVENTS[k], weight: EVENTS[k].weight ?? 1 }));

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
