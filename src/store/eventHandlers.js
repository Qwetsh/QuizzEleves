import { POWERS } from '../data/powers.js';
import { moveForward, moveBack, findNextJunction, findPrevJunction } from '../logic/pathfinding.js';
import { pickQuestion } from '../logic/questionPicker.js';
import { randomSubject } from '../logic/turnHelpers.js';

// --- Event flow actions ---

export function triggerEvent(set, get, picked) {
  set({ showEvent: { ...picked, phase: 'intro', data: {} }, eventApplied: false });
}

export function acceptEvent(set, get) {
  const { showEvent } = get();
  if (!showEvent) return;
  const { key } = showEvent;

  const needsTarget = ['foudreFree', 'sacrifice', 'duel', 'don', 'vol', 'echange', 'volArgent'];
  if (needsTarget.includes(key)) {
    set({ showEvent: { ...showEvent, phase: 'target' } });
    return;
  }

  if (key === 'rejouer' || key === 'quitteDouble' || key === 'pariArgent') {
    eventRollDice(set, get);
    return;
  }

  if (key === 'pari' || key === 'bonus' || key === 'jackpot') {
    eventAskQuestion(set, get);
    return;
  }

  if (key === 'recharge' || key === 'marcheNoir') {
    set({ showEvent: { ...showEvent, phase: 'choice' } });
    return;
  }

  applyEventEffect(set, get);
}

export function declineEvent(set, get) {
  const { addLog, teams, currentTeam } = get();
  const team = teams[currentTeam];
  addLog(`${team.emoji} ${team.name} d\u00e9cline l'\u00e9v\u00e9nement.`);
  set({ showEvent: null });
  get().nextTurn();
}

export function eventSelectTarget(set, get, targetIndex) {
  const { showEvent } = get();
  if (!showEvent) return;
  const { key } = showEvent;

  if (key === 'duel') {
    set({ showEvent: { ...showEvent, phase: 'question', data: { ...showEvent.data, targetIndex } } });
    eventAskQuestion(set, get);
    return;
  }

  set({ showEvent: { ...showEvent, data: { ...showEvent.data, targetIndex } } });
  applyEventEffect(set, get);
}

export function eventRollDice(set, get) {
  const { showEvent } = get();
  if (!showEvent) return;
  set({ showEvent: { ...showEvent, phase: 'dice', data: { ...showEvent.data, diceRolling: true, diceValue: null } } });

  const finalValue = Math.floor(Math.random() * 6) + 1;
  let count = 0;
  const interval = setInterval(() => {
    const current = get().showEvent;
    if (!current) { clearInterval(interval); return; }
    set({ showEvent: { ...current, data: { ...current.data, diceValue: Math.floor(Math.random() * 6) + 1 } } });
    count++;
    if (count >= 10) {
      clearInterval(interval);
      const ev = get().showEvent;
      if (!ev) return;
      set({ showEvent: { ...ev, data: { ...ev.data, diceValue: finalValue, diceRolling: false } } });
      setTimeout(() => {
        if (get().showEvent) applyEventEffect(set, get);
      }, 1000);
    }
  }, 80);
}

export function eventAskQuestion(set, get) {
  const { showEvent, questions, askedQuestions, addLog } = get();
  if (!showEvent) return;

  const subject = randomSubject();
  const pool = questions[subject] || [];
  const asked = askedQuestions[subject] || new Set();
  const result = pickQuestion(pool, asked);

  if (!result) {
    addLog(`\u26A0\uFE0F Pas de question disponible.`);
    set({ showEvent: null });
    get().nextTurn();
    return;
  }

  const { question: q, newAsked } = result;
  set({
    showEvent: { ...showEvent, phase: 'question', data: { ...showEvent.data, eventQuestion: q, eventSubject: subject } },
    askedQuestions: { ...askedQuestions, [subject]: newAsked },
  });
}

export function eventAnswerQuestion(set, get, chosenIndex) {
  const { showEvent } = get();
  if (!showEvent?.data?.eventQuestion) return;
  const correct = chosenIndex === showEvent.data.eventQuestion.c;
  set({ showEvent: { ...showEvent, data: { ...showEvent.data, questionResult: correct, questionRevealed: true, questionSelected: chosenIndex } } });
  setTimeout(() => applyEventEffect(set, get), 2000);
}

