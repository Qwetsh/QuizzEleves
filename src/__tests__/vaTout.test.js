// Tests : événement « Le Va-tout » (quitte-ou-double accumulé).
import { describe, it, expect } from 'vitest';
import { useGameStore } from '../store/gameStore.js';

const S = () => useGameStore.getState();

const BOARD = (() => {
  const b = { depart: { x: 0, y: 0, type: 'depart', next: ['n1'] } };
  for (let i = 1; i <= 8; i++) b[`n${i}`] = { x: i, y: 0, type: 'subject', subject: 'maths', next: [i === 8 ? 'arrivee' : `n${i + 1}`] };
  b.arrivee = { x: 9, y: 0, type: 'arrivee', next: [] };
  return b;
})();

function setup(data, money = 30) {
  useGameStore.setState({
    phase: 'game', devSandbox: true, board: BOARD, finished: false, currentTeam: 0, log: [],
    teams: [{ name: 'T', emoji: '🦁', color: '#111', money, pos: 'n4', equipment: { head: null, body: null, feet: null }, bag: [], powers: {} }],
    eventApplied: false, movePath: null, pendingEventQuestion: null,
    showEvent: { key: 'vaTout', event: { name: 'Le Va-tout', icon: '🎰' }, phase: 'question', data },
  });
}

describe('vaTout', () => {
  it('bonne réponse : la mise grossit (+5 puis +10) sans verser l’or, et propose le choix', () => {
    setup({ questionResult: true, vaToutStreak: 0, vaToutPot: 0 });
    S().applyEventEffect();
    let ev = S().showEvent;
    expect(ev.phase).toBe('vaToutChoice');
    expect(ev.data.vaToutPot).toBe(5);
    expect(ev.data.vaToutStreak).toBe(1);
    expect(S().teams[0].money).toBe(30); // pas encore versé

    // continuer + nouvelle bonne réponse → +10 (mise 15)
    useGameStore.setState({ eventApplied: false, showEvent: { ...ev, phase: 'question', data: { ...ev.data, questionResult: true } } });
    S().applyEventEffect();
    ev = S().showEvent;
    expect(ev.data.vaToutPot).toBe(15);
    expect(ev.data.vaToutStreak).toBe(2);
  });

  it('mauvaise réponse : mise perdue + recul (≥1 case) + phase résultat', () => {
    setup({ questionResult: false, vaToutStreak: 2, vaToutPot: 15 });
    S().applyEventEffect();
    expect(S().teams[0].money).toBe(30);          // jamais versé → rien perdu du trésor
    expect(S().teams[0].pos).not.toBe('n4');       // a reculé
    expect(S().showEvent.phase).toBe('result');
  });

  it('encaisser : verse la mise accumulée', () => {
    setup({ vaToutStreak: 2, vaToutPot: 15 });
    useGameStore.setState({ showEvent: { ...S().showEvent, phase: 'vaToutChoice' } });
    S().eventVaToutCashOut();
    expect(S().teams[0].money).toBe(45); // 30 + 15
    expect(S().showEvent.phase).toBe('result');
  });
});
