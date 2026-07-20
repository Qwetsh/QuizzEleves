// Moteur PUR du mini-jeu de duel « Cyber-duel » (thème informatique_numerique).
// Aucune dépendance React, aucun Math.random au cœur : l'aléa (choix du langage,
// tirage de l'énigme) est piloté par le COMPOSANT, qui passe et met à jour un
// état `served` (anti-répétition) et pige lui-même dans les candidats.
//
// SCHÉMA d'une énigme (src/data/hackPuzzles.json → { puzzles: [...] }) :
//   { id, lang, level:1|2|3, title, titleEn, lines:[...], blanks:[{answer, choices:[4]}] }
//   - `lines`  = lignes de code ; les trous sont marqués `§0`, `§1`… (contigus
//                à partir de 0), et correspondent 1-à-1 à `blanks[N]`.
//   - `blanks[N]` = { answer, choices:[4] } avec answer ∈ choices.
//   - `lang` ∈ { python, javascript, bash, sql, c, php }.
// On COMPLÈTE LES TROUS DANS L'ORDRE : à chaque étape, seul le trou courant
// (`cur`) peut être rempli ; le bon token l'illumine et avance ; le dernier trou
// rempli résout l'énigme (barre de « hack » à 100 %).

// Langages présents dans un jeu d'énigmes (pour le menu de choix), triés pour un
// ordre STABLE et reproductible (déterminisme du menu, pas de Math.random).
export function languagesOf(puzzles) {
  const set = new Set();
  for (const p of puzzles || []) if (p && p.lang) set.add(p.lang);
  return [...set].sort();
}

// Toutes les énigmes d'un langage donné (repli : jeu complet si `lang` absent).
function byLang(puzzles, lang) {
  return (puzzles || []).filter((p) => p && (!lang || p.lang === lang));
}

// Ordre de repli des niveaux quand le niveau visé est vide : on cherche le plus
// proche (level-1, level+1, level-2, …) pour toujours servir une énigme.
function levelFallbackOrder(level) {
  const order = [level];
  for (let d = 1; d < 6; d++) { order.push(level - d); order.push(level + d); }
  return order.filter((l) => l >= 1);
}

/**
 * Tire UNE énigme du bon langage / niveau, non déjà servie (anti-répétition via
 * `served` = Set d'ids muté en place). Repli sur le niveau voisin le plus proche
 * si le niveau visé n'a rien de neuf. Retourne null si le langage n'a aucune
 * énigme du tout.
 *
 * `rng` (optionnel) : fonction [0,1) injectable pour des tests déterministes ;
 * par défaut Math.random (appelé DANS le composant, jamais au rendu).
 */
export function pickPuzzle(puzzles, { lang, level = 1, served, rng = Math.random } = {}) {
  const pool = byLang(puzzles, lang);
  if (!pool.length) return null;
  const seen = served instanceof Set ? served : new Set();

  for (const lv of levelFallbackOrder(level)) {
    const atLevel = pool.filter((p) => p.level === lv);
    if (!atLevel.length) continue;
    const fresh = atLevel.filter((p) => !seen.has(p.id));
    const bag = fresh.length ? fresh : atLevel; // pool du niveau épuisé → on recycle
    if (!fresh.length) {
      // Épuisement de CE niveau : on oublie ses ids (pas ceux des autres niveaux).
      for (const p of atLevel) seen.delete(p.id);
    }
    const chosen = bag[Math.floor(rng() * bag.length)] || bag[0];
    seen.add(chosen.id);
    return chosen;
  }

  // Aucun niveau ne contient d'énigme (ne devrait pas arriver, pool non vide) :
  // repli ultime sur n'importe quelle énigme neuve du langage.
  const fresh = pool.filter((p) => !seen.has(p.id));
  const bag = fresh.length ? fresh : pool;
  if (!fresh.length) for (const p of pool) seen.delete(p.id);
  const chosen = bag[Math.floor(rng() * bag.length)] || bag[0];
  seen.add(chosen.id);
  return chosen;
}

// Nombre de trous d'une énigme = longueur de blanks (source de vérité).
export function blankCount(puzzle) {
  return (puzzle?.blanks || []).length;
}

// État de remplissage d'une énigme. `filled` = tokens déjà validés (dans l'ordre),
// `cur` = index du trou courant, `solved` = tous les trous remplis.
export function createHackState(puzzle) {
  return { puzzle, filled: [], cur: 0, solved: false };
}

/**
 * Tente de remplir le trou COURANT avec `choice`. Remplissage DANS L'ORDRE :
 * seul le trou `cur` compte.
 *   - bon token → mute l'état (filled += choice, cur += 1), retourne
 *     { correct:true, solved? } (solved:true quand tous les trous sont remplis).
 *   - mauvais token → état INCHANGÉ, retourne { wrong:true }.
 * Déjà résolu → { wrong:true } (aucun trou à remplir).
 */
export function fillBlank(state, choice) {
  if (!state || state.solved) return { wrong: true };
  const blanks = state.puzzle?.blanks || [];
  const blank = blanks[state.cur];
  if (!blank || choice !== blank.answer) return { wrong: true };
  state.filled.push(choice);
  state.cur += 1;
  state.solved = state.cur >= blanks.length;
  return state.solved ? { correct: true, solved: true } : { correct: true };
}

// Progression de la « barre de hack » (breach %) : ratio de trous remplis, arrondi.
export function breachPct(state) {
  const n = blankCount(state?.puzzle);
  if (!n) return 0;
  return Math.round((state.filled.length / n) * 100);
}

/**
 * Découpe les lignes d'une énigme en SEGMENTS pour le rendu (testable, sans
 * React). Chaque ligne → tableau de morceaux :
 *   { type:'text', value } | { type:'blank', index, answer, filled, current }
 * `filled` = tokens déjà validés (state.filled) ; `cur` = index du trou courant.
 * Un trou marqué `§N` devient un morceau `blank` d'index N ; `filled=true` s'il a
 * déjà été rempli (value = le token posé), `current=true` si c'est le trou actif.
 */
export function renderTokens(puzzle, filled = [], cur = filled.length) {
  const blanks = puzzle?.blanks || [];
  return (puzzle?.lines || []).map((line) => {
    const parts = [];
    const re = /§(\d+)/g;
    let last = 0;
    let m;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) parts.push({ type: 'text', value: line.slice(last, m.index) });
      const index = Number(m[1]);
      const done = index < filled.length;
      parts.push({
        type: 'blank',
        index,
        answer: blanks[index]?.answer,
        filled: done,
        value: done ? filled[index] : undefined,
        current: index === cur,
      });
      last = m.index + m[0].length;
    }
    if (last < line.length) parts.push({ type: 'text', value: line.slice(last) });
    return parts;
  });
}
