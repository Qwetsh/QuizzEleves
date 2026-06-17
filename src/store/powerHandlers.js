import { POWERS } from '../data/powers.js';
import { moveBack } from '../logic/pathfinding.js';
import { consumePowerCharge } from '../logic/turnHelpers.js';
import { reducedRecul, resolveAmount, diceLabel, moveDieSides } from '../logic/itemEffects.js';
import { resolvePowerEffect, maxPowerLevel, powerUpgradeCost, specSlotForLevel, specOptionsFor } from '../logic/powerEffects.js';
import { extOn } from '../extensions/registry.js';
import { saveGame } from './persistence.js';
import { soundThunder, soundPower, soundDice, soundCharge } from '../logic/sounds.js';
import { resumeQueue as resumeEngineQueue, announce } from './effectEngine.js';

// Plafond de questions extra accumulables par le Double (total rafale = 1 + MAX_EXTRA)
const MAX_DOUBLE_EXTRA = 4;

// L'extension « Maîtrise » est-elle active ? (pouvoirs L1→10 + branches)
const masteryActive = (get) => extOn(get().extensions, 'mastery');

// Effet EFFECTIF du pouvoir d'une équipe (cœur + branches si Maîtrise active).
// Remplace l'ancien levelEffect : seule source de vérité = resolvePowerEffect.
function powerEffectOf(get, team, powerKey) {
  return resolvePowerEffect(team, powerKey, masteryActive(get));
}

// --- Power usage ---

export function usePower(set, get, powerKey) {
  const { teams, currentTeam, rolling, finished, showQuestion, showEvent, awaitingChoice, diceValue, pendingLanding } = get();
  const team = teams[currentTeam];
  // Silence (Sablier L5) : aucun pouvoir ce tour-ci.
  if (team.silencedNextTurn) {
    get().addLog(`🔇 ${team.emoji} ${team.name} est réduit au silence : aucun pouvoir ce tour-ci.`);
    return;
  }
  const charges = team.powers?.[powerKey]?.charges ?? 0;
  if (charges <= 0) return;

  const power = POWERS[powerKey];
  if (!power) return;

  // Relance : traitée AVANT le garde général car elle est aussi permise pendant
  // un choix de jonction (awaitingChoice), où les autres pouvoirs sont bloqués.
  if (powerKey === 'relance') {
    if (!diceValue || showQuestion || rolling || showEvent || finished || !(pendingLanding || awaitingChoice)) return;
    useRelance(set, get);
    return;
  }

  if (finished || rolling || showEvent || awaitingChoice) return;

  if (powerKey === 'indice') {
    if (!showQuestion || get().indiceUsed) return;
    useIndice(set, get);
    return;
  }

  if (power.category === 'off') {
    if (showQuestion) return;
    if (diceValue && !pendingLanding) return;
    set({ showTargetPicker: { powerKey } });
    return;
  }
}

