import { pickQuestion, shuffleAnswers } from '../logic/questionPicker.js';

const testQuestions = [
  { text: 'Q1', answer: 'A1' },
  { text: 'Q2', answer: 'A2' },
  { text: 'Q3', answer: 'A3' },
];

describe('pickQuestion', () => {
  it('returns a question from the pool', () => {
    const askedSet = new Set();
    const result = pickQuestion(testQuestions, askedSet);
    expect(result).not.toBeNull();
    expect(result.question).toBe(testQuestions[result.index]);
    expect(result.index).toBeGreaterThanOrEqual(0);
    expect(result.index).toBeLessThan(testQuestions.length);
  });

  it('avoids already asked questions', () => {
    const askedSet = new Set([0, 1]);
    const result = pickQuestion(testQuestions, askedSet);
    expect(result.index).toBe(2);
    expect(result.question).toBe(testQuestions[2]);
  });

  it('returns null when questions array is empty', () => {
    const result = pickQuestion([], new Set());
    expect(result).toBeNull();
  });

  it('returns null when questions is null', () => {
    const result = pickQuestion(null, new Set());
    expect(result).toBeNull();
  });

  it('wraps around when all questions have been asked', () => {
    const askedSet = new Set([0, 1, 2]);
    const result = pickQuestion(testQuestions, askedSet);
    expect(result).not.toBeNull();
    expect(result.question).toBe(testQuestions[result.index]);
    // newAsked should contain only the new pick (reset cycle)
    expect(result.newAsked.size).toBe(1);
    // original set should NOT be mutated
    expect(askedSet.size).toBe(3);
  });

  it('adds the picked index to newAsked', () => {
    const askedSet = new Set();
    const result = pickQuestion(testQuestions, askedSet);
    expect(result.newAsked.has(result.index)).toBe(true);
    // original set should NOT be mutated
    expect(askedSet.size).toBe(0);
  });
});

describe('shuffleAnswers', () => {
  const q = { q: 'Capitale de la France ?', a: ['Lyon', 'Paris', 'Nice', 'Lille'], c: 1, e: 'x' };

  it('keeps the correct answer text aligned with the new index', () => {
    for (let i = 0; i < 200; i++) {
      const s = shuffleAnswers(q);
      expect(s.a[s.c]).toBe('Paris');
      expect([...s.a].sort()).toEqual([...q.a].sort());
    }
  });

  it('varies the position of the correct answer across picks', () => {
    const positions = new Set();
    for (let i = 0; i < 200; i++) positions.add(shuffleAnswers(q).c);
    expect(positions.size).toBeGreaterThan(1);
  });

  it('does not mutate the original question', () => {
    shuffleAnswers(q);
    expect(q.a).toEqual(['Lyon', 'Paris', 'Nice', 'Lille']);
    expect(q.c).toBe(1);
  });

  it('returns the question unchanged when it has no answers array', () => {
    const weird = { text: 'no answers' };
    expect(shuffleAnswers(weird)).toBe(weird);
  });
});
