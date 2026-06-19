// Agrégation analytique (pure) pour le dashboard d'analyse.
import { describe, it, expect } from 'vitest';
import { computeGameReport, computeClassTrends } from '../logic/statsAggregate.js';

const STATS = {
  subjects: ['maths', 'francais'],
  answers: [
    { teamIdx: 0, teamName: 'A', subject: 'maths', theme: 'Fractions', level: '6e', correct: true, timedOut: false, timeLeftRatio: 80, qText: 'Q1', answers: ['x', 'y'], correctIndex: 0 },
    { teamIdx: 0, teamName: 'A', subject: 'maths', theme: 'Fractions', level: '6e', correct: false, timedOut: false, timeLeftRatio: 20, qText: 'Q1', answers: ['x', 'y'], correctIndex: 0 },
    { teamIdx: 1, teamName: 'B', subject: 'francais', theme: 'Grammaire', level: '6e', correct: false, timedOut: true, timeLeftRatio: 0, qText: 'Q2', answers: ['a', 'b'], correctIndex: 1, explanation: 'parce que' },
  ],
  itemUses: [{ teamIdx: 0, key: 'potion' }, { teamIdx: 1, key: 'potion' }, { teamIdx: 0, key: 'epee' }],
  powerUses: [{ teamIdx: 0, powerKey: 'foudre' }, { teamIdx: 1, powerKey: 'indice' }, { teamIdx: 0, powerKey: 'foudre' }],
};

describe('computeGameReport', () => {
  const r = computeGameReport(STATS);

  it('totaux globaux', () => {
    expect(r.totals.answered).toBe(3);
    expect(r.totals.correct).toBe(1);
    expect(r.totals.wrong).toBe(2);
    expect(r.totals.timedOut).toBe(1);
    expect(r.totals.rate).toBe(33);
  });

  it('réussite par matière', () => {
    const maths = r.bySubject.find((s) => s.subject === 'maths');
    expect(maths.answered).toBe(2);
    expect(maths.rate).toBe(50);
    expect(r.bySubject.find((s) => s.subject === 'francais').rate).toBe(0);
  });

  it('classement des équipes (par taux)', () => {
    expect(r.byTeam[0].teamName).toBe('A');
    expect(r.byTeam[0].rate).toBe(50);
    expect(r.byTeam[1].rate).toBe(0);
  });

  it('questions les plus ratées en premier, avec explication', () => {
    expect(r.hardestQuestions[0].qText).toBe('Q2');
    expect(r.hardestQuestions[0].rate).toBe(0);
    expect(r.hardestQuestions[0].explanation).toBe('parce que');
    const q1 = r.hardestQuestions.find((q) => q.qText === 'Q1');
    expect(q1.asked).toBe(2);
    expect(q1.rate).toBe(50);
  });

  it('compteurs objets/pouvoirs triés', () => {
    expect(r.itemUses[0]).toEqual({ itemKey: 'potion', count: 2 });
    expect(r.powerUses[0]).toEqual({ powerKey: 'foudre', count: 2 });
  });

  it('robuste sur données vides', () => {
    const empty = computeGameReport({});
    expect(empty.totals.answered).toBe(0);
    expect(empty.totals.rate).toBe(0);
    expect(empty.bySubject).toEqual([]);
  });
});

describe('computeClassTrends', () => {
  const rows = [
    { id: 'g1', ended_at: '2026-06-01T10:00:00Z', class_label: '6eB', subjects: ['maths'], data: { answers: [
      { subject: 'maths', qText: 'Q1', correct: true }, { subject: 'maths', qText: 'Q1', correct: false },
    ] } },
    { id: 'g2', ended_at: '2026-06-10T10:00:00Z', class_label: '6eB', subjects: ['maths'], data: { answers: [
      { subject: 'maths', qText: 'Q1', correct: true }, { subject: 'maths', qText: 'Q1', correct: true },
    ] } },
  ];
  const t = computeClassTrends(rows);

  it('sessions chronologiques avec taux', () => {
    expect(t.sessions.map((s) => s.id)).toEqual(['g1', 'g2']);
    expect(t.sessions[0].rate).toBe(50);
    expect(t.sessions[1].rate).toBe(100);
  });

  it('maîtrise par matière agrégée + total', () => {
    const maths = t.subjectMastery.find((s) => s.subject === 'maths');
    expect(maths.answered).toBe(4);
    expect(maths.correct).toBe(3);
    expect(maths.rate).toBe(75);
    expect(t.totals.games).toBe(2);
    expect(t.totals.rate).toBe(75);
  });

  it('questions récurrentes : Q1 agrégée sur les 2 parties', () => {
    const q1 = t.recurringHard.find((q) => q.qText === 'Q1');
    expect(q1.asked).toBe(4);
    expect(q1.correct).toBe(3);
  });
});
