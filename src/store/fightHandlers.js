import { getEffectValue, reducedSteal, reducedRecul } from '../logic/itemEffects.js';
import { moveBack } from '../logic/pathfinding.js';
import { applyRecul } from '../logic/turnHelpers.js';
import { extOn } from '../extensions/registry.js';
import { ITEMS } from '../data/items.js';
import { pickLootItem, placeItem, normalizeBag, cellKey, cellN, mkCell } from './itemHandlers.js';
import { equipTriggerActions, runEffects } from './effectEngine.js';
import { LOOT } from '../logic/balanceConfig.js';
import { saveGame } from './persistence.js';
import { tg, tgPlural } from '../i18n';
import { locName } from '../i18n/content';

// Transfere un objet vers une equipe (cascade unique placeItem) et formate
// la note de butin. Retourne { team: updatedTeam, note: string }.
function receiveItem(team, itemKey) {
  const r = placeItem(team, itemKey);
  const note = r.outcome === 'equipped'
    ? tg('log.ft.note.equipped')
    : r.outcome === 'refunded'
      ? tg('log.ft.note.refunded', { refund: r.refund })
      : '';
  return { team: r.team, note };
}

// Nombre de manches gagnees pour remporter le combat (BO3)
export const FIGHT_ROUNDS_TO_WIN = 2;

/**
 * Demarre un combat : l'equipe active vient d'atterrir sur la case
 * d'une autre equipe. Remplace l'action normale de la case.
 */
export function startFight(set, get, defenderIndex, subject) {
  const { teams, currentTeam, addLog } = get();
  const att = teams[currentTeam];
  const def = teams[defenderIndex];
  addLog(tg('log.ft.challenge', { att: `${att.emoji} ${att.name}`, def: `${def.emoji} ${def.name}` }));
  set({
    showFight: {
      attackerIndex: currentTeam,
      defenderIndex,
      subject,
      phase: 'versus',          // versus -> briefing -> minigame -> reward -> result
      round: 1,
      wins: { attacker: 0, defender: 0 },
      winnerSide: null,
      reward: null,             // { choice, dice, rolling }
      resultMessage: null,
    },
  });
}

// Adversaire « Boss » : le professeur. Non-équipe (defenderIndex = -1), joué par
// le prof sur le côté droit du mini-jeu. Issue FIXE (pas de choix de récompense).
export const BOSS_PROF = { emoji: '👨‍🏫', name: 'Le Prof', color: '#8a1f2e', powers: {}, equipment: { head: null, body: null, feet: null }, bag: [], money: 0 };

/**
 * Démarre un COMBAT DE BOSS : l'équipe active affronte le Prof sur le mini-jeu
 * choisi (déterminé par `subject`). Victoire = +50 or + 1 objet ; défaite = recul 1D10.
 */
export function startBossFight(set, get, subject) {
  const { currentTeam, teams, addLog } = get();
  const att = teams[currentTeam];
  addLog(tg('log.ft.bossChallenge', { att: `${att.emoji} ${att.name}` }));
  set({
    showFight: {
      attackerIndex: currentTeam,
      defenderIndex: -1,
      boss: BOSS_PROF,
      bossFight: true,
      subject,
      phase: 'versus',
      round: 1,
      wins: { attacker: 0, defender: 0 },
      winnerSide: null,
      reward: null,
      resultMessage: null,
    },
  });
}