export function useIndice(set, get) {
  const { teams, currentTeam, showQuestion, addLog } = get();
  const team = teams[currentTeam];
  const question = showQuestion?.question;
  if (!question) return;

  const level = team.powers?.indice?.level ?? 1;
  const effect = powerEffectOf(get, team, 'indice');

  const wrongIndices = question.a
    .map((_, i) => i)
    .filter((i) => i !== question.c);
  for (let i = wrongIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [wrongIndices[i], wrongIndices[j]] = [wrongIndices[j], wrongIndices[i]];
  }
  // L'equipement (indiceBoost) elimine deja passivement des reponses a l'ouverture
  // de la question : le pouvoir ajoute SES eliminations par-dessus (sans re-tirer
  // le boost), pour ne pas masquer deux fois la meme reponse.
  const already = get().indiceHidden || [];
  const fresh = wrongIndices.filter((i) => !already.includes(i));
  // count (cœur) + extraHide (branche Clairvoyance, Maîtrise).
  const want = (effect.count ?? 2) + (effect.extraHide || 0);
  const hideMore = Math.min(want, fresh.length);
  const hidden = [...already, ...fresh.slice(0, hideMore)];

  // Rien \u00e0 \u00e9liminer en plus (\u00e9quipement a d\u00e9j\u00e0 tout masqu\u00e9) ET pas de bonus de
  // temps : on NE consomme PAS la charge (sinon perte s\u00e8che).
  if (hideMore === 0 && !(effect.bonusTime > 0)) {
    addLog(`\u{1F4A1} ${team.emoji} ${team.name} : toutes les mauvaises r\u00e9ponses sont d\u00e9j\u00e0 \u00e9limin\u00e9es.`);
    return;
  }

  const result = consumePowerCharge(team, 'indice');
  if (!result) return;

  const newTeams = [...teams];
  newTeams[currentTeam] = result.updatedTeam;

  addLog(`\u{1F4A1} ${team.emoji} ${team.name} utilise Indice (niv.${level}) ! ${hideMore} r\u00e9ponse${hideMore > 1 ? 's' : ''} \u00e9limin\u00e9e${hideMore > 1 ? 's' : ''}${effect.bonusTime > 0 ? ` (+${effect.bonusTime}s)` : ''}.`);
  set({ teams: newTeams, indiceUsed: true, indiceHidden: hidden });
  announce(set, get, '💡', `Indice — ${hideMore} réponse${hideMore > 1 ? 's' : ''} éliminée${hideMore > 1 ? 's' : ''}${effect.bonusTime > 0 ? ` (+${effect.bonusTime}s)` : ''}`, POWERS.indice?.color || '#e8b117');

  if (effect.bonusTime > 0) {
    set({ showQuestion: { ...get().showQuestion, bonusTime: effect.bonusTime } });
  }
}

export function useRelance(set, get) {
  const { teams, currentTeam, addLog, preRollPos, preRollValue } = get();
  const team = teams[currentTeam];
  const level = team.powers?.relance?.level ?? 1;
  const prevValue = preRollValue || 0;

  const result = consumePowerCharge(team, 'relance');
  if (!result) return;

  const newTeams = [...teams];
  newTeams[currentTeam] = { ...result.updatedTeam, pos: preRollPos || team.pos };

  addLog(`\u{1F3B2} ${team.emoji} ${team.name} utilise Relance (niv.${level}) !`);
  soundDice();
  announce(set, get, '🎲', `${team.emoji} ${team.name} relance le dé !`, POWERS.relance?.color || '#e8b117');
  // Nettoie aussi un éventuel choix de jonction en cours (on relance depuis le départ du lancer).
  set({ teams: newTeams, diceValue: null, rolling: true, pendingLanding: false, awaitingChoice: false, pendingMove: null });

  // Mêmes faces que le dé de mouvement de l'équipe (D4/D6/D10).
  const sides = moveDieSides(team);
  const rEff = powerEffectOf(get, team, 'relance');
  // Triple chance : meilleur de N dés. Dé chanceux : relance jusqu'à atteindre minRoll.
  let roll = Math.floor(Math.random() * sides) + 1;
  for (let k = 1; k < (rEff.rerollCount || 1); k++) roll = Math.max(roll, Math.floor(Math.random() * sides) + 1);
  if (rEff.minRoll) { let tries = 0; while (roll < rEff.minRoll && tries < 30) { roll = Math.floor(Math.random() * sides) + 1; tries++; } }
  const finalValue = roll;
  let count = 0;
  const interval = setInterval(() => {
    set({ diceValue: Math.floor(Math.random() * sides) + 1 });
    count++;
    if (count >= 10) {
      clearInterval(interval);
      set({ diceValue: finalValue, rolling: false });

      const mode = rEff.mode || 'replace';
      let effectiveValue;
      if (mode === 'sum') effectiveValue = prevValue + finalValue;
      else if (mode === 'best') effectiveValue = Math.max(prevValue, finalValue);
      else effectiveValue = finalValue;

      addLog(`\u{1F3B2} Relance : ${finalValue} !${mode !== 'replace' ? ` (effectif: ${effectiveValue})` : ''}`);
      // Surcharge (L10) : recharge un pouvoir au hasard parmi ceux possédés.
      if (rEff.rechargeRandom) {
        const t = get().teams[currentTeam];
        const keys = Object.keys(t.powers || {}).filter((k) => POWERS[k]);
        if (keys.length) {
          const pick = keys[Math.floor(Math.random() * keys.length)];
          const nt = [...get().teams];
          nt[currentTeam] = { ...t, powers: { ...t.powers, [pick]: { ...t.powers[pick], charges: (t.powers[pick].charges ?? 0) + 1 } } };
          set({ teams: nt });
          addLog(`✨ Surcharge : +1 charge de ${POWERS[pick].name} !`);
        }
      }
      // skipOnRoll : ne pas re-déclencher le bonus on:roll de l'équipement (déjà
      // accordé au lancer initial) → pas de double bonus via la Relance.
      get().handleDiceResult(effectiveValue, { skipOnRoll: true });
    }
  }, 80);
}

