import { CYCLE4_QUESTIONS } from './_cycle4.js';
import { BREVET_QUESTIONS } from './_brevet.js';
import { SUBJECT_KEYS } from '../subjects.js';

/**
 * Filtre les questions par niveau en se basant sur le prefixe du champ `t`.
 * Niveaux possibles : '6e', '5e', '4e', '3e', 'cycle4' (= 5e+4e+3e), 'all'.
 */
function filterByLevel(questions, level) {
  if (level === 'all' || level === 'cycle4') return questions;
  return questions.filter((q) => q.t.startsWith(level));
}

/**
 * Retourne un objet { francais: [...], maths: [...], ... } filtre par niveau.
 * @param {'6e'|'5e'|'4e'|'3e'|'cycle4'} level
 * @param {{ brevet?: boolean }} [opts] - brevet:true ajoute le pool DNB (additif,
 *   indépendant du niveau) aux questions de chaque matière.
 */
export function getQuestions(level = 'cycle4', opts = {}) {
  const source = CYCLE4_QUESTIONS; // TODO: ajouter CYCLE3_QUESTIONS pour 6e
  const result = {};
  for (const key of SUBJECT_KEYS) {
    const base = filterByLevel(source[key] || [], level);
    // Pool Brevet ajoute tel quel (déjà ciblé 3e/DNB, hors filtrage par niveau)
    result[key] = opts.brevet ? base.concat(BREVET_QUESTIONS[key] || []) : base;
  }
  return result;
}

/**
 * Compte total de questions disponibles pour un niveau (+ brevet optionnel).
 */
export function countQuestions(level = 'cycle4', opts = {}) {
  const qs = getQuestions(level, opts);
  return Object.values(qs).reduce((sum, arr) => sum + arr.length, 0);
}

export { CYCLE4_QUESTIONS, BREVET_QUESTIONS };
