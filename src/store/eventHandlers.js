import { POWERS } from '../data/powers.js';
import { moveForward, moveBack, findPrevJunction, buildPredecessors } from '../logic/pathfinding.js';
import { pickQuestion } from '../logic/questionPicker.js';
import { randomSubject } from '../logic/turnHelpers.js';

// --- Animation helpers ---

function toWaypoints(board, path) {
  return path.map((id) => ({ x: board[id].x, y: board[id].y }));
}

// Chemin avant jusqu'a la prochaine jonction (ou arrivee) en suivant next[0].
// Retourne le chemin complet [from, ..., jonction] ou null si rien devant.
function forwardPathToJunction(board, from) {
  const path = [from];
  let pos = from;
  const visited = new Set();
  while (pos) {
    if (visited.has(pos)) break;
    visited.add(pos);
    const node = board[pos];
    if (!node || node.next.length === 0) break;
    pos = node.next[0];
    path.push(pos);
    if (board[pos].type === 'jonction' || board[pos].type === 'arrivee') return path;
  }
  return null;
}

// Chemin arriere de `from` jusqu'a `target` en suivant les predecesseurs.
function backPathTo(board, from, target) {
  const preds = buildPredecessors(board);
  const path = [from];
  let pos = from;
  let guard = 0;
  while (pos !== target && guard++ < 1000) {
    const p = preds[pos];
    if (!p || p.length === 0) break;
    pos = p[0];
    path.push(pos);
  }
  return path;
}

// --- Event flow actions ---

export function triggerEvent(set, get, picked) {
  set({ showEvent: { ...picked, phase: 'intro', data: {} }, eventApplied: false });
}

