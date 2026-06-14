import { CYCLE4_QUESTIONS } from './_cycle4.js';
import { BREVET_QUESTIONS } from './_brevet.js';
import { SUBJECT_KEYS, FORCED_SUBJECT_KEYS } from '../subjects.js';

// Store mutable des questions. Initialisé avec les fichiers JS embarqués (donc
// dispo immédiatement et hors-ligne), il peut être REMPLACÉ par les données
// Supabase via setQuestionData (voir src/logic/questionsConfig.js). Tout le jeu
// passe par getQuestions/countQuestions : il lit toujours la dernière source.
const clone = (v) => JSON.parse(JSON.stringify(v));
const STORE = {
  cycle4: clone(CYCLE4_QUESTIONS),
  brevet: clone(BREVET_QUESTIONS),
};

// Remplace les pools (appelé par la couche de chargement). Tolère un pool
// manquant (on garde l'ancien) pour ne jamais se retrouver sans questions.
export function setQuestionData({ cycle4, brevet } = {}) {
  if (cycle4 && Object.keys(cycle4).length) STORE.cycle4 = cycle4;
  if (brevet && Object.keys(brevet).length) STORE.brevet = brevet;
}

/**
 * Filtre les questions par niveau en se basant sur le prefixe du champ `t`.
 * Niveaux possibles : '6e', '5e', '4e', '3e', 'cycle4' (= 5e+4e+3e), 'all'.
 */
function filterByLevel(questions, level) {
  if (level === 'all' || level === 'cycle4') return questions;
  // Questions Supabase : champ `level` fiable. Fichiers JS (fallback) : pas de
  // `level`, on retombe sur le préfixe du thème (« 5e — … »).
  return questions.filter((q) => (q.level ? q.level === level : (q.t || '').startsWith(level)));
}

/**
 * Retourne un objet { francais: [...], maths: [...], ... } filtre par niveau.
 * @param {'6e'|'5e'|'4e'|'3e'|'cycle4'} level
 * @param {{ brevet?: boolean }} [opts] - brevet:true ajoute le pool DNB (additif,
 *   indépendant du niveau) aux questions de chaque matière.
 */
export function getQuestions(level = 'cycle4', opts = {}) {
  const result = {};
  for (const key of SUBJECT_KEYS) {
    const base = filterByLevel(STORE.cycle4[key] || [], level);
    // Pool Brevet ajoute tel quel (déjà ciblé 3e/DNB, hors filtrage par niveau)
    result[key] = opts.brevet ? base.concat(STORE.brevet[key] || []) : base;
  }
  // Matières « forcé-only » (culture générale, hardcore) : transverses, jamais
  // filtrées par niveau — disponibles quel que soit le niveau choisi.
  for (const key of FORCED_SUBJECT_KEYS) {
    result[key] = (STORE.cycle4[key] || []).concat(STORE.brevet[key] || []);
  }
  return result;
}

/**
 * Compte total de questions disponibles pour un niveau (+ brevet optionnel).
 */
export function countQuestions(level = 'cycle4', opts = {}) {
  const qs = getQuestions(level, opts);
  // Compte par niveau = matières du plateau seulement (les forcé-only sont
  // transverses et fausseraient le compteur affiché au setup).
  return SUBJECT_KEYS.reduce((sum, key) => sum + (qs[key]?.length || 0), 0);
}

// Accès direct aux pools courants (lecture seule) — utile aux éditeurs.
export function getQuestionStore() {
  return STORE;
}

export { CYCLE4_QUESTIONS, BREVET_QUESTIONS };
