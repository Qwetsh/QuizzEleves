import { pickQuestion } from '../logic/questionPicker.js';

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
    // askedSet should have been cleared and now contains only the new pick
    expect(askedSet.size).toBe(1);
  });

  it('adds the picked index to the asked set', () => {
    const askedSet = new Set();
    const result = pickQuestion(testQuestions, askedSet);
    expect(askedSet.has(result.index)).toBe(true);
  });
});
