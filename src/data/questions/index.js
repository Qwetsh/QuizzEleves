import { CYCLE4_QUESTIONS } from './_cycle4.js';
import { BREVET_QUESTIONS } from './_brevet.js';
import { SUBJECT_KEYS, FORCED_SUBJECT_KEYS, SUBJECTS, MODULES } from '../subjects.js';

// Un sous-thème est filtré par NIVEAU seulement si son thème (module) est
// scolaire ('school' → niveaux 6e/5e/…). Les thèmes 'themed' (Film, Sport…)
// sont TRANSVERSES (pas de niveau), comme cultureG/hardcore. Défaut = school
// (rétro-compat : les matières historiques sont 'college'/school).
function isLevelled(key) {
  const mod = SUBJECTS[key]?.module;
  return !mod || (MODULES[mod]?.kind ?? 'school') === 'school';
}

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
 * Filtre les questions par niveau. `level` peut être une CHAÎNE ('6e','5e',…)
 * ou un TABLEAU de niveaux (sélection multiple, ex. ['5e','4e']). 'cycle4' et
 * 'all' = aucun filtre (tout le pool). Une question est gardée si son niveau
 * figure dans la sélection.
 */
function filterByLevel(questions, level) {
  const raw = Array.isArray(level) ? level : [level];
  if (raw.includes('all') || raw.includes('cycle4')) return questions;
  const wanted = new Set(raw);
  // Questions Supabase : champ `level` fiable. Fichiers JS (fallback) : pas de
  // `level`, on retombe sur le préfixe du thème (« 5e — … »).
  return questions.filter((q) =>
    q.level ? wanted.has(q.level) : [...wanted].some((l) => (q.t || '').startsWith(l)));
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
    const all = STORE.cycle4[key] || [];
    // Thème scolaire → filtre par niveau ; thème non scolaire → transverse.
    const base = isLevelled(key) ? filterByLevel(all, level) : all;
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
  // Compte par niveau = matières SCOLAIRES du plateau seulement (forcé-only et
  // thèmes non scolaires sont transverses et fausseraient le compteur du setup).
  return SUBJECT_KEYS.filter(isLevelled).reduce((sum, key) => sum + (qs[key]?.length || 0), 0);
}

// Accès direct aux pools courants (lecture seule) — utile aux éditeurs.
export function getQuestionStore() {
  return STORE;
}

// TOUS les thèmes AYANT des questions réellement chargées (base + culture-G +
// forcé), quel que soit le périmètre de la partie. Reflète le STORE (tout est
// chargé au boot via cache + Supabase) — ne déclenche AUCUN chargement. Sert de
// vivier au « thème aléatoire parmi TOUS les thèmes possibles ».
export function allSubjectsWithContent() {
  const keys = new Set([...Object.keys(STORE.cycle4), ...Object.keys(STORE.brevet)]);
  return [...keys].filter((k) => (STORE.cycle4[k]?.length || 0) + (STORE.brevet[k]?.length || 0) > 0);
}

// Pool complet d'UN thème (cycle4 + brevet), TRANSVERSE (aucun filtre de niveau)
// — pour poser une question « surprise » d'un thème hors partie forcé par un
// effet. Retourne [] si le thème n'a pas (encore) de questions chargées.
export function getSubjectPool(key) {
  return (STORE.cycle4[key] || []).concat(STORE.brevet[key] || []);
}

export { CYCLE4_QUESTIONS, BREVET_QUESTIONS };
