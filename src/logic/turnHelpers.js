import { POWERS, addCharge } from '../data/powers.js';
import { SUBJECT_KEYS } from '../data/subjects.js';
import { moveBack } from './pathfinding.js';
import { getEffectValue, hasBuff } from './itemEffects.js';
import { resolvePowerEffect } from './powerEffects.js';
import { tg, tgPlural } from '../i18n';
import { getLang } from '../i18n/lang.js';
import { locName } from '../i18n/content.js';

const cases = (n) => (getLang() === 'en'
  ? `${n} space${Math.abs(n) > 1 ? 's' : ''}`
  : `${n} case${Math.abs(n) > 1 ? 's' : ''}`);

/**
 * Pick a random subject key.
 */
export function randomSubject() {
  return SUBJECT_KEYS[Math.floor(Math.random() * SUBJECT_KEYS.length)];
}

/**
 * Applique TOUTE la cha\u00eene de r\u00e9duction de recul \u00E0 un recul de `base` cases,
 * puis d\u00e9place l'\u00e9quipe. Ordre :
 *   0. buff \u00ab noRecul \u00bb (effet de dur\u00e9e)         \u2014 annule tout
 *   1. Bouclier de bois (consommable)            \u2014 \u22121 case par charge, EN PREMIER
 *   2. pouvoir Bouclier (1 charge)               \u2014 \u2212amount cases, SEULEMENT si recul restant
 *   3. \u00e9quipement (reculReductionPct puis reculReduction)
 *
 * Source unique de v\u00e9rit\u00e9 pour TOUS les reculs (mauvaise r\u00e9ponse, \u00e9v\u00e9nements,
 * consommables, pi\u00e8ges, duels). SEULE exception : la Foudre (attaque offensive)
 * qui n'est att\u00e9nu\u00e9e que par l'\u00e9quipement (reducedRecul) et ne passe pas ici.
 *
 * Renvoie { patch, applied, path, detail, absorbedBy, bonusMoney } :
 *  - patch      : champs \u00E0 fusionner dans l'\u00e9quipe (itemShield, powers, money, pos)
 *  - applied    : nombre de cases effectivement recul\u00e9es
 *  - path        : trajet d'animation (ou null)
 *  - detail      : lignes du journal d\u00e9pliable (undefined si recul inchang\u00e9)
 *  - absorbedBy  : 'buff' | 'wooden' | 'power' | 'equip' | null (bouclier le plus fort)
 *  - bonusMoney  : or gagn\u00e9 via le Bouclier niv.3
 */
