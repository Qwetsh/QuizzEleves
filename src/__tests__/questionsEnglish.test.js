// Version anglaise des questions : le mélange des réponses doit garder a_en
// ALIGNÉ sur a (même permutation) et l'index `c` cohérent dans les deux langues.
import { describe, it, expect } from 'vitest';
import { shuffleAnswers } from '../logic/questionPicker.js';

describe('shuffleAnswers — alignement FR/EN', () => {
  it('a_en suit la même permutation que a ; la bonne réponse reste alignée', () => {
    for (let i = 0; i < 200; i++) {
      const q = { q: 'Q', a: ['A', 'B', 'C', 'D'], a_en: ['Ae', 'Be', 'Ce', 'De'], c: 2, e: 'x', e_en: 'xe' };
      const s = shuffleAnswers(q);
      // La bonne réponse FR pointée par c est toujours 'C', et l'EN 'Ce'.
      expect(s.a[s.c]).toBe('C');
      expect(s.a_en[s.c]).toBe('Ce');
      // a_en[i] correspond toujours à la traduction de a[i] (même lettre).
      for (let k = 0; k < s.a.length; k++) {
        expect(s.a_en[k]).toBe(s.a[k] + 'e');
      }
    }
  });

  it('sans a_en, renvoie a_en = null (pas de crash)', () => {
    const s = shuffleAnswers({ q: 'Q', a: ['A', 'B'], c: 0 });
    expect(s.a_en).toBeNull();
    expect(s.a[s.c]).toBe('A');
  });

  it('a_en avec trous (traduction partielle) reste aligné', () => {
    const q = { q: 'Q', a: ['A', 'B', 'C'], a_en: ['Ae', null, 'Ce'], c: 1 };
    const s = shuffleAnswers(q);
    const idxB = s.a.indexOf('B');
    expect(s.a_en[idxB]).toBeNull(); // le trou suit 'B'
    expect(s.a[s.c]).toBe('B');
  });
});
