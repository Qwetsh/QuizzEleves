import { POWERS } from '../data/powers.js';

/**
 * Verifie si une equipe peut utiliser un pouvoir.
 * @param {object} team - l'equipe { powers: { bouclier: { charges: N }, ... } }
 * @param {string} powerKey - cle du pouvoir
 * @returns {boolean}
 */
export function canUsePower(team, powerKey) {
  const power = team.powers?.[powerKey];
  if (!power) return false;
  return power.charges > 0;
}

/**
 * Consomme une charge d'un pouvoir.
 * Retourne le nouveau nombre de charges (ou -1 si impossible).
 */
export function consumeCharge(team, powerKey) {
  const power = team.powers?.[powerKey];
  if (!power || power.charges <= 0) return -1;
  power.charges -= 1;
  return power.charges;
}

/**
 * Ajoute une charge a un pouvoir.
 */
export function addCharge(team, powerKey, amount = 1) {
  if (!team.powers?.[powerKey]) return;
  team.powers[powerKey].charges += amount;
}

/**
 * Retourne la liste des pouvoirs disponibles (avec charges > 0) pour une equipe.
 */
export function getAvailablePowers(team) {
  if (!team.powers) return [];
  return Object.entries(team.powers)
    .filter(([, p]) => p.charges > 0)
    .map(([key, p]) => ({ key, ...POWERS[key], charges: p.charges }));
}
