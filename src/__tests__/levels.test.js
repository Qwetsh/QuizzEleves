// Tests : sélection MULTIPLE de niveaux (5e + 4e, etc.).
import { describe, it, expect, beforeEach } from 'vitest';
import { getQuestions, setQuestionData } from '../data/questions/index.js';
import { useGameStore } from '../store/gameStore.js';

const Q = (level) => ({ q: '?', a: ['A', 'B', 'C', 'D'], c: 0, level, t: '' });
const S = () => useGameStore.getState();

describe('getQuestions : filtrage par niveau(x)', () => {
  beforeEach(() => {
    setQuestionData({
      cycle4: {
        maths: [Q('6e'), Q('5e'), Q('4e'), Q('3e')],
        francais: [Q('5e'), Q('4e')],
      },
    });
  });

  it('tableau de niveaux : combine les pools', () => {
    const r = getQuestions(['5e', '4e']);
    expect(r.maths.length).toBe(2);    // 5e + 4e
    expect(r.francais.length).toBe(2);
  });
  it('un seul niveau', () => {
    expect(getQuestions(['5e']).maths.length).toBe(1);
    expect(getQuestions('4e').maths.length).toBe(1); // chaîne tolérée
  });
  it('cycle4 / all = tout le pool (méta)', () => {
    expect(getQuestions('cycle4').maths.length).toBe(4);
    expect(getQuestions(['cycle4', '6e']).maths.length).toBe(4); // la méta absorbe
    expect(getQuestions('all').maths.length).toBe(4);
  });
});

describe('store toggleLevel', () => {
  it('multi-grades + méta exclusive + garde ≥ 1', () => {
    useGameStore.setState({ level: ['cycle4'] });
    S().toggleLevel('5e');
    expect(S().level).toEqual(['5e']);        // quitte la méta
    S().toggleLevel('4e');
    expect(S().level).toEqual(['5e', '4e']);  // sélection multiple
    S().toggleLevel('5e');
    expect(S().level).toEqual(['4e']);        // retire 5e
    S().toggleLevel('4e');
    expect(S().level).toEqual(['4e']);        // impossible de tout retirer
    S().toggleLevel('cycle4');
    expect(S().level).toEqual(['cycle4']);    // la méta remplace tout
  });
});
