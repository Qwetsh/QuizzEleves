import { POWERS } from '../data/powers.js';
import { SUBJECT_KEYS } from '../data/subjects.js';
import { moveBack } from './pathfinding.js';
import { reducedRecul, hasBuff } from './itemEffects.js';

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
export function resolveWrongAnswer(team, board, reason = 'Mauvaise r\u00e9ponse', reculBase = 2) {
  // 0. Buff \u00ab pas de recul \u00bb (effet de dur\u00e9e d'un consommable) \u2014 priorit\u00e9 absolue.
  if (hasBuff(team, 'noRecul')) {
    return {
      updatedTeam: { ...team, wrong: team.wrong + 1 },
      logMessage: `\u274c ${reason} ! \u{1F6DF} Prot\u00e9g\u00e9 (effet de dur\u00e9e) : pas de recul !`,
    };
  }

  // 1. Consommable Bouclier de bois (one-shot) avant le pouvoir Bouclier
  const itemShield = team.itemShield || 0;
  if (itemShield > 0) {
    return {
      updatedTeam: { ...team, wrong: team.wrong + 1, itemShield: itemShield - 1 },
      logMessage: `\u274C ${reason} ! \u{1FAB5} Bouclier de bois consomm\u00e9 : pas de recul !`,
    };
  }

  // 2. Pouvoir Bouclier \u2014 RETIRE `amount` cases au recul (selon le niveau,
  //    lu depuis powers.js) ; l'\u00e9quipement (reculReduction) r\u00e9duit ensuite.
  const bouclierCharges = team.powers?.bouclier?.charges ?? 0;
  if (bouclierCharges > 0) {
    const level = team.powers.bouclier.level ?? 1;
    const effect = POWERS.bouclier.levels[level - 1]?.effect || {};
    const reduction = effect.amount ?? 0;
    const bonusMoney = effect.bonusMoney ?? 0;
    const newPowers = { ...team.powers, bouclier: { ...team.powers.bouclier, charges: bouclierCharges - 1 } };
    const shielded = { ...team, wrong: team.wrong + 1, powers: newPowers, money: team.money + bonusMoney };
    const reculAmount = reducedRecul(team, Math.max(0, reculBase - reduction));
    const coins = bonusMoney ? ` +${bonusMoney} \u{1F4B0}` : '';
    if (reculAmount <= 0) {
      return { updatedTeam: shielded, logMessage: `\u274C ${reason} ! \u{1F6E1}\uFE0F Bouclier (niv.${level}) : recul totalement absorb\u00e9 !${coins}` };
    }
    const { finalPos, path } = moveBack(board, team.pos, reculAmount);
    return {
      updatedTeam: { ...shielded, pos: finalPos },
      logMessage: `\u274C ${reason} ! \u{1F6E1}\uFE0F Bouclier (niv.${level}) : recul r\u00e9duit \u00E0 ${reculAmount} case${reculAmount > 1 ? 's' : ''}.${coins}`,
      path,
    };
  }

  // 3. Recul de base (= valeur du d\u00e9), r\u00e9duit par l'equipement (reculReduction)
  const reculAmount = reducedRecul(team, reculBase);
  if (reculAmount <= 0) {
    return {
      updatedTeam: { ...team, wrong: team.wrong + 1 },
      logMessage: `\u274C ${reason} ! \u{1F392} L'\u00e9quipement absorbe le recul !`,
    };
  }
  const { finalPos, path } = moveBack(board, team.pos, reculAmount);
  return {
    updatedTeam: { ...team, wrong: team.wrong + 1, pos: finalPos },
    logMessage: `\u274C ${reason} ! Recul de ${reculAmount} case${reculAmount > 1 ? 's' : ''}.`,
    path,
  };
}

/**
 * Champs a nettoyer en fin de rafale Double (reussie, ratee ou timeout).
 * Partage entre gameStore (answerQuestion/timeoutQuestion) et
 * resolveDoubleQuestion pour que les 3 chemins de teardown restent identiques.
 */
export const BURST_RESET = {
  doubleActive: false,
  doubleExtra: 0,
  doubleTotal: 0,
  doubleAsked: 0,
  doubleNoBonus: false,
  doubleTimerDivisor: undefined,
  sablierActif: false,
  sablierDivisor: undefined,
};

/**
 * Handle multi-question continuation (Double cumulable).
 * `doubleExtra` = nombre de questions EXTRA encore a poser apres celle qu'on
 * vient de resoudre. Tant qu'il en reste, on enchaine et on decremente ;
 * sinon on solde la rafale (BURST_RESET).
 * Returns { shouldContinue, updatedTeam, logMessage } or { shouldContinue: false }.
 */
export function resolveDoubleQuestion(team) {
  if (!team.doubleActive) return { shouldContinue: false, updatedTeam: team };

  const remainingExtra = team.doubleExtra || 0;
  if (remainingExtra > 0) {
    return {
      shouldContinue: true,
      updatedTeam: { ...team, doubleExtra: remainingExtra - 1 },
      logMessage: `\u2753 Question multiple ! Encore ${remainingExtra} question(s)...`,
    };
  }
  return {
    shouldContinue: false,
    updatedTeam: { ...team, ...BURST_RESET },
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