export function applyOffensivePower(set, get, targetTeamIndex) {
  const { teams, currentTeam, board, showTargetPicker, addLog } = get();
  if (!showTargetPicker) return;
  const { powerKey } = showTargetPicker;
  const team = teams[currentTeam];
  const target = teams[targetTeamIndex];
  if (!target) return;
  const newTeams = [...teams];

  const result = consumePowerCharge(team, powerKey);
  if (!result) return;
  newTeams[currentTeam] = result.updatedTeam;

  // Consommable Bombe fumigene : la cible annule le pouvoir offensif
  // (la charge de l'attaquant est quand meme consommee — le coup est esquive)
  if (target.itemFumigene) {
    newTeams[targetTeamIndex] = { ...target, itemFumigene: false, itemFumigeneTurns: undefined };
    addLog(`\u{1F4A8} La bombe fumigène de ${target.emoji} ${target.name} annule ${POWERS[powerKey].name} !`);
    set({ teams: newTeams, showTargetPicker: null });
    announce(set, get, '💨', `${target.emoji} Contré par le fumigène !`, '#7a8a99');
    return;
  }

  const level = team.powers?.[powerKey]?.level ?? 1;
  const effect = powerEffectOf(get, team, powerKey);
  let foudreMove = null;
  let lightning = false;

  if (powerKey === 'foudre') {
    // Recul de la/les cible(s), atténué par leur équipement et leur Bouclier (Égide).
    const masteryOn = masteryActive(get);
    // Surcharge (L5) : consomme 1 charge de Foudre suppl\u00E9mentaire.
    if (effect.extraChargeCost) {
      const extra = consumePowerCharge(newTeams[currentTeam], 'foudre');
      if (extra) newTeams[currentTeam] = extra.updatedTeam;
    }
    const baseRoll = Math.round((resolveAmount(effect.amount ?? 'd4', target) + (effect.flat || 0)) * (effect.amountMult || 1));
    const dieLabel = diceLabel(effect.amount ?? 'd4') + (effect.flat ? ` +${effect.flat}` : '') + (effect.amountMult ? ` \u00D7${effect.amountMult}` : '');

    // Cibles : la choisie + (Cataclysme) tous les adversaires + (Cha\u00EEne) la mieux plac\u00E9e.
    const opponents = newTeams.map((_, i) => i).filter((i) => i !== currentTeam);
    const targets = new Set([targetTeamIndex]);
    if (effect.allOthers) opponents.forEach((i) => targets.add(i));
    if (effect.chain && opponents.length) {
      let best = opponents[0], bestX = -Infinity;
      for (const i of opponents) { const x = board[newTeams[i].pos]?.x ?? -Infinity; if (x > bestX) { bestX = x; best = i; } }
      targets.add(best);
    }

    const moves = [];
    let reflectTotal = 0, stolenTotal = 0;
    for (const ti of targets) {
      let v = newTeams[ti];
      let rolled = baseRoll;
      const vEff = resolvePowerEffect(v, 'bouclier', masteryOn);
      const vCharges = v.powers?.bouclier?.charges ?? 0;
      // \u00C9gide (cible) : le bouclier prot\u00E8ge de la Foudre (consomme 1 charge).
      if (vEff.protectFoudre && vCharges > 0) {
        rolled = Math.max(0, rolled - (vEff.amount ?? 0));
        v = { ...v, powers: { ...v.powers, bouclier: { ...v.powers.bouclier, charges: vCharges - 1 } } };
      }
      // R\u00E9flexion (cible) : une fraction du recul pr\u00E9vu revient \u00E0 l'attaquant.
      if (vEff.reflectFraction && vCharges > 0) reflectTotal += Math.round(rolled * vEff.reflectFraction);
      // Temp\u00EAte cibl\u00E9e : vol d'or.
      if (effect.stealGold) { const s = Math.min(effect.stealGold, v.money || 0); v = { ...v, money: (v.money || 0) - s }; stolenTotal += s; }
      const amt = reducedRecul(v, rolled);
      const rr = moveBack(board, v.pos, amt);
      newTeams[ti] = { ...v, pos: rr.finalPos };
      if (rr.path.length > 1) moves.push({ teamIndex: ti, waypoints: rr.path.map((id) => ({ x: board[id].x, y: board[id].y })), type: 'back' });
    }
    if (stolenTotal > 0) newTeams[currentTeam] = { ...newTeams[currentTeam], money: (newTeams[currentTeam].money || 0) + stolenTotal };
    if (reflectTotal > 0) {
      const amt = reducedRecul(newTeams[currentTeam], reflectTotal);
      const rr = moveBack(board, newTeams[currentTeam].pos, amt);
      newTeams[currentTeam] = { ...newTeams[currentTeam], pos: rr.finalPos };
      if (rr.path.length > 1) moves.push({ teamIndex: currentTeam, waypoints: rr.path.map((id) => ({ x: board[id].x, y: board[id].y })), type: 'back' });
    }
    foudreMove = moves.length ? moves : null;
    lightning = true;
    soundThunder();
    const nT = targets.size;
    addLog(`\u26A1 ${team.emoji} ${team.name} utilise Foudre (niv.${level}, ${dieLabel})${nT > 1 ? ` sur ${nT} \u00E9quipes` : ` sur ${target.emoji} ${target.name}`} !${stolenTotal ? ` Vol de ${stolenTotal} or.` : ''}${reflectTotal ? ' \u21A9\uFE0F Recul r\u00E9fl\u00E9chi !' : ''}`);
    announce(set, get, '⚡', `Foudre ${dieLabel}${nT > 1 ? ` ×${nT}` : ` sur ${target.emoji} ${target.name}`}`, POWERS[powerKey].color);
  } else if (powerKey === 'sablier') {
    const divisor = effect.divisor ?? 2;
    // Tempête de sable (L10) : toutes les autres équipes ; sinon la cible choisie.
    const sablierOpp = newTeams.map((_, i) => i).filter((i) => i !== currentTeam);
    const sablierTargets = effect.allOthers ? new Set(sablierOpp) : new Set([targetTeamIndex]);
    for (const ti of sablierTargets) {
      newTeams[ti] = {
        ...newTeams[ti],
        sablierActif: true, sablierDivisor: divisor,
        ...(effect.silenceNextTurn ? { silencedNextTurn: true } : {}),
        ...(effect.skipNextRoll ? { skipNextRoll: true } : {}),
        ...(effect.goldPenaltyOnTimeout ? { timeoutPenalty: effect.goldPenaltyOnTimeout } : {}),
      };
    }
    const nS = sablierTargets.size;
    soundPower();
    const extrasS = `${effect.silenceNextTurn ? ' \u00B7 \uD83D\uDD07 Silence' : ''}${effect.skipNextRoll ? ' \u00B7 \uD83E\uDDCA Gel du lancer' : ''}${effect.goldPenaltyOnTimeout ? ` \u00B7 \uD83D\uDCB8 Taxe ${effect.goldPenaltyOnTimeout}` : ''}`;
    addLog(`\u23F1\uFE0F ${team.emoji} ${team.name} utilise Sablier (niv.${level})${nS > 1 ? ` sur ${nS} \u00E9quipes` : ` sur ${target.emoji} ${target.name}`} ! Timer /${divisor}${extrasS}.`);
    announce(set, get, '⏱️', `Sablier /${divisor}${nS > 1 ? ` ×${nS}` : ` sur ${target.emoji} ${target.name}`}`, POWERS[powerKey].color);
  } else if (powerKey === 'double') {
    // Cumulable : on AJOUTE des questions extra (plafonnees), sans ecraser un cast precedent.
    // extraAdd : questions supplémentaires des voies (Rafale tranquille / Marathon+).
    const add = (effect.add ?? 1) + (effect.extraAdd || 0);
    const newExtra = Math.min((target.doubleExtra || 0) + add, MAX_DOUBLE_EXTRA);
    // Facteur d'or de la rafale : Chrono partagé (×1.5) / Rafale tranquille (÷2).
    // Ces voies font GAGNER de l'or à la cible (avec le facteur) → on lève le « sans bonus ».
    const goldFactor = (effect.goldMult || 1) / (effect.goldDiv || 1);
    const goldFx = goldFactor !== 1 ? { doubleGoldFactor: goldFactor } : {};
    const noBonus = goldFactor !== 1 ? false : (!!effect.noBonus || !!target.doubleNoBonus); // collant
    // Niv.3 : timer reduit persistant sur la rafale — champ separe du Sablier
    // (un Sablier adverse one-shot ne doit pas heriter de cette persistance)
    const newDiv = Math.max(target.doubleTimerDivisor || 1, effect.timerDivisor || 1);
    const pressure = newDiv > 1 ? { doubleTimerDivisor: newDiv } : {};
    newTeams[targetTeamIndex] = { ...target, doubleActive: true, doubleExtra: newExtra, doubleNoBonus: noBonus, ...pressure, ...goldFx };
    soundPower();
    addLog(`\u2753 ${team.emoji} ${team.name} utilise Double (niv.${level}) sur ${target.emoji} ${target.name} ! +${add} question${add > 1 ? 's' : ''} (${1 + newExtra} au total).${noBonus ? ' (sans bonus)' : ''}${newDiv > 1 ? ` Timer /${newDiv} !` : ''}`);
    announce(set, get, '❓', `Double sur ${target.emoji} ${target.name} — ${1 + newExtra} questions`, POWERS[powerKey].color);
  }

  set({ teams: newTeams, showTargetPicker: null, ...(foudreMove ? { movePath: foudreMove } : {}) });
  if (lightning) get().emitVfx('lightning', targetTeamIndex);
  // Stay in pendingLanding so player can use more powers before clicking "Continuer"
}

