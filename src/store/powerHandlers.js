import { POWERS } from '../data/powers.js';
import { moveBack } from '../logic/pathfinding.js';
import { consumePowerCharge } from '../logic/turnHelpers.js';
import { reducedRecul } from '../logic/itemEffects.js';
import { saveGame } from './persistence.js';
import { soundThunder, soundPower, soundDice, soundCharge } from '../logic/sounds.js';
import { resumeQueue as resumeEngineQueue, announce } from './effectEngine.js';

// Plafond de questions extra accumulables par le Double (total rafale = 1 + MAX_EXTRA)
const MAX_DOUBLE_EXTRA = 4;


// Effet du niveau courant d'un pouvoir — seule source de verite : powers.js
function levelEffect(powerKey, level) {
  return POWERS[powerKey]?.levels?.[level - 1]?.effect || {};
}

// --- Power usage ---

export function usePower(set, get, powerKey) {
  const { teams, currentTeam, rolling, finished, showQuestion, showEvent, awaitingChoice, diceValue, pendingLanding } = get();
  const team = teams[currentTeam];
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
  const effect = levelEffect('indice', level);

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
  const hideMore = Math.min(effect.count ?? 2, fresh.length);
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
  const effect = levelEffect(powerKey, level);
  let foudreMove = null;
  let lightning = false;

  if (powerKey === 'foudre') {
    // Equipement de la cible (reculReduction) : recul attenue
    const reculAmount = reducedRecul(target, effect.amount ?? 3);
    const r = moveBack(board, target.pos, reculAmount);
    newTeams[targetTeamIndex] = { ...target, pos: r.finalPos };
    if (r.path.length > 1) {
      foudreMove = [{ teamIndex: targetTeamIndex, waypoints: r.path.map((id) => ({ x: board[id].x, y: board[id].y })), type: 'back' }];
    }
    lightning = true;
    soundThunder();
    addLog(`\u26A1 ${team.emoji} ${team.name} utilise Foudre (niv.${level}) sur ${target.emoji} ${target.name} ! Recul de ${reculAmount} cases.`);
    announce(set, get, '⚡', `Foudre sur ${target.emoji} ${target.name} — −${reculAmount} case${reculAmount > 1 ? 's' : ''}`, POWERS[powerKey].color);
  } else if (powerKey === 'sablier') {
    const divisor = effect.divisor ?? 2;
    newTeams[targetTeamIndex] = { ...target, sablierActif: true, sablierDivisor: divisor };
    soundPower();
    addLog(`\u23F1\uFE0F ${team.emoji} ${team.name} utilise Sablier (niv.${level}) sur ${target.emoji} ${target.name} ! Timer /${divisor} au prochain tour.`);
    announce(set, get, '⏱️', `Sablier sur ${target.emoji} ${target.name} — timer /${divisor}`, POWERS[powerKey].color);
  } else if (powerKey === 'double') {
    // Cumulable : on AJOUTE des questions extra (plafonnees), sans ecraser un cast precedent.
    const add = effect.add ?? 1;
    const newExtra = Math.min((target.doubleExtra || 0) + add, MAX_DOUBLE_EXTRA);
    const noBonus = !!effect.noBonus || !!target.doubleNoBonus; // collant
    // Niv.3 : timer reduit persistant sur la rafale — champ separe du Sablier
    // (un Sablier adverse one-shot ne doit pas heriter de cette persistance)
    const newDiv = Math.max(target.doubleTimerDivisor || 1, effect.timerDivisor || 1);
    const pressure = newDiv > 1 ? { doubleTimerDivisor: newDiv } : {};
    newTeams[targetTeamIndex] = { ...target, doubleActive: true, doubleExtra: newExtra, doubleNoBonus: noBonus, ...pressure };
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

// --- Charge picker (rolled a 1) ---

export function chargePickerChoice(set, get, powerKey) {
  const { teams, currentTeam, addLog } = get();
  // Source : 'dice' (dé de 1), 'item' (consommable legacy) ou 'engine' (moteur d'effets)
  const source = get().showChargePicker?.source;
  const fromDice = source !== 'item' && source !== 'engine';
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
