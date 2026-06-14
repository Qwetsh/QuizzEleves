import { ITEMS } from '../data/items.js';

// --- Quantités aléatoires (dés) ---------------------------------------
// Une quantité d'effet (`fx.value` / `action.n`) peut être un NOMBRE fixe ou
// une CHAÎNE décrivant un dé : 'd4' | 'd6' | 'd10'. Le tirage est fait au
// moment de la CONSOMMATION (donc rejoué à chaque question / bonne réponse /
// événement pour les bonus passifs d'équipement).
const DICE_SIDES = { d2: 2, d3: 3, d4: 4, d6: 6, d10: 10 };

// Métriques d'équipe pour les quantités « à l'échelle » :
// - streak : bonnes réponses d'affilée (cassé sur erreur, persiste entre tours)
// - correct / wrong : totaux de la partie
// - precision : bonnes / total en % (0 si aucune réponse) ; imprecision = 100 − precision
export function teamMetric(team, per) {
  const correct = team?.correct || 0;
  const wrong = team?.wrong || 0;
  const total = correct + wrong;
  switch (per) {
    case 'streak': return team?.streak || 0;
    case 'correct': return correct;
    case 'wrong': return wrong;
    case 'precision': return total > 0 ? Math.round((correct / total) * 100) : 0;
    case 'imprecision': return total > 0 ? Math.round((wrong / total) * 100) : 0;
    default: return 0;
  }
}

// Tire la valeur concrète d'une quantité. Trois formes :
// - nombre fixe ⇒ lui-même
// - chaîne 'dN' ⇒ tirage 1..N
// - objet { per, factor, base } ⇒ base + factor × métrique d'équipe (arrondi, ≥ 0)
export function resolveAmount(v, team) {
  if (typeof v === 'string' && DICE_SIDES[v]) return Math.floor(Math.random() * DICE_SIDES[v]) + 1;
  if (v && typeof v === 'object') {
    const base = Number(v.base) || 0;
    const factor = Number(v.factor) || 0;
    return Math.max(0, Math.round(base + factor * teamMetric(team, v.per)));
  }
  return Number(v) || 0;
}

const METRIC_LABEL = { streak: 'série', correct: 'bonnes', wrong: 'ratées', precision: 'préc.%', imprecision: 'impréc.%' };

// Étiquette lisible d'une quantité ('d6' ⇒ '1D6', 3 ⇒ '3', objet ⇒ 'base+f×série').
export function diceLabel(v) {
  if (typeof v === 'string' && DICE_SIDES[v]) return `1${v.toUpperCase()}`;
  if (v && typeof v === 'object') {
    const f = v.factor ?? 1, b = v.base ?? 0;
    return `${b ? `${b}+` : ''}${f}×${METRIC_LABEL[v.per] || v.per}`;
  }
  return String(v);
}

// Deuxième couche d'aléa : un effet peut ne se déclencher qu'avec une
// probabilité `chance` (0..1). Absente ⇒ toujours (100 %). Tirée à chaque appel.
export function passesChance(chance) {
  return typeof chance !== 'number' || Math.random() < chance;
}

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
      // résout un éventuel dé (ex. timerBonus 'd4') à chaque appel → relancé
      // à chaque question / bonne réponse / événement, et n'applique l'effet
      // que s'il passe son éventuelle probabilité de déclenchement.
      if (fx.type === type && passesChance(fx.chance)) total += resolveAmount(fx.value, team);
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
