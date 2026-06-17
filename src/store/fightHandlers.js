import { getEffectValue, reducedSteal } from '../logic/itemEffects.js';
import { applyRecul } from '../logic/turnHelpers.js';
import { ITEMS } from '../data/items.js';
import { pickLootItem, placeItem, normalizeBag, cellKey, cellN, mkCell } from './itemHandlers.js';
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
  addLog(`👨‍🏫 ${att.emoji} ${att.name} défie LE PROF dans un combat de boss !`);
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
    message = `🏆 ${team.emoji} ${team.name} terrasse le Prof ! +${gold} \u{1F4B0}${lootKey ? ` et ${ITEMS[lootKey].icon} ${ITEMS[lootKey].name}${note}` : ''} !`;
  } else {
    const dv = Math.floor(Math.random() * 10) + 1;
    const rec = applyRecul(team, board, dv); // bouclier + équipement protègent du recul
    newTeams[idx] = { ...team, ...rec.patch };
    if (rec.path) moves = [{ teamIndex: idx, waypoints: rec.path.map((id) => ({ x: board[id].x, y: board[id].y })), type: 'back' }];
    message = rec.applied > 0
      ? `👨‍🏫 Le Prof l'emporte ! ${team.emoji} ${team.name} recule de ${rec.applied} case${rec.applied > 1 ? 's' : ''}${rec.absorbedBy ? ' (réduit)' : ''}.`
      : `👨‍🏫 Le Prof l'emporte ! \u{1F6E1}️ ${team.emoji} ${team.name} encaisse mais le recul est absorbé !`;
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
  addLog(`⚔️ Manche ${f.round} pour ${t.emoji} ${t.name} !`);

  if (wins[side] >= FIGHT_ROUNDS_TO_WIN) {
    addLog(`\u{1F3C5} ${t.emoji} ${t.name} remporte le duel !`);
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
  addLog(`\u{1F3C5} ${winner.emoji} ${winner.name} remporte le duel !`);
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
      ...Object.entries(loser.equipment || {}).filter(([, k]) => k && ITEMS[k]).map(([slot, k]) => ({ kind: 'equipment', slot, key: k })),
      ...(loser.bag || []).map((c, i) => ({ kind: 'bag', index: i, key: cellKey(c) })).filter((e) => e.key && ITEMS[e.key]),
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
        // Vole UNE unité de la pile (la case se libère à 0).
        const loserBag = normalizeBag(loser.bag);
        const cell = loserBag[picked.index];
        loserBag[picked.index] = cellN(cell) > 1 ? mkCell(cellKey(cell), cellN(cell) - 1) : null;
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
    // Bouclier (bois + pouvoir) puis équipement du perdant : recul atténué.
    const rec = applyRecul(loser, board, f.reward.dice[0]);
    newTeams[loserIdx] = { ...loser, ...rec.patch };
    if (rec.path) {
      moves = [{ teamIndex: loserIdx, waypoints: rec.path.map((id) => ({ x: board[id].x, y: board[id].y })), type: 'back' }];
    }
    message = rec.applied > 0
      ? `⬅️ ${loser.emoji} ${loser.name} est repoussé de ${rec.applied} case${rec.applied > 1 ? 's' : ''}${rec.absorbedBy ? ' (réduit)' : ''} !`
      : (rec.absorbedBy === 'equip'
          ? `\u{1F392} L'équipement de ${loser.emoji} ${loser.name} absorbe le recul !`
          : `\u{1F6E1}️ ${loser.emoji} ${loser.name} absorbe le recul avec son bouclier !`);
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
