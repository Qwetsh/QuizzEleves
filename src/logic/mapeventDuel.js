// Tirage PUR d'une manche « LIEU → ÉVÉNEMENT » (Terre du Milieu). Réutilisable
// par le STORE (mapeventFightHandlers) ET les tests — AUCUN état module-level,
// AUCUN appel à Math.random au chargement (seulement dans la fonction, via `rng`
// injectable pour un tirage déterministe en test).
//
// Une manche = 1 lieu CIBLE (marqué sur la carte, c'est l'énoncé PUBLIC) + 4
// choix d'événements mélangés : le bon (l'événement de la cible) + 3 distracteurs
// (les événements d'AUTRES lieux). Chaque choix reçoit un `id` OPAQUE ('c0'..'c3')
// assigné APRÈS mélange → l'ordre des choix ne trahit jamais lequel est bon.
//
// Anti-répétition : `served` (Set des `place` déjà servis) évite de re-tirer le
// même lieu comme cible tant que le pool frais n'est pas épuisé (reset alors).
//
// Le composant tactile (LotrEventDuel.jsx) a son propre `drawRound` interne — ON
// NE LE TOUCHE PAS ; cette version vit dans logic/ pour le store et les tests.

// Une entrée est valide si elle a un lieu et un événement exploitables.
function isValidEntry(e) {
  return !!(e && typeof e.place === 'string' && typeof e.event === 'string');
}

/**
 * Tire une manche du duel « lieu → événement ».
 * @param {Array<{place,x,y,event,eventEn}>} events - source (LOTR_EVENTS)
 * @param {{ served?: Set<string>, rng?: () => number }} [opts]
 *   - served : Set des `place` déjà servis comme cible (anti-répétition). Muté :
 *     la cible tirée y est AJOUTÉE ; réinitialisé (vidé) si tous les lieux frais
 *     sont épuisés avant de tirer.
 *   - rng : générateur [0,1) injectable (défaut Math.random).
 * @returns {null | { target:{place,x,y}, choices:Array<{id,event,eventEn}>, correctId:string }}
 *   null si moins de 4 lieux valides (impossible de composer cible + 3 distracteurs).
 */
export function drawMapeventRound(events, { served = new Set(), rng = Math.random } = {}) {
  const valid = (Array.isArray(events) ? events : []).filter(isValidEntry);
  if (valid.length < 4) return null;

  const pick = (arr) => arr[Math.floor(rng() * arr.length)];

  // Cible parmi les lieux FRAIS (non déjà servis). Épuisé → on réinitialise le
  // Set (on recycle tout le pool) pour ne jamais rester bloqué.
  let fresh = valid.filter((e) => !served.has(e.place));
  if (fresh.length === 0) { served.clear(); fresh = valid; }
  const target = pick(fresh);
  served.add(target.place);

  // 3 distracteurs = événements d'AUTRES lieux (jamais la cible elle-même).
  const others = valid.filter((e) => e.place !== target.place);
  const distractors = [];
  const pool = others.slice();
  while (distractors.length < 3 && pool.length) {
    const i = Math.floor(rng() * pool.length);
    distractors.push(pool.splice(i, 1)[0]);
  }

  // Les 4 choix (le bon + 3 distracteurs), mélangés AVANT d'assigner les id.
  const draft = [target, ...distractors].map((e) => ({ event: e.event, eventEn: e.eventEn, _correct: e.place === target.place }));
  // Mélange (Fisher-Yates) via rng injectable.
  for (let i = draft.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [draft[i], draft[j]] = [draft[j], draft[i]];
  }

  // id OPAQUE assigné APRÈS mélange ('c0'..'c3') ; correctId = celui de la cible.
  let correctId = null;
  const choices = draft.map((c, i) => {
    const id = `c${i}`;
    if (c._correct) correctId = id;
    return { id, event: c.event, eventEn: c.eventEn };
  });

  return { target: { place: target.place, x: target.x, y: target.y }, choices, correctId };
}
