import { ITEMS } from '../data/items.js';

/**
 * Liste des objets actuellement équipés d'une équipe (defs du catalogue).
 * Tolère les sauvegardes anciennes sans champ equipment.
 */
export function equippedItems(team) {
  const eq = team?.equipment || {};
  return ['head', 'body', 'feet'].map((slot) => ITEMS[eq[slot]]).filter(Boolean);
}

/**
 * Somme des valeurs d'un type d'effet passif sur tout l'équipement porté.
 * Seule source de vérité : items.js.
 */
export function getEffectValue(team, type) {
  let total = 0;
  for (const item of equippedItems(team)) {
    for (const fx of item.effects) {
      if (fx.type === type) total += fx.value;
    }
  }
  return total;
}

export function hasEffect(team, type) {
  return getEffectValue(team, type) > 0;
}

/**
 * Recul subi après réduction par l'équipement (mauvaise réponse, Foudre,
 * défaite de duel). Jamais négatif.
 */
export function reducedRecul(team, amount) {
  return Math.max(0, amount - getEffectValue(team, 'reculReduction'));
}

/**
 * Pièces effectivement volées à une équipe protégée (stealProtection en %).
 */
export function reducedSteal(victim, amount) {
  const protection = Math.min(100, getEffectValue(victim, 'stealProtection'));
  return Math.max(0, Math.floor(amount * (1 - protection / 100)));
}

/**
 * Taxe/impôt effectivement payé par une équipe protégée (taxReduction en %).
 */
export function reducedTax(team, amount) {
  const reduction = Math.min(100, getEffectValue(team, 'taxReduction'));
  return Math.max(0, Math.ceil(amount * (1 - reduction / 100)));
}
