import { POWERS } from '../data/powers.js';
import { SUBJECT_KEYS } from '../data/subjects.js';
import { moveBack } from './pathfinding.js';

/**
 * Pick a random subject key.
 */
export function randomSubject() {
  return SUBJECT_KEYS[Math.floor(Math.random() * SUBJECT_KEYS.length)];
}

/**
 * Resolve a wrong answer: use bouclier if available, otherwise move back.
 * Returns { updatedTeam, logMessage }.
 */
export function resolveWrongAnswer(team, board, reason = 'Mauvaise r\u00e9ponse') {
  const bouclierCharges = team.powers?.bouclier?.charges ?? 0;
  if (bouclierCharges > 0) {
    const newPowers = { ...team.powers, bouclier: { ...team.powers.bouclier, charges: bouclierCharges - 1 } };
    return {
      updatedTeam: { ...team, wrong: team.wrong + 1, powers: newPowers },
      logMessage: `\u274C ${reason} ! \u{1F6E1}\uFE0F Bouclier activ\u00e9 : pas de recul !`,
    };
  }
  const newPos = moveBack(board, team.pos, 2);
  return {
    updatedTeam: { ...team, wrong: team.wrong + 1, pos: newPos },
    logMessage: `\u274C ${reason} ! Recul de 2 cases.`,
  };
}

/**
 * Handle double/triple question continuation.
 * Returns { shouldContinue, updatedTeam, logMessage } or { shouldContinue: false }.
 */
export function resolveDoubleQuestion(team) {
  if (!team.doubleActive) return { shouldContinue: false, updatedTeam: team };

  const remainingCount = (team.doubleCount || 0) - 1;
  if (remainingCount > 0) {
    return {
      shouldContinue: true,
      updatedTeam: { ...team, doubleCount: remainingCount },
      logMessage: `\u2753 Question multiple ! Encore ${remainingCount} question(s)...`,
    };
  }
  return {
    shouldContinue: false,
    updatedTeam: { ...team, doubleActive: false, doubleCount: 0, doubleNoBonus: false },
  };
}

/**
 * Consume a power charge (free to use, charges are bought in the shop).
 * Returns { updatedTeam } or null if no charges left.
 */
export function consumePowerCharge(team, powerKey) {
  const charges = team.powers?.[powerKey]?.charges ?? 0;
  if (charges <= 0) return null;

  const power = POWERS[powerKey];
  if (!power) return null;

  const newPowers = { ...team.powers, [powerKey]: { ...team.powers[powerKey], charges: charges - 1 } };
  return { updatedTeam: { ...team, powers: newPowers } };
}