export function acceptEvent(set, get) {
  const { showEvent } = get();
  if (!showEvent) return;
  const { key } = showEvent;

  const needsTarget = ['decharge', 'sacrifice', 'duel', 'don', 'vol', 'echange', 'volArgent'];
  if (needsTarget.includes(key)) {
    set({ showEvent: { ...showEvent, phase: 'target' } });
    return;
  }

  if (key === 'rejouer' || key === 'quitteDouble' || key === 'tempete') {
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
  addLog(`${team.emoji} ${team.name} décline l'événement.`);
  set({ showEvent: null });
  get().nextTurn();
}

export function eventSelectTarget(set, get, targetIndex) {
  const { showEvent, teams } = get();
  if (!showEvent) return;
  const { key } = showEvent;

  if (key === 'duel') {
    set({ showEvent: { ...showEvent, phase: 'question', data: { ...showEvent.data, targetIndex } } });
    eventAskQuestion(set, get);
    return;
  }

  // Decharge electrique : cible choisie, puis lancer de de pour le recul
  if (key === 'decharge') {
    set({ showEvent: { ...showEvent, data: { ...showEvent.data, targetIndex } } });
    eventRollDice(set, get);
    return;
  }

  // Vol : si la cible a au moins une charge, choix du pouvoir vole puis du
  // pouvoir recharge ; sinon resultat direct ("rien a voler")
  if (key === 'vol') {
    const target = teams[targetIndex];
    const hasCharges = Object.entries(target?.powers || {}).some(([pk, p]) => POWERS[pk] && p?.charges > 0);
    if (hasCharges) {
      set({ showEvent: { ...showEvent, phase: 'choice', data: { ...showEvent.data, targetIndex } } });
      return;
    }
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
    addLog(`⚠️ Pas de question disponible.`);
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

// Vol : transfere 1 charge d'un pouvoir de la cible (stealKey) vers un
// pouvoir de l'equipe active (giveKey) — les deux choisis par le joueur.
export function eventVolApply(set, get, stealKey, giveKey) {
  const { showEvent, teams, currentTeam, addLog } = get();
  const targetIndex = showEvent?.data?.targetIndex;
  if (targetIndex == null) return;
  const team = teams[currentTeam];
  const target = teams[targetIndex];
  if (!target || !POWERS[stealKey] || !POWERS[giveKey]) return;
  if ((target.powers?.[stealKey]?.charges ?? 0) <= 0) return;

  const targetEntry = target.powers[stealKey];
  const myEntry = team.powers?.[giveKey] || { charges: 0, level: 1 };
  const newTeams = [...teams];
  newTeams[targetIndex] = { ...target, powers: { ...target.powers, [stealKey]: { ...targetEntry, charges: targetEntry.charges - 1 } } };
  newTeams[currentTeam] = { ...team, powers: { ...team.powers, [giveKey]: { ...myEntry, charges: myEntry.charges + 1 } } };
  addLog(`\u{1FA99} ${team.emoji} ${team.name} vole 1 charge de ${POWERS[stealKey].name} à ${target.emoji} ${target.name} et recharge ${POWERS[giveKey].name} !`);
  set({ teams: newTeams, showEvent: null });
  get().nextTurn();
}

// Marche Noir : achat d'une charge d'un pouvoir possede a -50%.
export function eventMarcheNoirBuy(set, get, powerKey) {
  const { teams, currentTeam, addLog } = get();
  const team = teams[currentTeam];
  const power = POWERS[powerKey];
  if (!power) return;
  const price = Math.ceil(power.price / 2);
  if ((team.money ?? 0) < price) return;

  const entry = team.powers?.[powerKey] || { charges: 0, level: 1 };
  const newTeams = [...teams];
  newTeams[currentTeam] = {
    ...team,
    money: team.money - price,
    powers: { ...team.powers, [powerKey]: { ...entry, charges: entry.charges + 1 } },
  };
  addLog(`\u{1F3AA} ${team.emoji} ${team.name} achète 1 charge de ${power.name} au marché noir ! (-${price} \u{1F4B0})`);
  set({ teams: newTeams, showEvent: null });
  get().nextTurn();
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
  // Animations a jouer : [{ teamIndex, waypoints, type }]
  const moves = [];
  const pushMove = (teamIndex, path, type) => {
    if (path && path.length > 1) moves.push({ teamIndex, waypoints: toWaypoints(board, path), type });
  };

  switch (key) {
    case 'recul': {
      const r = moveBack(board, team.pos, 2);
      newTeams[currentTeam] = { ...team, pos: r.finalPos };
      pushMove(currentTeam, r.path, 'back');
      message = `${team.emoji} ${team.name} recule de 2 cases !`;
      break;
    }
    case 'coupDePouce': {
      const result = moveForward(board, team.pos, 3, { throughJunctions: true });
      newTeams[currentTeam] = { ...team, pos: result.finalPos };
      pushMove(currentTeam, result.path, 'forward');
      message = `${team.emoji} ${team.name} avance de 3 cases !`;
      break;
    }
    case 'teleport': {
      const path = forwardPathToJunction(board, team.pos);
      if (path) {
        newTeams[currentTeam] = { ...team, pos: path[path.length - 1] };
        pushMove(currentTeam, path, 'forward');
        message = `${team.emoji} ${team.name} se téléporte à la prochaine jonction !`;
      } else {
        message = `Pas de jonction devant — rien ne se passe.`;
      }
      break;
    }
    case 'oubli': {
      const r = moveBack(board, team.pos, 9999);
      newTeams[currentTeam] = { ...team, pos: 'depart' };
      pushMove(currentTeam, r.path, 'back');
      message = `\u{1F573}️ ${team.emoji} ${team.name} retourne au DÉPART !`;
      break;
    }
    case 'embuscade': {
      const prevJ = findPrevJunction(board, team.pos);
      if (prevJ && prevJ !== team.pos) {
        newTeams[currentTeam] = { ...team, pos: prevJ };
        pushMove(currentTeam, backPathTo(board, team.pos, prevJ), 'back');
        message = `${team.emoji} ${team.name} recule à la dernière jonction !`;
      } else {
        message = `Pas de jonction derrière — rien ne se passe.`;
      }
      break;
    }
    case 'tempete': {
      const dv = data?.diceValue || 1;
      for (let i = 0; i < teams.length; i++) {
        const r = moveBack(board, newTeams[i].pos, dv);
        newTeams[i] = { ...newTeams[i], pos: r.finalPos };
        pushMove(i, r.path, 'back');
      }
      message = `\u{1F32A}️ Tempête ! TOUTES les équipes reculent de ${dv} case${dv > 1 ? 's' : ''}.`;
      break;
    }
    case 'rejouer': {
      const dv = data?.diceValue || 1;
      const result = moveForward(board, team.pos, dv, { throughJunctions: true });
      newTeams[currentTeam] = { ...team, pos: result.finalPos };
      pushMove(currentTeam, result.path, 'forward');
      message = `${team.emoji} ${team.name} rejoue et avance de ${dv} !`;
      break;
    }
    case 'quitteDouble': {
      // Le de de l'evenement decide gagne/perdu ; la mise est le lancer
      // d'ARRIVEE sur la case evenement (preRollValue), pas le de de l'evenement.
      const dv = data?.diceValue || 1;
      const moveRoll = get().preRollValue || dv;
      if (dv >= 4) {
        const gain = moveRoll * 2;
        const result = moveForward(board, team.pos, gain, { throughJunctions: true });
        newTeams[currentTeam] = { ...team, pos: result.finalPos };
        pushMove(currentTeam, result.path, 'forward');
        message = `\u{1F3B0} ${dv} ! Ton lancer de ${moveRoll} est doublé : avance de ${gain} cases !`;
      } else {
        const r = moveBack(board, team.pos, moveRoll);
        newTeams[currentTeam] = { ...team, pos: r.finalPos };
        pushMove(currentTeam, r.path, 'back');
        message = `\u{1F3B0} ${dv}... Perdu ! Recule de ton lancer : ${moveRoll} case${moveRoll > 1 ? 's' : ''}.`;
      }
      break;
    }
    case 'decharge': {
      const ti = data?.targetIndex;
      const dv = data?.diceValue || 1;
      if (ti != null && ti >= 0 && ti < teams.length) {
        const target = newTeams[ti];
        const r = moveBack(board, target.pos, dv);
        newTeams[ti] = { ...target, pos: r.finalPos };
        pushMove(ti, r.path, 'back');
        message = `⚡ ${target.emoji} ${target.name} prend la décharge et recule de ${dv} case${dv > 1 ? 's' : ''} !`;
      }
      break;
    }
    case 'sacrifice': {
      const ti = data?.targetIndex;
      if (ti != null && ti >= 0 && ti < teams.length) {
        const target = newTeams[ti];
        const rMe = moveBack(board, team.pos, 2);
        const rTarget = moveBack(board, target.pos, 4);
        newTeams[currentTeam] = { ...team, pos: rMe.finalPos };
        newTeams[ti] = { ...target, pos: rTarget.finalPos };
        pushMove(currentTeam, rMe.path, 'back');
        pushMove(ti, rTarget.path, 'back');
        message = `\u{1F91D} ${team.emoji} recule de 2, ${target.emoji} recule de 4 !`;
      }
      break;
    }
    case 'don': {
      const ti = data?.targetIndex;
      if (ti != null && ti >= 0 && ti < teams.length) {
        const target = newTeams[ti];
        const result = moveForward(board, target.pos, 3, { throughJunctions: true });
        newTeams[ti] = { ...target, pos: result.finalPos };
        pushMove(ti, result.path, 'forward');
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
        // Vol direct croise (pas de chemin case par case pour un echange)
        pushMove(currentTeam, [team.pos, target.pos], 'forward');
        pushMove(ti, [target.pos, team.pos], 'forward');
        message = `\u{1F500} ${team.emoji} et ${target.emoji} échangent leurs positions !`;
      }
      break;
    }
    case 'vol': {
      // Cas "rien a voler" uniquement — le vol effectif passe par eventVolApply
      const ti = data?.targetIndex;
      if (ti != null && ti >= 0 && ti < teams.length) {
        message = `\u{1FA99} ${newTeams[ti].emoji} n'a aucune charge à voler !`;
      }
      break;
    }
    case 'duel': {
      const ti = data?.targetIndex;
      const correct = data?.questionResult;
      if (ti != null && ti >= 0 && ti < teams.length) {
        const target = newTeams[ti];
        if (correct) {
          const r = moveBack(board, team.pos, 2);
          newTeams[currentTeam] = { ...team, pos: r.finalPos };
          pushMove(currentTeam, r.path, 'back');
          message = `⚔️ ${target.emoji} réussit le duel ! ${team.emoji} recule de 2.`;
        } else {
          const r = moveBack(board, target.pos, 2);
          newTeams[ti] = { ...target, pos: r.finalPos };
          pushMove(ti, r.path, 'back');
          message = `⚔️ ${target.emoji} échoue ! ${target.emoji} recule de 2.`;
        }
      }
      break;
    }
    case 'pari': {
      const correct = data?.questionResult;
      if (correct) {
        const result = moveForward(board, team.pos, 3, { throughJunctions: true });
        newTeams[currentTeam] = { ...team, pos: result.finalPos };
        pushMove(currentTeam, result.path, 'forward');
        message = `\u{1F4B0} Pari gagné ! ${team.emoji} avance de 3 cases !`;
      } else {
        const r = moveBack(board, team.pos, 3);
        newTeams[currentTeam] = { ...team, pos: r.finalPos };
        pushMove(currentTeam, r.path, 'back');
        message = `\u{1F4B0} Pari perdu ! ${team.emoji} recule de 3 cases.`;
      }
      break;
    }
    case 'bonus': {
      const correct = data?.questionResult;
      if (correct) {
        const result = moveForward(board, team.pos, 3, { throughJunctions: true });
        newTeams[currentTeam] = { ...team, pos: result.finalPos };
        pushMove(currentTeam, result.path, 'forward');
        message = `\u{1F3AF} Question bonus réussie ! ${team.emoji} avance de 3 !`;
      } else {
        message = `\u{1F3AF} Raté... Pas de pénalité.`;
      }
      break;
    }
    case 'tresor': {
      const gain = 15 + Math.floor(Math.random() * 11);
      newTeams[currentTeam] = { ...team, money: team.money + gain };
      message = `\u{1F4B0} ${team.emoji} ${team.name} trouve un trésor de ${gain} pièces !`;
      break;
    }
    case 'impot': {
      const loss = Math.floor(team.money * 0.3);
      newTeams[currentTeam] = { ...team, money: team.money - loss };
      message = `\u{1F451} ${team.emoji} ${team.name} paie ${loss} pièces d'impôt !`;
      break;
    }
    case 'volArgent': {
      const targetIndex = data?.targetIndex;
      if (targetIndex != null && targetIndex >= 0 && targetIndex < teams.length) {
        const target = teams[targetIndex];
        const stolen = Math.min(10, target.money ?? 0);
        newTeams[targetIndex] = { ...target, money: target.money - stolen };
        newTeams[currentTeam] = { ...team, money: team.money + stolen };
        message = `\u{1F977} ${team.emoji} ${team.name} vole ${stolen} pièces à ${target.emoji} ${target.name} !`;
      }
      break;
    }
    case 'taxeCommune': {
      for (let i = 0; i < newTeams.length; i++) {
        newTeams[i] = { ...newTeams[i], money: Math.max(0, newTeams[i].money - 5) };
      }
      message = `\u{1F3E6} Taxe commune ! Toutes les équipes perdent 5 pièces.`;
      break;
    }
    case 'jackpot': {
      const qResult = data?.questionResult;
      if (qResult === true) {
        newTeams[currentTeam] = { ...team, money: team.money + 30 };
        message = `\u{1F3C6} Jackpot ! ${team.emoji} ${team.name} gagne 30 pièces !`;
      } else {
        newTeams[currentTeam] = { ...team, money: Math.max(0, team.money - 10) };
        message = `\u{1F3C6} Raté ! ${team.emoji} ${team.name} perd 10 pièces.`;
      }
      break;
    }
    case 'banquier': {
      const bonusAmount = team.correct * 3;
      newTeams[currentTeam] = { ...team, money: team.money + bonusAmount };
      message = `\u{1F3E6} Le banquier récompense ${team.emoji} ${team.name} : +${bonusAmount} pièces (${team.correct} bonnes réponses x3) !`;
      break;
    }
    default:
      message = `Événement appliqué.`;
  }

  addLog(message);
  set({
    teams: newTeams,
    showEvent: { ...showEvent, phase: 'result', data: { ...data, message } },
    ...(moves.length ? { movePath: moves } : {}),
  });

  // Un evenement peut amener une equipe sur l'arrivee : declarer la victoire.
  const winnerIdx = newTeams.findIndex((t) => board[t.pos]?.type === 'arrivee');
  if (winnerIdx !== -1) {
    const winner = newTeams[winnerIdx];
    addLog(`\u{1F3C6} ${winner.emoji} ${winner.name} atteint l'arrivée !`);
    set({ finished: true });
  }
}