// Issue d'un combat de boss (pas de choix de récompense) : applique le gain ou
// la pénalité à l'équipe puis passe en phase résultat.
function resolveBossOutcome(set, get, f) {
  const { teams, board, addLog } = get();
  const idx = f.attackerIndex;
  const team = teams[idx];
  const newTeams = [...teams];
  let message; let moves = null;

  if (f.winnerSide === 'attacker') {
    const gold = 50;
    let placed = { ...team, money: (team.money || 0) + gold };
    const lootKey = pickLootItem(LOOT.fightLegendaryChance, get().enabledItems || Object.keys(ITEMS));
    let note = '';
    if (lootKey) { const r = receiveItem(placed, lootKey); placed = r.team; note = r.note; }
    newTeams[idx] = placed;
    const loot = lootKey ? tg('log.ft.bossWin.loot', { icon: ITEMS[lootKey].icon, item: locName(ITEMS[lootKey]), note }) : '';
    message = tg('log.ft.bossWin', { team: `${team.emoji} ${team.name}`, gold, loot });
  } else {
    const dv = Math.floor(Math.random() * 10) + 1;
    const rec = applyRecul(team, board, dv, extOn(get().extensions, 'mastery')); // bouclier + équipement protègent du recul
    newTeams[idx] = { ...team, ...rec.patch };
    if (rec.path) moves = [{ teamIndex: idx, waypoints: rec.path.map((id) => ({ x: board[id].x, y: board[id].y })), type: 'back' }];
    message = rec.applied > 0
      ? tg('log.ft.bossLose', { team: `${team.emoji} ${team.name}`, n: rec.applied, s: rec.applied > 1 ? 's' : '', reduced: rec.absorbedBy ? tg('log.ft.reduced') : '' })
      : tg('log.ft.bossLose.absorbed', { team: `${team.emoji} ${team.name}` });
  }
  addLog(message);
  set({ teams: newTeams, showFight: { ...f, phase: 'result', resultMessage: message }, ...(moves ? { movePath: moves } : {}) });
}

// Fin de l'ecran versus -> ecran d'explication (briefing) du mini-jeu
export function fightBegin(set, get) {
  const f = get().showFight;
  if (!f || f.phase !== 'versus') return;
  set({ showFight: { ...f, phase: 'briefing' } });
}

// Les deux equipes ont confirme « Je suis pret » -> lancement du mini-jeu
export function fightStart(set, get) {
  const f = get().showFight;
  if (!f || f.phase !== 'briefing') return;
  set({ showFight: { ...f, phase: 'minigame' } });
}

// Un mini-jeu signale le gagnant d'une manche
export function fightRoundWin(set, get, side) {
  const f = get().showFight;
  if (!f || f.phase !== 'minigame') return;
  const wins = { ...f.wins, [side]: f.wins[side] + 1 };
  const { teams, addLog } = get();
  const teamIdx = side === 'attacker' ? f.attackerIndex : f.defenderIndex;
  const t = teams[teamIdx] || f.boss; // côté boss : non-équipe
  addLog(tg('log.ft.round', { round: f.round, team: `${t.emoji} ${t.name}` }));

  if (wins[side] >= FIGHT_ROUNDS_TO_WIN) {
    addLog(tg('log.ft.duelWin', { team: `${t.emoji} ${t.name}` }));
    if (f.bossFight) { resolveBossOutcome(set, get, { ...f, wins, winnerSide: side }); return; }
    set({ showFight: { ...f, wins, winnerSide: side, phase: 'reward' } });
  } else {
    set({ showFight: { ...f, wins, round: f.round + 1 } });
  }
}

/**
 * Victoire directe du combat, annoncee par un mini-jeu a score cumulatif
 * (ex. Tour du monde : premier a 25 000 points) — sans passer par les manches.
 */
export function fightMatchWin(set, get, side) {
  const f = get().showFight;
  if (!f || f.phase !== 'minigame') return;
  const { teams, addLog } = get();
  const idx = side === 'attacker' ? f.attackerIndex : f.defenderIndex;
  const winner = teams[idx] || f.boss;
  addLog(tg('log.ft.duelWin', { team: `${winner.emoji} ${winner.name}` }));
  if (f.bossFight) { resolveBossOutcome(set, get, { ...f, wins: { ...f.wins, [side]: FIGHT_ROUNDS_TO_WIN }, winnerSide: side }); return; }
  set({ showFight: { ...f, wins: { ...f.wins, [side]: FIGHT_ROUNDS_TO_WIN }, winnerSide: side, phase: 'reward' } });
}

/**
 * Le vainqueur choisit sa recompense :
 * - 'steal'     : lance 2 des, vole autant de pieces au perdant
 * - 'knockback' : lance 1 de, le perdant recule d'autant
 * - 'loot'      : vole un objet au hasard au perdant (ou fouille le champ
 *                 de bataille si le perdant n'a rien)
 */
