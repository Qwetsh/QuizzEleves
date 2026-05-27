/**
 * Selectionne une question aleatoire pour une matiere donnee,
 * en evitant les questions deja posees (anti-repetition).
 *
 * @param {Array} questions - tableau de questions pour la matiere
 * @param {Set} askedSet - Set d'indices deja poses pour cette matiere
 * @returns {{ question: object, index: number } | null}
 */
export function pickQuestion(questions, askedSet) {
  if (!questions || questions.length === 0) return null;

  // Candidats non encore poses
  const candidates = [];
  for (let i = 0; i < questions.length; i++) {
    if (!askedSet.has(i)) candidates.push(i);
  }

  // Si tout a ete pose, on reinitialise
  if (candidates.length === 0) {
    askedSet.clear();
    for (let i = 0; i < questions.length; i++) candidates.push(i);
  }

  const idx = candidates[Math.floor(Math.random() * candidates.length)];
  askedSet.add(idx);

  return { question: questions[idx], index: idx };
}

/**
 * Melange un tableau (Fisher-Yates) et retourne une copie.
 * Utile pour melanger l'ordre des reponses affichees.
 */
export function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
