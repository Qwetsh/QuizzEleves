// Le journal (state.log) accepte deux formes d'entrée :
//   - une chaîne (cas historique, la grande majorité)
//   - un objet { text, detail } où `detail` est un tableau de facteurs
//     { label, amount?, note? } affichés dans un volet dépliable (GameLog).
// Ces helpers normalisent la lecture : le mobile et la persistance n'ont besoin
// que du texte ; GameLog exploite le détail.

// Texte affichable d'une entrée (chaîne brute ou objet structuré).
export function logText(entry) {
  if (entry == null) return '';
  return typeof entry === 'string' ? entry : (entry.text || '');
}

// Détail structuré d'une entrée, ou null s'il n'y en a pas.
export function logDetail(entry) {
  if (entry && typeof entry === 'object' && Array.isArray(entry.detail) && entry.detail.length) {
    return entry.detail;
  }
  return null;
}

// Montant signé lisible : 6 → "+6", -2 → "−2", 0 → "0".
export function signed(n) {
  const v = Number(n) || 0;
  if (v > 0) return `+${v}`;
  if (v < 0) return `−${Math.abs(v)}`; // vrai signe moins
  return '0';
}
