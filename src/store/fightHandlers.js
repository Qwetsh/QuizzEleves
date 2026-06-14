import { moveBack } from '../logic/pathfinding.js';
import { getEffectValue, reducedRecul, reducedSteal } from '../logic/itemEffects.js';
import { ITEMS } from '../data/items.js';
import { pickLootItem, placeItem, normalizeBag } from './itemHandlers.js';
import { equipTriggerActions, runEffects } from './effectEngine.js';
import { LOOT } from '../logic/balanceConfig.js';
import { saveGame } from './persistence.js';

// Transfere un objet vers une equipe (cascade unique placeItem) et formate
// la note de butin. Retourne { team: updatedTeam, note: string }.
function receiveItem(team, itemKey) {
  const r = placeItem(team, itemKey);
  const note = r.outcome === 'equipped'
    ? ' (équipé)'
    : r.outcome === 'refunded'
      ? ` (sac plein : revendu +${r.refund} \u{1F4B0})`
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
  addLog(`⚔️ ${att.emoji} ${att.name} défie ${def.emoji} ${def.name} en duel !`);
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
  const t = teams[teamIdx];
  addLog(`⚔️ Manche ${f.round} pour ${t.emoji} ${t.name} !`);

  if (wins[side] >= FIGHT_ROUNDS_TO_WIN) {
    const winner = teams[teamIdx];
    addLog(`\u{1F3C5} ${winner.emoji} ${winner.name} remporte le duel !`);
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
  const winner = teams[idx];
  addLog(`\u{1F3C5} ${winner.emoji} ${winner.name} remporte le duel !`);
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
      ...Object.entries(loser.equipment || {}).filter(([, k]) => k && ITEMS[k]).map(([slot, k]) => ({ kind: 'equipment', slot, key: k })),
      ...(loser.bag || []).map((k, i) => ({ kind: 'bag', index: i, key: k })).filter((e) => e.key && ITEMS[e.key]),
    ];

    if (pool.length === 0) {
      // Le perdant n'a rien : on fouille le champ de bataille
      const foundKey = pickLootItem(LOOT.fightLegendaryChance, get().enabledItems || Object.keys(ITEMS));
      if (!foundKey) {
        // Aucun objet active dans la partie : lot de consolation en pieces
        newTeams[winnerIdx] = { ...winner, money: winner.money + 10 };
        message = `\u{1F9F0} ${loser.emoji} ${loser.name} n'a aucun objet... ${winner.emoji} ${winner.name} ramasse 10 \u{1F4B0} sur le champ de bataille !`;
      } else {
        const item = ITEMS[foundKey];
        const r = receiveItem(winner, foundKey);
        newTeams[winnerIdx] = r.team;
        message = `\u{1F9F0} ${loser.emoji} ${loser.name} n'a aucun objet... ${winner.emoji} ${winner.name} fouille le champ de bataille et trouve ${item.icon} ${item.name} !${r.note}`;
      }
    } else {
      const picked = pool[Math.floor(Math.random() * pool.length)];
      const item = ITEMS[picked.key];
      if (picked.kind === 'equipment') {
        newTeams[loserIdx] = { ...loser, equipment: { ...loser.equipment, [picked.slot]: null } };
      } else {
        const loserBag = normalizeBag(loser.bag);
        loserBag[picked.index] = null;
        newTeams[loserIdx] = { ...loser, bag: loserBag };
      }
      const r = receiveItem(winner, picked.key);
      newTeams[winnerIdx] = r.team;
      message = `\u{1F392} ${winner.emoji} ${winner.name} pille ${item.icon} ${item.name} à ${loser.emoji} ${loser.name} !${r.note}`;
    }
  } else if (f.reward.choice === 'steal') {
    // Equipement du vainqueur (fightStealBonus) puis protection du perdant (stealProtection)
    const total = f.reward.dice[0] + f.reward.dice[1] + getEffectValue(winner, 'fightStealBonus');
    const stolen = reducedSteal(loser, Math.min(total, loser.money ?? 0));
    newTeams[winnerIdx] = { ...winner, money: winner.money + stolen };
    newTeams[loserIdx] = { ...loser, money: loser.money - stolen };
    message = stolen > 0
      ? `\u{1F4B0} ${winner.emoji} ${winner.name} pille ${stolen} pièce${stolen > 1 ? 's' : ''} à ${loser.emoji} ${loser.name} !`
      : `\u{1F9B9} ${loser.emoji} ${loser.name} protège ses pièces : rien à piller !`;
  } else {
    // Equipement du perdant (reculReduction) : recul attenue
    const n = reducedRecul(loser, f.reward.dice[0]);
    const r = moveBack(board, loser.pos, n);
    newTeams[loserIdx] = { ...loser, pos: r.finalPos };
    if (r.path.length > 1) {
      moves = [{ teamIndex: loserIdx, waypoints: r.path.map((id) => ({ x: board[id].x, y: board[id].y })), type: 'back' }];
    }
    message = n > 0
      ? `⬅️ ${loser.emoji} ${loser.name} est repoussé de ${n} case${n > 1 ? 's' : ''} !`
      : `\u{1F392} L'équipement de ${loser.emoji} ${loser.name} absorbe le recul !`;
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