export function fightChooseReward(set, get, choice) {
  const f = get().showFight;
  if (!f || f.phase !== 'reward' || f.reward) return;

  // Le butin d'objet ne lance pas de des : application directe
  if (choice === 'loot') {
    set({ showFight: { ...f, reward: { choice, dice: [], rolling: false } } });
    setTimeout(() => applyFightReward(set, get), 500);
    return;
  }

  const diceCount = choice === 'steal' ? 2 : 1;
  const finals = Array.from({ length: diceCount }, () => 1 + Math.floor(Math.random() * 6));
  set({ showFight: { ...f, reward: { choice, dice: finals.map(() => 1), rolling: true } } });

  let count = 0;
  const interval = setInterval(() => {
    const cur = get().showFight;
    if (!cur || !cur.reward) { clearInterval(interval); return; }
    set({ showFight: { ...cur, reward: { ...cur.reward, dice: finals.map(() => 1 + Math.floor(Math.random() * 6)) } } });
    if (++count >= 10) {
      clearInterval(interval);
      const done = get().showFight;
      if (!done || !done.reward) return;
      set({ showFight: { ...done, reward: { ...done.reward, dice: finals, rolling: false } } });
      setTimeout(() => applyFightReward(set, get), 900);
    }
  }, 80);
}

function applyFightReward(set, get) {
  const f = get().showFight;
  if (!f || !f.reward || f.phase !== 'reward') return;
  const { teams, board, addLog } = get();
  const winnerIdx = f.winnerSide === 'attacker' ? f.attackerIndex : f.defenderIndex;
  const loserIdx = f.winnerSide === 'attacker' ? f.defenderIndex : f.attackerIndex;
  const winner = teams[winnerIdx];
  const loser = teams[loserIdx];
  const newTeams = [...teams];
  let message;
  let moves = null;

  if (f.reward.choice === 'loot') {
    // Pioche un objet au hasard chez le perdant : equipement ou sac
    // Filtre sur ITEMS : ignore les clés périmées d'anciennes sauvegardes
    const pool = [
      ...Object.entries(loser.equipment || {}).filter(([, k]) => ITEMS[cellKey(k)]).map(([slot, k]) => ({ kind: 'equipment', slot, key: cellKey(k) })),
      ...(loser.bag || []).map((c, i) => ({ kind: 'bag', index: i, key: cellKey(c) })).filter((e) => e.key && ITEMS[e.key]),
    ];

    if (pool.length === 0) {
      // Le perdant n'a rien : on fouille le champ de bataille
      const foundKey = pickLootItem(LOOT.fightLegendaryChance, get().enabledItems || Object.keys(ITEMS));
      if (!foundKey) {
        // Aucun objet active dans la partie : lot de consolation en pieces
        newTeams[winnerIdx] = { ...winner, money: winner.money + 10 };
        message = tg('log.ft.loot.none', { loser: `${loser.emoji} ${loser.name}`, winner: `${winner.emoji} ${winner.name}` });
      } else {
        const item = ITEMS[foundKey];
        const r = receiveItem(winner, foundKey);
        newTeams[winnerIdx] = r.team;
        message = tg('log.ft.loot.found', { loser: `${loser.emoji} ${loser.name}`, winner: `${winner.emoji} ${winner.name}`, icon: item.icon, item: locName(item), note: r.note });
      }
    } else {
      const picked = pool[Math.floor(Math.random() * pool.length)];
      const item = ITEMS[picked.key];
      if (picked.kind === 'equipment') {
        newTeams[loserIdx] = { ...loser, equipment: { ...loser.equipment, [picked.slot]: null } };
      } else {
        // Vole UNE unité de la pile (la case se libère à 0).
        const loserBag = normalizeBag(loser.bag);
        const cell = loserBag[picked.index];
        loserBag[picked.index] = cellN(cell) > 1 ? mkCell(cellKey(cell), cellN(cell) - 1) : null;
        newTeams[loserIdx] = { ...loser, bag: loserBag };
      }
      const r = receiveItem(winner, picked.key);
      newTeams[winnerIdx] = r.team;
      message = tg('log.ft.loot.steal', { winner: `${winner.emoji} ${winner.name}`, icon: item.icon, item: locName(item), loser: `${loser.emoji} ${loser.name}`, note: r.note });
    }
  } else if (f.reward.choice === 'steal') {
    // Equipement du vainqueur (fightStealBonus) puis protection du perdant (stealProtection)
    const total = f.reward.dice[0] + f.reward.dice[1] + getEffectValue(winner, 'fightStealBonus');
    const stolen = reducedSteal(loser, Math.min(total, loser.money ?? 0));
    newTeams[winnerIdx] = { ...winner, money: winner.money + stolen };
    newTeams[loserIdx] = { ...loser, money: loser.money - stolen };
    message = stolen > 0
      ? tgPlural('log.ft.steal.gold', stolen, { winner: `${winner.emoji} ${winner.name}`, loser: `${loser.emoji} ${loser.name}` })
      : tg('log.ft.steal.protected', { loser: `${loser.emoji} ${loser.name}` });
  } else {
    // Bouclier (bois + pouvoir) puis équipement du perdant : recul atténué.
    const rec = applyRecul(loser, board, f.reward.dice[0], extOn(get().extensions, 'mastery'));
    newTeams[loserIdx] = { ...loser, ...rec.patch };
    if (rec.path) {
      moves = [{ teamIndex: loserIdx, waypoints: rec.path.map((id) => ({ x: board[id].x, y: board[id].y })), type: 'back' }];
    }
    message = rec.applied > 0
      ? tgPlural('log.ft.knockback', rec.applied, { loser: `${loser.emoji} ${loser.name}`, reduced: rec.absorbedBy ? tg('log.ft.reduced') : '' })
      : (rec.absorbedBy === 'equip'
          ? tg('log.ft.knockback.equip', { loser: `${loser.emoji} ${loser.name}` })
          : tg('log.ft.knockback.shield', { loser: `${loser.emoji} ${loser.name}` }));
    // Réflexion (Bouclier L10 du perdant) : une partie du recul revient au vainqueur.
    if (rec.reflect > 0 && winnerIdx >= 0) {
      const w = newTeams[winnerIdx];
      const r2 = moveBack(board, w.pos, reducedRecul(w, rec.reflect));
      newTeams[winnerIdx] = { ...w, pos: r2.finalPos };
      if (r2.path.length > 1) moves = [...(moves || []), { teamIndex: winnerIdx, waypoints: r2.path.map((id) => ({ x: board[id].x, y: board[id].y })), type: 'back' }];
      message += tg('log.ft.reflect', { winner: winner.emoji });
    }
  }

  addLog(message);
  set({
    teams: newTeams,
    showFight: { ...f, phase: 'result', resultMessage: message },
    ...(moves ? { movePath: moves } : {}),
  });
}