export function cancelTargetPicker(set, get) {
  set({ showTargetPicker: null });
  // Stay in pendingLanding — player can use other powers or click "Continuer"
}

// --- Charge picker (gainCharge : consommable / équipement) ---

export function chargePickerChoice(set, get, powerKey) {
  const { teams, currentTeam, addLog } = get();
  // Source : 'item' (consommable legacy) ou 'engine' (moteur d'effets / équipement)
  const source = get().showChargePicker?.source;
  const team = teams[currentTeam];
  const newTeams = [...teams];
  const currentCharges = team.powers?.[powerKey]?.charges ?? 0;
  const newPowers = { ...team.powers, [powerKey]: { ...team.powers[powerKey], charges: currentCharges + 1 } };
  newTeams[currentTeam] = { ...team, powers: newPowers };
  const pName = POWERS[powerKey]?.name || powerKey;
  addLog(`\u2728 ${team.emoji} ${team.name} gagne 1 charge de ${pName} !`);
  soundCharge();
  set({ teams: newTeams, showChargePicker: false });

  // Moteur d'effets : reprendre la file après la recharge (l'action gainCharge est résolue).
  if (source === 'engine') { resumeEngineQueue(set, get, { chargeDone: true }); return; }
  // Sinon (consommable) : on a juste rechargé — le joueur poursuit son tour.
}

