// Génération des plannings du mini-jeu « chasse aux bulles » (BubbleHunt).
// Séparé du composant pour rester testable et ne pas casser le Fast Refresh.
import { shuffle } from '../../../data/fightData';

export const ROUND_MS = 30000;
export const LIFE_MS = 2600;       // durée de vie d'une bulle
export const SPAWN_EVERY_MS = 850; // cadence d'apparition (+ jitter)
export const GOOD_RATIO = 0.55;

/**
 * Génère DEUX plannings indépendants (un par côté) pour une manche : MÊME rythme
 * et MÊMES emplacements (squelette de slots commun → équité), mais placement
 * bonnes/mauvaises et MOTS différents de chaque côté (même nombre de bonnes →
 * difficulté égale). Les deux joueurs ne voient donc PAS les mêmes mots au même
 * instant : impossible de se copier. Zone 4x3 pour éviter les chevauchements.
 */
export function makeSchedules(challenge) {
  const cols = 4;
  const rows = 3;
  const zoneBusyUntil = Array(cols * rows).fill(0);
  const slots = [];
  let t = 700;
  let id = 0;

  while (t < ROUND_MS - LIFE_MS - 200) {
    const free = [];
    for (let z = 0; z < cols * rows; z++) if (zoneBusyUntil[z] <= t) free.push(z);
    if (free.length) {
      const z = free[Math.floor(Math.random() * free.length)];
      zoneBusyUntil[z] = t + LIFE_MS + 250;
      slots.push({
        id: id++,
        x: (z % cols + 0.5) / cols + (Math.random() - 0.5) * 0.08,
        y: (Math.floor(z / cols) + 0.5) / rows + (Math.random() - 0.5) * 0.10,
        t,
      });
    }
    t += SPAWN_EVERY_MS + Math.random() * 300;
  }

  // Même nombre de bonnes bulles des deux côtés (difficulté égale), mais position
  // (quels slots sont « bons ») et mots tirés indépendamment → contenu différent.
  const goodCount = Math.round(slots.length * GOOD_RATIO);
  const assignSide = () => {
    const goodSlots = new Set(shuffle(slots.map((_, i) => i)).slice(0, goodCount));
    const goodPool = shuffle(challenge.good);
    const badPool = shuffle(challenge.bad);
    let gi = 0;
    let bi = 0;
    return slots.map((s, i) => {
      const good = goodSlots.has(i);
      const label = good ? goodPool[gi++ % goodPool.length] : badPool[bi++ % badPool.length];
      return { ...s, good, label };
    });
  };
  return { attacker: assignSide(), defender: assignSide() };
}
