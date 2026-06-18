// Mode « LV2 au choix » : la filière 'lv2' se résout vers la langue de l'équipe,
// et randomBoardSubject ne pioche que parmi les matières du plateau.
import { describe, it, expect } from 'vitest';
import { useGameStore } from '../store/gameStore.js';

const S = () => useGameStore.getState();

describe('LV2 au choix', () => {
  it('resolveSubjectFor : « lv2 » → langue de l’équipe (repli espagnol)', () => {
    useGameStore.setState({ teams: [{ lv2: 'allemand' }, { lv2: 'espagnol' }, {}] });
    expect(S().resolveSubjectFor('lv2', 0)).toBe('allemand');
    expect(S().resolveSubjectFor('lv2', 1)).toBe('espagnol');
    expect(S().resolveSubjectFor('lv2', 2)).toBe('espagnol'); // pas de lv2 → repli
    expect(S().resolveSubjectFor('maths', 0)).toBe('maths');  // autre sujet inchangé
  });

  it('randomBoardSubject ne pioche que dans boardSubjects', () => {
    useGameStore.setState({ boardSubjects: ['lv2'] });
    expect(S().randomBoardSubject()).toBe('lv2');
    useGameStore.setState({ boardSubjects: ['maths', 'histoire'] });
    for (let i = 0; i < 20; i++) expect(['maths', 'histoire']).toContain(S().randomBoardSubject());
  });
});
