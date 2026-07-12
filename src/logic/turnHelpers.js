import { POWERS, addCharge } from '../data/powers.js';
import { SUBJECT_KEYS } from '../data/subjects.js';
import { moveBack, moveForward } from './pathfinding.js';
import { getEffectValue, hasBuff } from './itemEffects.js';
import { resolvePowerEffect } from './powerEffects.js';
import { aegisReduction } from './forgeEffects.js';
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
 * Durée (en secondes) du timer d'une question, à partir des champs de
 * `showQuestion`. MÊME formule que l'affichage (QuestionModal) et que le calcul
 * de gain (answerQuestion) : base 30 s ÷ diviseur Sablier + bonus d'équipement,
 * ou chrono partagé de rafale (Double L5), plafonnée par Sablier brisé.
 * Source unique pour poser `showQuestion.deadline` (askQuestion, reroll).
 */
export function questionDuration(sq) {
  if (!sq) return 30;
  const divisor = sq.timerDivisor || (sq.timerHalved ? 2 : 1);
  const base = sq.sharedStart != null
    ? Math.max(1, sq.sharedStart)
    : Math.floor(30 / divisor) + (sq.itemBonusTime || 0);
  return Math.min(sq.timerCap || Infinity, base);
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

  // 0. Buff \u00ab pas de recul \u00bb (effet de dur\u00e9e d'un consommable) \u2014 priorit\u00e9 absolue.
  if (recul > 0 && hasBuff(team, 'noRecul')) {
    detail.push({ label: tg('log.turn.detail.effetDuree'), note: tg('log.turn.detail.pasDeRecul') });
    detail.push({ label: tg('log.turn.detail.reculSubi'), note: cases(0) });
    return { patch, applied: 0, path: null, detail, absorbedBy: 'buff', bonusMoney: 0 };
  }

  // Effet de bouclier (Maitrise) resolu en amont : la Forteresse court-circuite le
  // bouclier de bois (sinon le bois rognerait l'avance et serait gaspille pour rien).
  const bEff = team.powers?.bouclier ? resolvePowerEffect(team, 'bouclier', masteryOn) : {};

  // 1. Bouclier de bois (consommable) \u2014 RETIRE 1 case par charge, EN PREMIER.
  //    Saute sous Forteresse (qui annule deja tout recul et fait avancer).
  const wooden = team.itemShield || 0;
  if (wooden > 0 && recul > 0 && !bEff.fortressAdvance) {
    const used = Math.min(wooden, recul);
    recul -= used;
    patch.itemShield = wooden - used;
    detail.push({ label: tg('log.turn.detail.bouclierBois'), note: `\u2212${cases(used)}` });
    shield = 'wooden';
  }

  // 2. Pouvoir Bouclier \u2014 RETIRE `amount` cases (1 charge), SEULEMENT si recul restant.
  const charges = team.powers?.bouclier?.charges ?? 0;
  // Egide (effet de face Forge) armee ce tour : reduction de recul (0 si aucune).
  const aegis = aegisReduction(team, recul);
  // Reduction "classe bouclier" du POUVOIR : active (avec charge) sinon passive.
  const powerAmt = charges > 0 ? (bEff.amount ?? 0) : (bEff.passiveReduce ?? 0);
  let advance = 0;      // cases gagnees (Sur-reduction / Forteresse)
  let pushAmount = 0;   // surplus a infliger aux adversaires (Sur-reduction)
  let pushMode = null;  // 'one' | 'all'
  if (recul > 0 && bEff.fortressAdvance) {
    // Forteresse (L10) : le recul devient une avance du montant evite (sans charge).
    advance += recul;
    detail.push({ label: tg('log.turn.detail.bouclierNiv', { level: team.powers.bouclier.level ?? 10 }), note: tg('log.turn.detail.forteresse') });
    // Le bouclier \u00ab est utilise \u00bb (il absorbe tout) \u2192 verse l'or du palier + Rempart dore.
    bonusMoney = (bEff.bonusMoney ?? 0) + (bEff.goldOnUse || 0);
    if (bonusMoney) { patch.money = (team.money || 0) + bonusMoney; detail.push({ label: tg('log.turn.detail.bonusBouclier'), amount: bonusMoney }); }
    recul = 0;
    shield = 'power';
  } else if (recul > 0 && aegis > 0 && aegis >= powerAmt) {
    // Egide >= reduction du Bouclier : on prend la MEILLEURE des deux (jamais la
    // somme, spec 6.3). Egide est gratuite -> on garde la charge du pouvoir.
    recul = Math.max(0, recul - aegis);
    detail.push({ label: tg('log.turn.detail.egide'), note: `−${cases(aegis)}` });
    shield = 'power';
  } else if (charges > 0 && recul > 0) {
    const level = team.powers.bouclier.level ?? 1;
    const reduction = bEff.amount ?? 0;
    const surplus = Math.max(0, reduction - recul); // reduction non utilisee
    recul = Math.max(0, recul - reduction);
    patch.powers = { ...team.powers, bouclier: { ...team.powers.bouclier, charges: charges - 1 } };
    detail.push({ label: tg('log.turn.detail.bouclierNiv', { level }), note: `\u2212${cases(reduction)}` });
    // Or : bonus de palier + Rempart dor\u00e9 (or/case absorb\u00e9e) + Tr\u00e9sor de guerre (forfait).
    bonusMoney = (bEff.bonusMoney ?? 0) + (bEff.goldOnUse || 0);
    if (bonusMoney) { patch.money = (team.money || 0) + bonusMoney; detail.push({ label: tg('log.turn.detail.bonusBouclier'), amount: bonusMoney }); }
    // Sur-reduction : le surplus de reduction fait avancer (et peut pousser des adversaires).
    if (bEff.surplusAdvance && surplus > 0) {
      advance += surplus;
      if (bEff.surplusPush) { pushAmount = surplus; pushMode = bEff.surplusPush; }
    }
    shield = 'power';
  } else if (recul > 0 && bEff.passiveReduce) {
    // Passif (L3+) : reduction permanente SANS charge (non cumulative avec l'active).
    recul = Math.max(0, recul - bEff.passiveReduce);
    detail.push({ label: tg('log.turn.detail.bouclierPassif'), note: `−${cases(bEff.passiveReduce)}` });
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

  const reduced = shield || recul !== base || advance > 0; // d\u00e9tail utile si on a r\u00e9duit/avanc\u00e9
  const out = { patch, detail: reduced ? detail : undefined, bonusMoney, surplusPush: pushMode, pushAmount };
  // Sur-r\u00e9duction / Forteresse : le recul est nul ET on gagne des cases \u2192 on AVANCE.
  if (recul <= 0 && advance > 0) {
    const fwd = moveForward(board, team.pos, advance, { throughJunctions: true });
    patch.pos = fwd.finalPos;
    detail.push({ label: tg('log.turn.detail.avance'), note: `+${cases(advance)}` });
    return { ...out, applied: 0, advance, path: fwd.path, forward: true, absorbedBy: shield || 'power' };
  }
  if (recul <= 0) return { ...out, applied: 0, advance: 0, path: null, absorbedBy: shield || 'equip' };
  const { finalPos, path } = moveBack(board, team.pos, recul);
  const applied = recul;
  // Le point de contrôle n'agit PAS comme une barrière au recul : on recule
  // normalement (il reste posé pour un TP manuel au tour suivant, cf.
  // teleportToCheckpoint dans gameStore).
  patch.pos = finalPos;
  return { ...out, applied, advance: 0, path, absorbedBy: shield };
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
  } else if (r.forward) {
    // Sur-réduction / Forteresse : le recul est devenu une avance.
    logMessage = tg('log.turn.wrong.forward', { reason, cases: cases(r.advance), coins });
  } else if (r.applied <= 0) {
    logMessage = tg('log.turn.wrong.equip', { reason });
  } else if (r.absorbedBy === 'wooden' || r.absorbedBy === 'power') {
    logMessage = tg('log.turn.wrong.reduced', { reason, cases: cases(r.applied), coins });
  } else {
    logMessage = tg('log.turn.wrong.normal', { reason, cases: cases(r.applied) });
  }
  return { updatedTeam, logMessage, detail: r.detail, path: r.path, forward: r.forward, advance: r.advance, surplusPush: r.surplusPush, pushAmount: r.pushAmount };
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
