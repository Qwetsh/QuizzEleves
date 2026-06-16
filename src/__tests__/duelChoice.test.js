// Tests : duel au choix de l'arrivant (mode non forcé) + toggle duels forcés.
import { describe, it, expect } from 'vitest';
import { useGameStore } from '../store/gameStore.js';

const S = () => useGameStore.getState();
const team = (i = 0) => S().teams[i];

// Plateau linéaire minimal : depart -> n1..n4 -> arrivee. n4 = case de matière.
const BOARD = (() => {
  const b = { depart: { x: 0, y: 0, type: 'depart', next: ['n1'] } };
  for (let i = 1; i <= 4; i++) b[`n${i}`] = { x: i, y: 0, type: 'subject', subject: 'maths', next: [i === 4 ? 'arrivee' : `n${i + 1}`] };
  b.arrivee = { x: 5, y: 0, type: 'arrivee', next: [] };
  return b;
})();

const mkTeam = (i, over = {}) => ({
  name: `T${i}`, emoji: '🦁', color: '#111', pos: 'n4', money: 10, correct: 0, wrong: 0,
  powers: {}, equipment: { head: null, body: null, feet: null }, bag: [], buffs: [], ...over,
});

function setup(forcedDuels, teamOver = [{}, {}]) {
  useGameStore.setState({
    phase: 'game', devSandbox: true,
    board: BOARD, teams: teamOver.map((o, i) => mkTeam(i, o)),
    currentTeam: 0, finished: false, forcedDuels,
    questions: { maths: [{ q: 'M ?', a: ['a', 'b', 'c', 'd'], c: 0 }] }, askedQuestions: {},
    log: [], enabledEvents: [],
    showQuestion: null, showEvent: null, showFight: null, showDuelChoice: null,
    trapDepth: 0,
  });
}

describe('duel au choix (forcedDuels = false)', () => {
  it('arriver sur une case occupée propose un choix (pas de duel auto)', () => {
    setup(false);
    S().handleLanding();
    expect(S().showFight).toBeNull();
    expect(S().showDuelChoice).not.toBeNull();
    expect(S().showDuelChoice.defenders).toEqual([1]);
  });

  it('chooseDuel lance le combat contre la cible', () => {
    setup(false);
    S().handleLanding();
    S().chooseDuel(1);
    expect(S().showDuelChoice).toBeNull();
    expect(S().showFight).not.toBeNull();
  });

  it('declineDuel → joue la case normalement (question)', () => {
    setup(false);
    S().handleLanding();
    S().declineDuel();
    expect(S().showDuelChoice).toBeNull();
    expect(S().showFight).toBeNull();
    expect(S().showQuestion).not.toBeNull();
    expect(S().showQuestion.subject).toBe('maths');
  });

  it('plusieurs équipes présentes → toutes proposées comme cibles', () => {
    setup(false, [{}, {}, {}]); // 3 équipes toutes sur n4
    S().handleLanding();
    expect(S().showDuelChoice.defenders).toEqual([1, 2]);
  });

  it('chooseDuel ignore une cible non présente dans la liste', () => {
    setup(false);
    S().handleLanding();
    S().chooseDuel(5); // index invalide
    expect(S().showFight).toBeNull();
    expect(S().showDuelChoice).not.toBeNull();
  });
});

describe('duels forcés (forcedDuels = true)', () => {
  it('duel automatique, sans choix', () => {
    setup(true);
    S().handleLanding();
    expect(S().showDuelChoice).toBeNull();
    expect(S().showFight).not.toBeNull();
  });
});

describe('immunité', () => {
  it('arrivant immunisé → pas de duel, joue la case', () => {
    setup(false, [{ buffs: [{ type: 'duelImmune', turns: 2 }] }, {}]);
    S().handleLanding();
    expect(S().showDuelChoice).toBeNull();
    expect(S().showFight).toBeNull();
    expect(S().showQuestion).not.toBeNull();
  });

  it('seul défenseur immunisé → exclu, pas de duel', () => {
    setup(false, [{}, { buffs: [{ type: 'duelImmune', turns: 2 }] }]);
    S().handleLanding();
    expect(S().showDuelChoice).toBeNull();
    expect(S().showQuestion).not.toBeNull();
  });

  it('mix : la cible immunisée est listée comme bloquée (non défiable)', () => {
    setup(false, [{}, {}, { buffs: [{ type: 'duelImmune', turns: 2 }] }]);
    S().handleLanding();
    expect(S().showDuelChoice.defenders).toEqual([1]);
    expect(S().showDuelChoice.blocked).toEqual([2]);
    // chooseDuel refuse une cible bloquée
    S().chooseDuel(2);
    expect(S().showFight).toBeNull();
    expect(S().showDuelChoice).not.toBeNull();
  });
});
