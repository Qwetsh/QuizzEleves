import { calculateMoneyGain, canAfford } from '../logic/moneyCalculator.js';

describe('calculateMoneyGain', () => {
  it('returns 0 when timeLeft is 0', () => {
    expect(calculateMoneyGain(0, 30)).toBe(0);
  });

  it('returns 0 when timeLeft is negative', () => {
    expect(calculateMoneyGain(-5, 30)).toBe(0);
  });

  it('returns 2 for ratio < 0.2 (e.g. 3/30 = 0.1)', () => {
    expect(calculateMoneyGain(3, 30)).toBe(2);
  });

  it('returns 4 for ratio >= 0.2 and < 0.4 (e.g. 9/30 = 0.3)', () => {
    expect(calculateMoneyGain(9, 30)).toBe(4);
  });

  it('returns 6 for ratio >= 0.4 and < 0.6 (e.g. 15/30 = 0.5)', () => {
    expect(calculateMoneyGain(15, 30)).toBe(6);
  });

  it('returns 8 for ratio >= 0.6 and < 0.8 (e.g. 21/30 = 0.7)', () => {
    expect(calculateMoneyGain(21, 30)).toBe(8);
  });

  it('returns 10 for ratio >= 0.8 (e.g. 27/30 = 0.9)', () => {
    expect(calculateMoneyGain(27, 30)).toBe(10);
  });

  it('uses default maxTime of 30', () => {
    expect(calculateMoneyGain(30)).toBe(10);
  });
});

describe('canAfford', () => {
  it('returns true when money equals price', () => {
    expect(canAfford(10, 10)).toBe(true);
  });

  it('returns true when money exceeds price', () => {
    expect(canAfford(15, 10)).toBe(true);
  });

  it('returns false when money is less than price', () => {
    expect(canAfford(5, 10)).toBe(false);
  });

  it('returns true for free items (price 0)', () => {
    expect(canAfford(0, 0)).toBe(true);
  });
});
