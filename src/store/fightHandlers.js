import { moveBack } from '../logic/pathfinding.js';
import { saveGame } from './persistence.js';

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
      phase: 'versus',          // versus -> minigame -> reward -> result
      round: 1,
      wins: { attacker: 0, defender: 0 },
      winnerSide: null,
      reward: null,             // { choice, dice, rolling }
      resultMessage: null,
    },
  });
}

// Fin de l'ecran de presentation versus
export function fightBegin(set, get) {
  const f = get().showFight;
  if (!f || f.phase !== 'versus') return;
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
 * Le vainqueur choisit sa recompense :
 * - 'steal'     : lance 2 des, vole autant de pieces au perdant
 * - 'knockback' : lance 1 de, le perdant recule d'autant
 */
export function fightChooseReward(set, get, choice) {
  const f = get().showFight;
  if (!f || f.phase !== 'reward' || f.reward) return;

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

  if (f.reward.choice === 'steal') {
    const total = f.reward.dice[0] + f.reward.dice[1];
    const stolen = Math.min(total, loser.money ?? 0);
    newTeams[winnerIdx] = { ...winner, money: winner.money + stolen };
    newTeams[loserIdx] = { ...loser, money: loser.money - stolen };
    message = `\u{1F4B0} ${winner.emoji} ${winner.name} pille ${stolen} pièce${stolen > 1 ? 's' : ''} à ${loser.emoji} ${loser.name} !`;
  } else {
    const n = f.reward.dice[0];
    const r = moveBack(board, loser.pos, n);
    newTeams[loserIdx] = { ...loser, pos: r.finalPos };
    if (r.path.length > 1) {
      moves = [{ teamIndex: loserIdx, waypoints: r.path.map((id) => ({ x: board[id].x, y: board[id].y })), type: 'back' }];
    }
    message = `⬅️ ${loser.emoji} ${loser.name} est repoussé de ${n} case${n > 1 ? 's' : ''} !`;
  }

  addLog(message);
  set({
    teams: newTeams,
    showFight: { ...f, phase: 'result', resultMessage: message },
    ...(moves ? { movePath: moves } : {}),
  });
}

export function closeFight(set, get) {
  set({ showFight: null });
  get().nextTurn();
  if (get().phase === 'game') saveGame(get());
}