export function chargePickerSkip(set, get) {
  const source = get().showChargePicker?.source;
  set({ showChargePicker: false });
  // Moteur d'effets : sauter la recharge mais poursuivre la file.
  if (source === 'engine') { resumeEngineQueue(set, get, { chargeDone: true }); return; }
  // Stay in pendingLanding — player clicks "Continuer" when ready
}

// --- Shop ---

export function buyNewPower(set, get, powerKey) {
  const { teams, currentTeam, addLog } = get();
  const team = teams[currentTeam];
  const power = POWERS[powerKey];
  if (!power) return;
  const price = power.price;
  if (team.money < price) return;
  if (team.powers?.[powerKey]) return;

  const newTeams = [...teams];
  const newPowers = { ...team.powers, [powerKey]: { charges: 1, level: 1 } };
  newTeams[currentTeam] = { ...team, money: team.money - price, powers: newPowers };
  addLog(`\u{1F6D2} ${team.emoji} ${team.name} d\u00e9bloque ${power.name} ! (-${price} \u{1F4B0})`);
  set({ teams: newTeams });
  saveGame(get());
}

export function buyPowerCharge(set, get, powerKey) {
  const { teams, currentTeam, addLog } = get();
  const team = teams[currentTeam];
  // On ne recharge qu'un pouvoir D\u00c9J\u00c0 poss\u00e9d\u00e9 (\u00e9vite une entr\u00e9e sans `level`).
  if (!team.powers?.[powerKey]) return;
  const price = POWERS[powerKey]?.price || 15;
  if (team.money < price) return;

  const newTeams = [...teams];
  const currentCharges = team.powers[powerKey].charges ?? 0;
  const newPowers = { ...team.powers, [powerKey]: { ...team.powers[powerKey], charges: currentCharges + 1 } };
  newTeams[currentTeam] = { ...team, money: team.money - price, powers: newPowers };

  const pName = POWERS[powerKey]?.name || powerKey;
  addLog(`\u{1F6D2} ${team.emoji} ${team.name} ach\u00e8te 1 charge de ${pName} (${price} \u{1F4B0})`);
  set({ teams: newTeams });
  if (get().phase === 'game') saveGame(get());
}

