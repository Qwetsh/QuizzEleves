// Instrumentation analytique du store : answerQuestion / timeoutQuestion / recordStat
// alimentent gameStats (source du dashboard d'analyse + onglet mobile « questions »).
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { SUBJECT_KEYS } from '../data/subjects.js';

const S = () => useGameStore.getState();

const BOARD = (() => {
  const b = { depart: { x: 0, y: 0, type: 'depart', next: ['n1'] } };
  for (let i = 1; i <= 8; i++) b[`n${i}`] = { x: i, y: 0, type: 'subject', subject: 'maths', next: [i === 8 ? 'arrivee' : `n${i + 1}`] };
  b.arrivee = { x: 9, y: 0, type: 'arrivee', next: [] };
  return b;
})();

const QUESTIONS = Object.fromEntries(SUBJECT_KEYS.map((k) => [k, [
  { q: 'Q ?', a: ['A', 'B', 'C', 'D'], c: 0, e: 'Explication', t: 'Thème', level: '6e' },
  { q: 'Q2 ?', a: ['A', 'B', 'C', 'D'], c: 1, e: 'Explication 2', t: 'Thème' },
]]));

function mkTeam(i, over = {}) {
  return {
    name: `T${i}`, emoji: '🦁', color: '#111', pos: 'n4',
    correct: 0, wrong: 0, money: 50, powers: {},
    equipment: { head: null, body: null, feet: null }, bag: [], ...over,
  };
}

function freshGame() {
  useGameStore.setState({
    phase: 'game', devSandbox: true,
    teams: [mkTeam(0), mkTeam(1)], currentTeam: 0, board: BOARD, finished: false,
    askedQuestions: {}, questions: QUESTIONS, log: [],
    rolling: false, pendingLanding: false, awaitingChoice: false, pendingActions: null,
    showQuestion: null, showEvent: null, showFight: null, showDuelChoice: null, showTargetPicker: null,
    indiceUsed: false, indiceHidden: [], shopStock: [], shopStockTurns: 10, movePath: null,
    preRollPos: null, preRollValue: 2,
    gameStats: { startedAt: null, classLabel: '6eB', subjects: ['maths'], level: [], answers: [], itemUses: [], powerUses: [] },
    statsArchived: false,
    // Loot de bonne réponse neutralisé (tirages Math.random → LootReveal qui
    // diffère nextTurn = tests flaky). Catalogue vide : aucun drop possible.
    enabledItems: [],
  });
}

describe('gameStats : instrumentation des réponses', () => {
  beforeEach(freshGame);

  it('enregistre une bonne réponse (matière, indices cohérents, explication)', () => {
    S().askQuestion('maths');
    const q = S().showQuestion.question; // question réellement posée (déjà mélangée)
    const c = q.c;
    S().answerQuestion(c, 20);
    const a = S().gameStats.answers;
    expect(a).toHaveLength(1);
    expect(a[0].correct).toBe(true);
    expect(a[0].timedOut).toBe(false);
    expect(a[0].subject).toBe('maths');
    expect(a[0].chosenIndex).toBe(c);
    expect(a[0].correctIndex).toBe(c);
    expect(a[0].explanation).toBe(q.e);   // trace fidèle à la question posée
    expect(a[0].qText).toBe(q.q);
    expect(a[0].answers).toEqual(q.a);
  });

  it('enregistre une mauvaise réponse', () => {
    S().askQuestion('maths');
    const c = S().showQuestion.question.c;
    const wrong = (c + 1) % 4;
    S().answerQuestion(wrong, 10);
    const a = S().gameStats.answers;
    expect(a).toHaveLength(1);
    expect(a[0].correct).toBe(false);
    expect(a[0].chosenIndex).toBe(wrong);
  });

  it('enregistre une question expirée (timeout)', () => {
    S().askQuestion('maths');
    S().timeoutQuestion();
    const a = S().gameStats.answers;
    expect(a).toHaveLength(1);
    expect(a[0].timedOut).toBe(true);
    expect(a[0].correct).toBe(false);
    expect(a[0].chosenIndex).toBeNull();
  });
});

describe('recordStat : usages objets/pouvoirs', () => {
  beforeEach(freshGame);

  it('ajoute des entrées avec seq + horodatage', () => {
    S().recordStat('itemUses', { teamIdx: 0, key: 'epee' });
    S().recordStat('powerUses', { teamIdx: 0, powerKey: 'foudre', targetIdx: 1 });
    expect(S().gameStats.itemUses[0]).toMatchObject({ key: 'epee', seq: 0 });
    expect(typeof S().gameStats.itemUses[0].at).toBe('string');
    expect(S().gameStats.powerUses[0]).toMatchObject({ powerKey: 'foudre', targetIdx: 1 });
  });

  it('catégorie inconnue : no-op', () => {
    const before = S().gameStats;
    S().recordStat('inconnu', { x: 1 });
    expect(S().gameStats).toBe(before);
  });
});
