// Tests : combat de BOSS (le Prof) — adversaire virtuel + issue fixe.
import { describe, it, expect } from 'vitest';
import { useGameStore } from '../store/gameStore.js';

const S = () => useGameStore.getState();

const BOARD = (() => {
  const b = { depart: { x: 0, y: 0, type: 'depart', next: ['n1'] } };
  for (let i = 1; i <= 8; i++) b[`n${i}`] = { x: i, y: 0, type: 'subject', subject: 'maths', next: [i === 8 ? 'arrivee' : `n${i + 1}`] };
  b.arrivee = { x: 9, y: 0, type: 'arrivee', next: [] };
  return b;
})();

function setup() {
  useGameStore.setState({
    phase: 'game', devSandbox: true, board: BOARD, finished: false, currentTeam: 0, log: [],
    teams: [{ name: 'T', emoji: '🦁', color: '#111', money: 20, pos: 'n4', equipment: { head: null, body: null, feet: null }, bag: [], powers: {}, correct: 0, wrong: 0, streak: 0 }],
    showFight: null, showStarterChest: false,
  });
}

describe('combat de boss', () => {
  it('startBossFight : adversaire virtuel (defenderIndex -1, bossFight)', () => {
    setup();
    S().startBossFight('maths');
    const f = S().showFight;
    expect(f.bossFight).toBe(true);
    expect(f.defenderIndex).toBe(-1);
    expect(f.boss?.name).toBeTruthy();
    expect(f.attackerIndex).toBe(0);
  });

  it('victoire de l’équipe : +50 or + un objet, phase résultat', () => {
    setup();
    S().startBossFight('maths');
    useGameStore.setState({ showFight: { ...S().showFight, phase: 'minigame', wins: { attacker: 1, defender: 0 } } });
    S().fightRoundWin('attacker');
    expect(S().showFight.phase).toBe('result');
    expect(S().teams[0].money).toBe(70); // 20 + 50 (l'objet va en équipement/sac, pas en or)
  });

  it('défaite : recul (la position change), phase résultat', () => {
    setup();
    S().startBossFight('maths');
    useGameStore.setState({ showFight: { ...S().showFight, phase: 'minigame', wins: { attacker: 0, defender: 1 } } });
    S().fightRoundWin('defender');
    expect(S().showFight.phase).toBe('result');
    expect(S().teams[0].pos).not.toBe('n4'); // a reculé
    expect(S().teams[0].money).toBe(20);     // pas de perte d'or
  });

  it('closeFight après un boss ne plante pas et libère le combat', () => {
    setup();
    S().startBossFight('maths');
    useGameStore.setState({ showFight: { ...S().showFight, phase: 'result', winnerSide: 'attacker' } });
    expect(() => S().closeFight()).not.toThrow();
    expect(S().showFight).toBeNull();
  });
});
