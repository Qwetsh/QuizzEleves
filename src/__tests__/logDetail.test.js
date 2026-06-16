// Tests : helpers du journal structuré (logFormat) + détail des effets
// (explainEffectValue).
import { describe, it, expect } from 'vitest';
import { logText, logDetail, signed } from '../logic/logFormat.js';
import { explainEffectValue } from '../logic/itemEffects.js';

const mkTeam = (over = {}) => ({
  equipment: { head: null, body: null, feet: null }, bag: [], powers: {},
  correct: 0, wrong: 0, streak: 0, ...over,
});

describe('logFormat', () => {
  it('logText lit chaîne ou objet', () => {
    expect(logText('coucou')).toBe('coucou');
    expect(logText({ text: 'salut', detail: [] })).toBe('salut');
    expect(logText(null)).toBe('');
  });

  it('logDetail ne renvoie un tableau que s’il y a du détail', () => {
    expect(logDetail('x')).toBeNull();
    expect(logDetail({ text: 'x' })).toBeNull();
    expect(logDetail({ text: 'x', detail: [] })).toBeNull();
    expect(logDetail({ text: 'x', detail: [{ label: 'a', amount: 1 }] })).toHaveLength(1);
  });

  it('signed affiche le bon signe', () => {
    expect(signed(6)).toBe('+6');
    expect(signed(-2)).toBe('−2'); // vrai signe moins
    expect(signed(0)).toBe('0');
  });
});

describe('explainEffectValue', () => {
  it('détaille la contribution de chaque équipement (moneyPerCorrect)', () => {
    // etendardRoyal : moneyPerCorrect 3 (cf. items.test).
    const team = mkTeam({ equipment: { head: null, body: 'etendardRoyal', feet: null } });
    const r = explainEffectValue(team, 'moneyPerCorrect');
    expect(r.total).toBe(3);
    expect(r.parts).toHaveLength(1);
    expect(r.parts[0].amount).toBe(3);
    expect(typeof r.parts[0].label).toBe('string');
    expect(typeof r.parts[0].formula).toBe('string');
  });

  it('total nul, aucune part sans équipement concerné', () => {
    const r = explainEffectValue(mkTeam(), 'moneyPerCorrect');
    expect(r.total).toBe(0);
    expect(r.parts).toEqual([]);
  });
});