export function upgradePowerLevel(set, get, powerKey) {
  const { teams, currentTeam, addLog } = get();
  const team = teams[currentTeam];
  const power = POWERS[powerKey];
  if (!power) return;
  const mastery = masteryActive(get);
  const currentLevel = team.powers?.[powerKey]?.level ?? 1;
  if (currentLevel >= maxPowerLevel(powerKey, mastery)) return; // 10 avec Ma\u00EEtrise, sinon 3
  const cost = powerUpgradeCost(powerKey, currentLevel, mastery);
  if (cost == null || team.money < cost) return;

  const newLevel = currentLevel + 1;
  const newTeams = [...teams];
  const newPowers = { ...team.powers, [powerKey]: { ...team.powers[powerKey], level: newLevel } };
  newTeams[currentTeam] = { ...team, powers: newPowers, money: team.money - cost };
  addLog(`\u2B06\uFE0F ${team.emoji} ${team.name} am\u00e9liore ${power.name} au niveau ${newLevel} ! (-${cost} \u{1F4B0})`);

  // Niveaux 5 et 10 (Ma\u00EEtrise) : ouvrir le choix de voie (3 sp\u00e9cialisations).
  const slot = mastery ? specSlotForLevel(newLevel) : null;
  set({ teams: newTeams, ...(slot ? { showSpecPicker: { powerKey, slot, teamIdx: currentTeam } } : {}) });
  saveGame(get());
}

// Choix d'une voie (spec5/spec10) au passage de niveau. Verrouill\u00e9 pour la partie.
export function chooseSpec(set, get, specKey) {
  const picker = get().showSpecPicker;
  if (!picker) return;
  const { powerKey, slot, teamIdx } = picker;
  const teams = get().teams;
  const team = teams[teamIdx];
  if (!team?.powers?.[powerKey]) { set({ showSpecPicker: null }); return; }
  const opt = specOptionsFor(powerKey, slot).find((o) => o.key === specKey);
  if (!opt) return;
  const newTeams = [...teams];
  newTeams[teamIdx] = { ...team, powers: { ...team.powers, [powerKey]: { ...team.powers[powerKey], [slot]: specKey } } };
  get().addLog(`${opt.icon || '\u2728'} ${team.emoji} ${team.name} \u2014 ${POWERS[powerKey].name} : voie \u00AB ${opt.name} \u00BB choisie !`);
  set({ teams: newTeams, showSpecPicker: null });
  saveGame(get());
}
