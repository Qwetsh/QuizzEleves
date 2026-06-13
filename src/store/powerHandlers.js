import { POWERS } from '../data/powers.js';
import { moveBack } from '../logic/pathfinding.js';
import { consumePowerCharge } from '../logic/turnHelpers.js';
import { getEffectValue, reducedRecul } from '../logic/itemEffects.js';
import { saveGame } from './persistence.js';

// Effet du niveau courant d'un pouvoir — seule source de verite : powers.js
function levelEffect(powerKey, level) {
  return POWERS[powerKey]?.levels?.[level - 1]?.effect || {};
}

// --- Power usage ---

export function usePower(set, get, powerKey) {
  const { teams, currentTeam, rolling, finished, showQuestion, showEvent, awaitingChoice, diceValue, pendingLanding } = get();
  if (finished || rolling || showEvent || awaitingChoice) return;
  const team = teams[currentTeam];
  const charges = team.powers?.[powerKey]?.charges ?? 0;
  if (charges <= 0) return;

  const power = POWERS[powerKey];
  if (!power) return;

  if (powerKey === 'indice') {
    if (!showQuestion || get().indiceUsed) return;
    useIndice(set, get);
    return;
  }

  if (powerKey === 'relance') {
    if (!diceValue || showQuestion || !pendingLanding) return;
    useRelance(set, get);
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
  const effect = levelEffect('indice', level);

  const wrongIndices = question.a
    .map((_, i) => i)
    .filter((i) => i !== question.c);
  for (let i = wrongIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [wrongIndices[i], wrongIndices[j]] = [wrongIndices[j], wrongIndices[i]];
  }
  // Equipement (indiceBoost) : reponses supplementaires eliminees
  const boost = getEffectValue(team, 'indiceBoost');
  const hideCount = Math.min((effect.count ?? 2) + boost, wrongIndices.length);
  const hidden = wrongIndices.slice(0, hideCount);

  const result = consumePowerCharge(team, 'indice');
  if (!result) return;

  const newTeams = [...teams];
  newTeams[currentTeam] = result.updatedTeam;

  addLog(`\u{1F4A1} ${team.emoji} ${team.name} utilise Indice (niv.${level}) ! ${hideCount} r\u00e9ponses \u00e9limin\u00e9es.`);
  set({ teams: newTeams, indiceUsed: true, indiceHidden: hidden });

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
  set({ teams: newTeams, diceValue: null, rolling: true, pendingLanding: false });

  const finalValue = Math.floor(Math.random() * 6) + 1;
  let count = 0;
  const interval = setInterval(() => {
    set({ diceValue: Math.floor(Math.random() * 6) + 1 });
    count++;
    if (count >= 10) {
      clearInterval(interval);
      set({ diceValue: finalValue, rolling: false });

      const mode = levelEffect('relance', level).mode || 'replace';
      let effectiveValue;
      if (mode === 'sum') effectiveValue = prevValue + finalValue;
      else if (mode === 'best') effectiveValue = Math.max(prevValue, finalValue);
      else effectiveValue = finalValue;

      addLog(`\u{1F3B2} Relance : ${finalValue} !${mode !== 'replace' ? ` (effectif: ${effectiveValue})` : ''}`);
      get().handleDiceResult(effectiveValue);
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
    newTeams[targetTeamIndex] = { ...target, itemFumigene: false };
    addLog(`\u{1F4A8} La bombe fumigène de ${target.emoji} ${target.name} annule ${POWERS[powerKey].name} !`);
    set({ teams: newTeams, showTargetPicker: null });
    return;
  }

  const level = team.powers?.[powerKey]?.level ?? 1;
  const effect = levelEffect(powerKey, level);
  let foudreMove = null;

  if (powerKey === 'foudre') {
    // Equipement de la cible (reculReduction) : recul attenue
    const reculAmount = reducedRecul(target, effect.amount ?? 3);
    const r = moveBack(board, target.pos, reculAmount);
    newTeams[targetTeamIndex] = { ...target, pos: r.finalPos };
    if (r.path.length > 1) {
      foudreMove = [{ teamIndex: targetTeamIndex, waypoints: r.path.map((id) => ({ x: board[id].x, y: board[id].y })), type: 'back' }];
    }
    addLog(`\u26A1 ${team.emoji} ${team.name} utilise Foudre (niv.${level}) sur ${target.emoji} ${target.name} ! Recul de ${reculAmount} cases.`);
  } else if (powerKey === 'sablier') {
    const divisor = effect.divisor ?? 2;
    newTeams[targetTeamIndex] = { ...target, sablierActif: true, sablierDivisor: divisor };
    addLog(`\u23F1\uFE0F ${team.emoji} ${team.name} utilise Sablier (niv.${level}) sur ${target.emoji} ${target.name} ! Timer /${divisor} au prochain tour.`);
  } else if (powerKey === 'double') {
    const questionCount = effect.count ?? 2;
    const noBonus = !!effect.noBonus;
    // Niv.3 : timer reduit persistant sur la rafale — champ separe du Sablier
    // (un Sablier adverse one-shot ne doit pas heriter de cette persistance)
    const pressure = effect.timerDivisor
      ? { doubleTimerDivisor: effect.timerDivisor }
      : {};
    newTeams[targetTeamIndex] = { ...target, doubleActive: true, doubleCount: questionCount, doubleNoBonus: noBonus, ...pressure };
    addLog(`\u2753 ${team.emoji} ${team.name} utilise Double (niv.${level}) sur ${target.emoji} ${target.name} ! ${questionCount} questions au prochain tour.${noBonus ? ' (sans bonus)' : ''}${effect.timerDivisor ? ` Timer /${effect.timerDivisor} !` : ''}`);
  }

  set({ teams: newTeams, showTargetPicker: null, ...(foudreMove ? { movePath: foudreMove } : {}) });
  // Stay in pendingLanding so player can use more powers before clicking "Continuer"
}

export function cancelTargetPicker(set, get) {
  set({ showTargetPicker: null });
  // Stay in pendingLanding — player can use other powers or click "Continuer"
}

// --- Charge picker (rolled a 1) ---

export function chargePickerChoice(set, get, powerKey) {
  const { teams, currentTeam, addLog } = get();
  // Ouvert par le dé de 1 (source 'dice') ou par un consommable (source 'item')
  const fromDice = get().showChargePicker?.source !== 'item';
  const team = teams[currentTeam];
  const newTeams = [...teams];
  const currentCharges = team.powers?.[powerKey]?.charges ?? 0;
  const newPowers = { ...team.powers, [powerKey]: { ...team.powers[powerKey], charges: currentCharges + 1 } };
  newTeams[currentTeam] = { ...team, powers: newPowers };
  const pName = POWERS[powerKey]?.name || powerKey;
  addLog(`\u2728 ${team.emoji} ${team.name} gagne 1 charge de ${pName} !`);
  set({ teams: newTeams, showChargePicker: false });

  // Seul le flux "dé de 1" enchaîne sur une activation offensive immédiate ;
  // un consommable (Cristal d'énergie...) ne fait que recharger.
  const power = POWERS[powerKey];
  if (fromDice && power?.category === 'off') {
    set({ showTargetPicker: { powerKey } });
    return;
  }
  // Defensive: stay in pendingLanding — player clicks "Continuer" when ready
}

export function chargePickerSkip(set, get) {
  set({ showChargePicker: false });
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
  const price = POWERS[powerKey]?.price || 15;
  if (team.money < price) return;

  const newTeams = [...teams];
  const currentCharges = team.powers?.[powerKey]?.charges ?? 0;
  const newPowers = { ...team.powers, [powerKey]: { ...team.powers[powerKey], charges: currentCharges + 1 } };
  newTeams[currentTeam] = { ...team, money: team.money - price, powers: newPowers };

  const pName = POWERS[powerKey]?.name || powerKey;
  addLog(`\u{1F6D2} ${team.emoji} ${team.name} ach\u00e8te 1 charge de ${pName} (${price} \u{1F4B0})`);
  set({ teams: newTeams });
}

export function upgradePowerLevel(set, get, powerKey) {
  const { teams, currentTeam, addLog } = get();
  const team = teams[currentTeam];
  const power = POWERS[powerKey];
  if (!power) return;
  const currentLevel = team.powers?.[powerKey]?.level ?? 1;
  if (currentLevel >= 3) return;
  const cost = power.upgradeCosts[currentLevel - 1];
  if (team.money < cost) return;

  const newTeams = [...teams];
  const newPowers = { ...team.powers, [powerKey]: { ...team.powers[powerKey], level: currentLevel + 1 } };
  newTeams[currentTeam] = { ...team, powers: newPowers, money: team.money - cost };
  addLog(`\u2B06\uFE0F ${team.emoji} ${team.name} am\u00e9liore ${power.name} au niveau ${currentLevel + 1} ! (-${cost} \u{1F4B0})`);
  set({ teams: newTeams });
  saveGame(get());
}
