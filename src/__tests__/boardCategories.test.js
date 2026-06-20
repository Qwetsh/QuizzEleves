// Phase 2 — granularité automatique des voies + résolution catégorie → sous-thème.
import { describe, it, expect } from 'vitest';
import { boardCategoriesFor } from '../logic/boardCategories.ts';
import { useGameStore } from '../store/gameStore.js';

// Thème d'un sous-thème (mock) : college pour les matières, sinon le préfixe.
const themeOf = (k) => ({
  maths: 'college', francais: 'college', svt: 'college',
  rpg: 'jeuxVideo', simulation: 'jeuxVideo', foot: 'sport', tennis: 'sport',
}[k] || 'college');

describe('boardCategoriesFor — granularité automatique', () => {
  it('1 seul thème → voies = sous-thèmes (mono = historique)', () => {
    const r = boardCategoriesFor(['maths', 'francais', 'svt'], themeOf);
    expect(r.boardCats).toEqual(['maths', 'francais', 'svt']);
    expect(r.categoryPools).toEqual({});
  });

  it('≥2 thèmes → voies = thèmes, chacun poolant ses sous-thèmes', () => {
    const r = boardCategoriesFor(['maths', 'rpg', 'simulation', 'foot'], themeOf);
    expect(r.boardCats).toEqual(['college', 'jeuxVideo', 'sport']);
    expect(r.categoryPools).toEqual({
      college: ['maths'],
      jeuxVideo: ['rpg', 'simulation'],
      sport: ['foot'],
    });
  });
});

describe('resolveSubjectFor — catégorie de voie → sous-thème concret', () => {
  it('thème multi → un de ses sous-thèmes ; lv2 → langue ; sinon identité', () => {
    useGameStore.setState({
      categoryPools: { jeuxVideo: ['rpg', 'simulation'] },
      teams: [{ lv2: 'allemand' }],
    });
    const { resolveSubjectFor } = useGameStore.getState();
    // thème → un sous-thème de son pool
    for (let i = 0; i < 20; i++) {
      expect(['rpg', 'simulation']).toContain(resolveSubjectFor('jeuxVideo', 0));
    }
    // sous-thème direct (mono) → identité
    expect(resolveSubjectFor('maths', 0)).toBe('maths');
    // lv2 → langue de l'équipe
    expect(resolveSubjectFor('lv2', 0)).toBe('allemand');
    // reset
    useGameStore.setState({ categoryPools: {} });
  });
});