export function closeFight(set, get) {
  const f = get().showFight;
  set({ showFight: null });

  // Déclencheurs d'équipement de duel : on:fightWin (gagnant) puis on:fightLose
  // (perdant). Chaque camp a son propre sourceTeam (≠ équipe courante), d'où
  // deux passes chaînées — la 2e (et la fin de tour) sont différées si un effet
  // ouvre un sélecteur (deferredTurnEnd, comme answerQuestion).
  let winnerIdx = -1, loserIdx = -1;
  if (f && f.winnerSide) {
    winnerIdx = f.winnerSide === 'attacker' ? f.attackerIndex : f.defenderIndex;
    loserIdx = f.winnerSide === 'attacker' ? f.defenderIndex : f.attackerIndex;
  }
  const teams = get().teams;
  const winActs = winnerIdx >= 0 ? equipTriggerActions(teams[winnerIdx], 'fightWin') : [];
  const loseActs = loserIdx >= 0 ? equipTriggerActions(teams[loserIdx], 'fightLose') : [];

  const endTurn = () => { if (!get().finished) { get().nextTurn(); if (get().phase === 'game') saveGame(get()); } };
  const runLose = () => {
    if (!loseActs.length) return endTurn();
    runEffects(set, get, loseActs, { source: 'item', sourceTeam: loserIdx });
    if (get().pendingActions) set({ deferredTurnEnd: endTurn }); else endTurn();
  };
  if (!winActs.length) return runLose();
  runEffects(set, get, winActs, { source: 'item', sourceTeam: winnerIdx });
  if (get().pendingActions) set({ deferredTurnEnd: runLose }); else runLose();
}
