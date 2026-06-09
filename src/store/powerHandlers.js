import { POWERS } from '../data/powers.js';
import { moveBack } from '../logic/pathfinding.js';
import { consumePowerCharge } from '../logic/turnHelpers.js';
import { saveGame } from './persistence.js';

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

  const wrongIndices = question.a
    .map((_, i) => i)
    .filter((i) => i !== question.c);
  for (let i = wrongIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [wrongIndices[i], wrongIndices[j]] = [wrongIndices[j], wrongIndices[i]];
  }
  const hideCount = level >= 3 ? wrongIndices.length : 2;
  const hidden = wrongIndices.slice(0, hideCount);

  const result = consumePowerCharge(team, 'indice');
  if (!result) return;

  const newTeams = [...teams];
  newTeams[currentTeam] = result.updatedTeam;

  const eliminatedCount = level >= 3 ? 'toutes les mauvaises' : '2';
  addLog(`\u{1F4A1} ${team.emoji} ${team.name} utilise Indice (niv.${level}) ! ${eliminatedCount} r\u00e9ponses \u00e9limin\u00e9es.`);
  set({ teams: newTeams, indiceUsed: true, indiceHidden: hidden });

  if (level >= 2) {
    set({ showQuestion: { ...get().showQuestion, bonusTime: 5 } });
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

      let effectiveValue;
      if (level >= 3) effectiveValue = prevValue + finalValue;
      else if (level >= 2) effectiveValue = Math.max(prevValue, finalValue);
      else effectiveValue = finalValue;

      addLog(`\u{1F3B2} Relance : ${finalValue} !${level >= 2 ? ` (effectif: ${effectiveValue})` : ''}`);
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

  if (powerKey === 'foudre') {
    const level = team.powers?.foudre?.level ?? 1;
    const reculAmount = level >= 3 ? 7 : level >= 2 ? 5 : 3;
    newTeams[targetTeamIndex] = { ...target, pos: moveBack(board, target.pos, reculAmount).finalPos };
    addLog(`\u26A1 ${team.emoji} ${team.name} utilise Foudre (niv.${level}) sur ${target.emoji} ${target.name} ! Recul de ${reculAmount} cases.`);
  } else if (powerKey === 'sablier') {
    const level = team.powers?.sablier?.level ?? 1;
    const divisor = level >= 3 ? 4 : level >= 2 ? 3 : 2;
    newTeams[targetTeamIndex] = { ...target, sablierActif: true, sablierDivisor: divisor };
    addLog(`\u23F1\uFE0F ${team.emoji} ${team.name} utilise Sablier (niv.${level}) sur ${target.emoji} ${target.name} ! Timer /${divisor} au prochain tour.`);
  } else if (powerKey === 'double') {
    const level = team.powers?.double?.level ?? 1;
    const questionCount = level >= 3 ? 3 : 2;
    const noBonus = level === 2;
    newTeams[targetTeamIndex] = { ...target, doubleActive: true, doubleCount: questionCount, doubleNoBonus: noBonus };
    addLog(`\u2753 ${team.emoji} ${team.name} utilise Double (niv.${level}) sur ${target.emoji} ${target.name} ! ${questionCount} questions au prochain tour.${noBonus ? ' (sans bonus)' : ''}`);
  }

  set({ teams: newTeams, showTargetPicker: null });
  // Stay in pendingLanding so player can use more powers before clicking "Continuer"
}

export function cancelTargetPicker(set, get) {
  set({ showTargetPicker: null });
  // Stay in pendingLanding — player can use other powers or click "Continuer"
}

// --- Charge picker (rolled a 1) ---

export function chargePickerChoice(set, get, powerKey) {
  const { teams, currentTeam, addLog } = get();
  const team = teams[currentTeam];
  const newTeams = [...teams];
  const currentCharges = team.powers?.[powerKey]?.charges ?? 0;
  const newPowers = { ...team.powers, [powerKey]: { ...team.powers[powerKey], charges: currentCharges + 1 } };
  newTeams[currentTeam] = { ...team, powers: newPowers };
  const pName = POWERS[powerKey]?.name || powerKey;
  addLog(`\u2728 ${team.emoji} ${team.name} gagne 1 charge de ${pName} !`);
  set({ teams: newTeams, showChargePicker: false });

  const power = POWERS[powerKey];
  if (power?.category === 'off') {
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
