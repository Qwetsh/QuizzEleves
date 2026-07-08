import { describe, it, expect } from 'vitest';
import { raceOutcomeOnAnswer, raceOutcomeOnTimeout, otherSide } from '../logic/duelRace.js';

describe('duelRace', () => {
  it('réponse juste → win (le premier juste gagne la manche)', () => {
    expect(raceOutcomeOnAnswer({ index: 2, correctIndex: 2, otherAnswered: false })).toBe('win');
    expect(raceOutcomeOnAnswer({ index: 2, correctIndex: 2, otherAnswered: true })).toBe('win');
  });

  it('faux, l’autre n’a pas répondu → wait', () => {
    expect(raceOutcomeOnAnswer({ index: 0, correctIndex: 2, otherAnswered: false })).toBe('wait');
  });

  it('faux, l’autre a déjà répondu (faux) → replay', () => {
    expect(raceOutcomeOnAnswer({ index: 1, correctIndex: 2, otherAnswered: true })).toBe('replay');
  });

  it('timeout → replay', () => {
    expect(raceOutcomeOnTimeout()).toBe('replay');
  });

  it('otherSide', () => {
    expect(otherSide('attacker')).toBe('defender');
    expect(otherSide('defender')).toBe('attacker');
  });
});
