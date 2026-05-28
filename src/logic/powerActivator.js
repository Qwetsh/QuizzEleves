import { POWERS } from '../data/powers.js';

/**
 * Determine si un pouvoir peut etre utilise dans le contexte UI actuel.
 * Using charges is free — players pay only to buy charges in the shop.
 */
export function canUsePowerInContext(key, context) {
  const { diceValue, showQuestion, rolling, showEvent, awaitingChoice, finished, pendingLanding } = context;
  const info = POWERS[key];
  if (!info) return false;

  if (key === 'relance') return !!diceValue && !showQuestion && !rolling && !showEvent && !!pendingLanding;
  if (key === 'indice') return !!showQuestion && !rolling;
  if (key === 'bouclier') return false; // passive, auto-triggered
  if (info.category === 'off') return !showQuestion && !rolling && !showEvent && !awaitingChoice && !finished && (!diceValue || !!pendingLanding);
  return false;
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