export function eventRechargeChoice(set, get, powerKey) {
  const { teams, currentTeam, addLog } = get();
  const team = teams[currentTeam];
  const newTeams = [...teams];
  const currentCharges = team.powers?.[powerKey]?.charges ?? 0;
  const newPowers = { ...team.powers, [powerKey]: { ...team.powers[powerKey], charges: currentCharges + 1 } };
  newTeams[currentTeam] = { ...team, powers: newPowers };
  const pName = POWERS[powerKey]?.name || powerKey;
  addLog(`\u{1F50B} ${team.emoji} ${team.name} recharge ${pName} ! (+1 charge)`);
  set({ teams: newTeams, showEvent: null });
  get().nextTurn();
}

export function closeEvent(set, get) {
  const { saveGame } = get();
  set({ showEvent: null, eventApplied: false });
  get().nextTurn();
  if (get().phase === 'game') saveGame(get());
}

// --- The big switch ---

export function applyEventEffect(set, get) {
  if (get().eventApplied) return;
  set({ eventApplied: true });
  const { showEvent, teams, currentTeam, board, addLog } = get();
  if (!showEvent) return;
  const { key, data } = showEvent;
  const team = teams[currentTeam];
  const newTeams = [...teams];
  let message = '';

  switch (key) {
    case 'recul': {
      const newPos = moveBack(board, team.pos, 2);
      newTeams[currentTeam] = { ...team, pos: newPos };
      message = `${team.emoji} ${team.name} recule de 2 cases !`;
      break;
    }
    case 'coupDePouce': {
      const result = moveForward(board, team.pos, 3);
      newTeams[currentTeam] = { ...team, pos: result.finalPos };
      message = `${team.emoji} ${team.name} avance de 3 cases !`;
      break;
    }
    case 'teleport': {
      const junctionId = findNextJunction(board, team.pos);
      if (junctionId) {
        newTeams[currentTeam] = { ...team, pos: junctionId };
        message = `${team.emoji} ${team.name} se t\u00e9l\u00e9porte \u00e0 la prochaine jonction !`;
      } else {
        message = `Pas de jonction devant \u2014 rien ne se passe.`;
      }
      break;
    }
    case 'oubli': {
      newTeams[currentTeam] = { ...team, pos: 'depart' };
      message = `\u{1F573}\uFE0F ${team.emoji} ${team.name} retourne au D\u00c9PART !`;
      break;
    }
    case 'embuscade': {
      const prevJ = findPrevJunction(board, team.pos);
      if (prevJ) {
        newTeams[currentTeam] = { ...team, pos: prevJ };
        message = `${team.emoji} ${team.name} recule \u00e0 la derni\u00e8re jonction !`;
      } else {
        message = `Pas de jonction derri\u00e8re \u2014 rien ne se passe.`;
      }
      break;
    }
    case 'tempete': {
      for (let i = 0; i < teams.length; i++) {
        if (i === currentTeam) continue;
        newTeams[i] = { ...newTeams[i], pos: moveBack(board, newTeams[i].pos, 1) };
      }
      message = `\u{1F32A}\uFE0F Temp\u00eate ! Toutes les autres \u00e9quipes reculent de 1 case.`;
      break;
    }
    case 'rejouer': {
      const dv = data?.diceValue || 1;
      const result = moveForward(board, team.pos, dv);
      newTeams[currentTeam] = { ...team, pos: result.finalPos };
      message = `${team.emoji} ${team.name} rejoue et avance de ${dv} !`;
      break;
    }
    case 'quitteDouble': {
      const dv = data?.diceValue || 1;
      if (dv >= 4) {
        const result = moveForward(board, team.pos, dv * 2);
        newTeams[currentTeam] = { ...team, pos: result.finalPos };
        message = `\u{1F3B0} ${dv} ! Avance de ${dv * 2} cases (double) !`;
      } else {
        const newPos = moveBack(board, team.pos, dv);
        newTeams[currentTeam] = { ...team, pos: newPos };
        message = `\u{1F3B0} ${dv}... Recule de ${dv} cases !`;
      }
      break;
    }
    case 'foudreFree': {
      const ti = data?.targetIndex;
      if (ti != null && ti >= 0 && ti < teams.length) {
        const target = newTeams[ti];
        const newPos = moveBack(board, target.pos, 3);
        newTeams[ti] = { ...target, pos: newPos };
        message = `\u26A1 ${target.emoji} ${target.name} recule de 3 cases !`;
      }
      break;
    }
    case 'sacrifice': {
      const ti = data?.targetIndex;
      if (ti != null && ti >= 0 && ti < teams.length) {
        const target = newTeams[ti];
        newTeams[currentTeam] = { ...team, pos: moveBack(board, team.pos, 2) };
        newTeams[ti] = { ...target, pos: moveBack(board, target.pos, 4) };
        message = `\u{1F91D} ${team.emoji} recule de 2, ${target.emoji} recule de 4 !`;
      }
      break;
    }
    case 'don': {
      const ti = data?.targetIndex;
      if (ti != null && ti >= 0 && ti < teams.length) {
        const target = newTeams[ti];
        const result = moveForward(board, target.pos, 3);
        newTeams[ti] = { ...target, pos: result.finalPos };
        message = `\u{1F381} ${target.emoji} ${target.name} avance de 3 cases !`;
      }
      break;
    }
    case 'echange': {
      const ti = data?.targetIndex;
      if (ti != null && ti >= 0 && ti < teams.length) {
        const target = newTeams[ti];
        newTeams[currentTeam] = { ...team, pos: target.pos };
        newTeams[ti] = { ...target, pos: team.pos };
        message = `\u{1F500} ${team.emoji} et ${target.emoji} \u00e9changent leurs positions !`;
      }
      break;
    }
    case 'vol': {
      const ti = data?.targetIndex;
      if (ti != null && ti >= 0 && ti < teams.length) {
        const target = newTeams[ti];
        let stolen = null;
        for (const pk of ['bouclier', 'indice']) {
          if (target.powers?.[pk]?.charges > 0) { stolen = pk; break; }
        }
        if (stolen) {
          const targetEntry = target.powers?.[stolen] || { charges: 0, level: 1 };
          const myEntry = team.powers?.[stolen] || { charges: 0, level: 1 };
          newTeams[ti] = { ...target, powers: { ...target.powers, [stolen]: { ...targetEntry, charges: targetEntry.charges - 1 } } };
          newTeams[currentTeam] = { ...team, powers: { ...team.powers, [stolen]: { ...myEntry, charges: myEntry.charges + 1 } } };
          message = `\u{1FA99} ${team.emoji} vole 1 charge de ${POWERS[stolen].name} \u00e0 ${target.emoji} !`;
        } else {
          message = `\u{1FA99} ${target.emoji} n'a rien \u00e0 voler !`;
        }
      }
      break;
    }
    case 'duel': {
      const ti = data?.targetIndex;
      const correct = data?.questionResult;
      if (ti != null && ti >= 0 && ti < teams.length) {
        const target = newTeams[ti];
        if (correct) {
          newTeams[currentTeam] = { ...team, pos: moveBack(board, team.pos, 2) };
          message = `\u2694\uFE0F ${target.emoji} r\u00e9ussit le duel ! ${team.emoji} recule de 2.`;
        } else {
          newTeams[ti] = { ...target, pos: moveBack(board, target.pos, 2) };
          message = `\u2694\uFE0F ${target.emoji} \u00e9choue ! ${target.emoji} recule de 2.`;
        }
      }
      break;
    }
    case 'pari': {
      const correct = data?.questionResult;
      if (correct) {
        const result = moveForward(board, team.pos, 3);
        newTeams[currentTeam] = { ...team, pos: result.finalPos };
        message = `\u{1F4B0} Pari gagn\u00e9 ! ${team.emoji} avance de 3 cases !`;
      } else {
        newTeams[currentTeam] = { ...team, pos: moveBack(board, team.pos, 3) };
        message = `\u{1F4B0} Pari perdu ! ${team.emoji} recule de 3 cases.`;
      }
      break;
    }
    case 'bonus': {
      const correct = data?.questionResult;
      if (correct) {
        const result = moveForward(board, team.pos, 3);
        newTeams[currentTeam] = { ...team, pos: result.finalPos };
        message = `\u{1F3AF} Question bonus r\u00e9ussie ! ${team.emoji} avance de 3 !`;
      } else {
        message = `\u{1F3AF} Rat\u00e9... Pas de p\u00e9nalit\u00e9.`;
      }
      break;
    }
    case 'tresor': {
      const gain = 15 + Math.floor(Math.random() * 11);
      newTeams[currentTeam] = { ...team, money: team.money + gain };
      message = `\u{1F4B0} ${team.emoji} ${team.name} trouve un tr\u00e9sor de ${gain} pi\u00e8ces !`;
      break;
    }
    case 'impot': {
      const loss = Math.floor(team.money * 0.3);
      newTeams[currentTeam] = { ...team, money: team.money - loss };
      message = `\u{1F451} ${team.emoji} ${team.name} paie ${loss} pi\u00e8ces d'imp\u00f4t !`;
      break;
    }
    case 'pariArgent': {
      const diceResult = data?.diceValue;
      if (diceResult && diceResult % 2 === 0) {
        newTeams[currentTeam] = { ...team, money: team.money + 10 };
        message = `\u{1F3B0} Pair ! ${team.emoji} ${team.name} gagne 10 pi\u00e8ces !`;
      } else {
        newTeams[currentTeam] = { ...team, money: Math.max(0, team.money - 10) };
        message = `\u{1F3B0} Impair ! ${team.emoji} ${team.name} perd sa mise de 10 pi\u00e8ces !`;
      }
      break;
    }
    case 'marcheNoir': {
      // TODO: implement shop at -50% price
      message = `\u{1F3AA} ${team.emoji} ${team.name} visite le march\u00e9 noir...`;
      break;
    }
    case 'volArgent': {
      const targetIndex = data?.targetIndex;
      if (targetIndex != null && targetIndex >= 0 && targetIndex < teams.length) {
        const target = teams[targetIndex];
        const stolen = Math.min(10, target.money ?? 0);
        newTeams[targetIndex] = { ...target, money: target.money - stolen };
        newTeams[currentTeam] = { ...team, money: team.money + stolen };
        message = `\u{1F977} ${team.emoji} ${team.name} vole ${stolen} pi\u00e8ces \u00e0 ${target.emoji} ${target.name} !`;
      }
      break;
    }
    case 'taxeCommune': {
      for (let i = 0; i < newTeams.length; i++) {
        newTeams[i] = { ...newTeams[i], money: Math.max(0, newTeams[i].money - 5) };
      }
      message = `\u{1F3E6} Taxe commune ! Toutes les \u00e9quipes perdent 5 pi\u00e8ces.`;
      break;
    }
    case 'jackpot': {
      const qResult = data?.questionResult;
      if (qResult === true) {
        newTeams[currentTeam] = { ...team, money: team.money + 30 };
        message = `\u{1F3C6} Jackpot ! ${team.emoji} ${team.name} gagne 30 pi\u00e8ces !`;
      } else {
        newTeams[currentTeam] = { ...team, money: Math.max(0, team.money - 10) };
        message = `\u{1F3C6} Rat\u00e9 ! ${team.emoji} ${team.name} perd 10 pi\u00e8ces.`;
      }
      break;
    }
    case 'banquier': {
      const bonusAmount = team.correct * 3;
      newTeams[currentTeam] = { ...team, money: team.money + bonusAmount };
      message = `\u{1F3E6} Le banquier r\u00e9compense ${team.emoji} ${team.name} : +${bonusAmount} pi\u00e8ces (${team.correct} bonnes r\u00e9ponses x3) !`;
      break;
    }
    default:
      message = `\u00c9v\u00e9nement appliqu\u00e9.`;
  }

  addLog(message);
  set({ teams: newTeams, showEvent: { ...showEvent, phase: 'result', data: { ...data, message } } });
}