export function applyRecul(team, board, base, masteryOn = false) {
  const detail = [{ label: tg('log.turn.detail.reculPrevu'), note: cases(base) }];
  const patch = {};
  let recul = base;
  let shield = null; // 'wooden' | 'power'
  let bonusMoney = 0;
  let reflectOut = 0; // Réflexion (Bouclier L10) : cases renvoyées à l'attaquant (duel)

  // 0. Buff \u00ab pas de recul \u00bb (effet de dur\u00e9e d'un consommable) \u2014 priorit\u00e9 absolue.
  if (recul > 0 && hasBuff(team, 'noRecul')) {
    detail.push({ label: tg('log.turn.detail.effetDuree'), note: tg('log.turn.detail.pasDeRecul') });
    detail.push({ label: tg('log.turn.detail.reculSubi'), note: cases(0) });
    return { patch, applied: 0, path: null, detail, absorbedBy: 'buff', bonusMoney: 0 };
  }

  // 1. Bouclier de bois (consommable) \u2014 RETIRE 1 case par charge, EN PREMIER.
  const wooden = team.itemShield || 0;
  if (wooden > 0 && recul > 0) {
    const used = Math.min(wooden, recul);
    recul -= used;
    patch.itemShield = wooden - used;
    detail.push({ label: tg('log.turn.detail.bouclierBois'), note: `\u2212${cases(used)}` });
    shield = 'wooden';
  }

  // 2. Pouvoir Bouclier \u2014 RETIRE `amount` cases (1 charge), SEULEMENT si recul restant.
  const charges = team.powers?.bouclier?.charges ?? 0;
  if (charges > 0 && recul > 0) {
    const level = team.powers.bouclier.level ?? 1;
    const effect = resolvePowerEffect(team, 'bouclier', masteryOn);
    const reduction = effect.amount ?? 0;
    const absorbed = Math.min(recul, reduction); // cases r\u00e9ellement absorb\u00e9es par le pouvoir
    recul = Math.max(0, recul - reduction);
    patch.powers = { ...team.powers, bouclier: { ...team.powers.bouclier, charges: charges - 1 } };
    detail.push({ label: tg('log.turn.detail.bouclierNiv', { level }), note: `\u2212${cases(reduction)}` });
    // Or : bonus de palier + Rempart dor\u00e9 (or/case absorb\u00e9e) + Tr\u00e9sor de guerre (forfait).
    bonusMoney = (effect.bonusMoney ?? 0) + (effect.goldPerCaseAbsorbed || 0) * absorbed + (effect.absorbBonusMoney || 0);
    if (bonusMoney) { patch.money = (team.money || 0) + bonusMoney; detail.push({ label: tg('log.turn.detail.bonusBouclier'), amount: bonusMoney }); }
    // Trésor de guerre (L10) : +1 charge d'un pouvoir au hasard à chaque absorption.
    if (effect.absorbBonusCharge) {
      const baseP = patch.powers;
      const keys = Object.keys(baseP).filter((k) => POWERS[k]);
      if (keys.length) {
        const pick = keys[Math.floor(Math.random() * keys.length)];
        patch.powers = { ...baseP, [pick]: { ...baseP[pick], charges: addCharge(baseP[pick].charges) } };
        detail.push({ label: tg('log.turn.detail.tresorGuerre'), note: tg('log.turn.detail.chargePlus', { power: locName(POWERS[pick]) }) });
      }
    }
    // Réflexion (L10) : une fraction du recul prévu est renvoyée à l'attaquant (géré par l'appelant, ex. duel).
    if (effect.reflectFraction) reflectOut = Math.round(base * effect.reflectFraction);
    shield = 'power';
  }

  // 3. \u00c9quipement : % puis cases forfaitaires.
  const pct = Math.min(100, getEffectValue(team, 'reculReductionPct'));
  const flat = getEffectValue(team, 'reculReduction');
  if (recul > 0 && (pct > 0 || flat > 0)) {
    recul = Math.max(0, Math.round(pct > 0 ? recul * (1 - pct / 100) : recul) - flat);
    if (pct > 0) detail.push({ label: tg('log.turn.detail.equipement'), note: `\u2212${pct}%` });
    if (flat > 0) detail.push({ label: tg('log.turn.detail.equipement'), note: `\u2212${cases(flat)}` });
  }
  detail.push({ label: tg('log.turn.detail.reculSubi'), note: cases(recul) });

  const reduced = shield || recul !== base; // un d\u00e9tail n'a d'int\u00e9r\u00eat que si on a r\u00e9duit
  const out = { patch, detail: reduced ? detail : undefined, bonusMoney, reflect: reflectOut };
  if (recul <= 0) return { ...out, applied: 0, path: null, absorbedBy: shield || 'equip' };
  const { finalPos, path } = moveBack(board, team.pos, recul);
  patch.pos = finalPos;
  return { ...out, applied: recul, path, absorbedBy: shield };
}

/**
 * Resolve a wrong answer: applique la cha\u00eene de bouclier (applyRecul) et compose
 * le message de journal. Returns { updatedTeam, logMessage, detail, path }.
 */
export function resolveWrongAnswer(team, board, reason = tg('log.turn.reasonWrong'), reculBase = 2, masteryOn = false) {
  const r = applyRecul(team, board, reculBase, masteryOn);
  const updatedTeam = { ...team, ...r.patch, wrong: team.wrong + 1 };
  const coins = r.bonusMoney ? ` +${r.bonusMoney} \u{1F4B0}` : '';
  let logMessage;
  if (r.absorbedBy === 'buff') {
    logMessage = tg('log.turn.wrong.buff', { reason });
  } else if (r.applied <= 0 && (r.absorbedBy === 'wooden' || r.absorbedBy === 'power')) {
    logMessage = tg('log.turn.wrong.absorbed', { reason, coins });
  } else if (r.applied <= 0) {
    logMessage = tg('log.turn.wrong.equip', { reason });
  } else if (r.absorbedBy === 'wooden' || r.absorbedBy === 'power') {
    logMessage = tg('log.turn.wrong.reduced', { reason, cases: cases(r.applied), coins });
  } else {
    logMessage = tg('log.turn.wrong.normal', { reason, cases: cases(r.applied) });
  }
  return { updatedTeam, logMessage, detail: r.detail, path: r.path };
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
  doubleGoldFactor: undefined,
  doubleAllOrNothing: false,
  doubleBank: undefined,
  doubleReflectTo: undefined,
  doubleSharedTimer: false,
  burstTimeLeft: undefined,
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
      logMessage: tgPlural('log.turn.multiQuestion', remainingExtra, { n: remainingExtra }),
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
