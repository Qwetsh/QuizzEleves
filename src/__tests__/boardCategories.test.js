// Phase 2 — granularité automatique des voies + résolution catégorie → sous-thème.
import { describe, it, expect } from 'vitest';
import { boardCategoriesFor } from '../logic/boardCategories.ts';
import { useGameStore } from '../store/gameStore.js';
import { setSubjectsData, resetSubjectsData } from '../data/subjects.js';

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

  it('≥2 thèmes → voies = thèmes, pool = sous-thèmes sélectionnés (sans subthemesOf)', () => {
    const r = boardCategoriesFor(['maths', 'rpg', 'simulation', 'foot'], themeOf);
    expect(r.boardCats).toEqual(['college', 'jeuxVideo', 'sport']);
    expect(r.categoryPools).toEqual({
      college: ['maths'],
      jeuxVideo: ['rpg', 'simulation'],
      sport: ['foot'],
    });
  });

  it('≥2 thèmes avec subthemesOf → thème ENTIER (pas de mixage fin)', () => {
    const all = { college: ['maths', 'francais', 'svt'], jeuxVideo: ['rpg', 'simulation'], sport: ['foot', 'tennis'] };
    // sélection partielle (maths + rpg) mais pool = thèmes entiers
    const r = boardCategoriesFor(['maths', 'rpg'], themeOf, (th) => all[th] || []);
    expect(r.boardCats).toEqual(['college', 'jeuxVideo']);
    expect(r.categoryPools).toEqual({
      college: ['maths', 'francais', 'svt'],
      jeuxVideo: ['rpg', 'simulation'],
    });
  });

  it('fineMix → chaque sous-thème coché = sa propre voie, à travers les thèmes (RUSTINE)', () => {
    const all = { college: ['maths', 'francais', 'svt'], jeuxVideo: ['rpg', 'simulation'] };
    // Même avec subthemesOf fourni, fineMix ignore le collapse et respecte la sélection.
    const r = boardCategoriesFor(['francais', 'rpg'], themeOf, (th) => all[th] || [], true);
    expect(r.boardCats).toEqual(['francais', 'rpg']);
    expect(r.categoryPools).toEqual({});
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

describe('isSchoolSession — analyse réservée aux modules scolaires', () => {
  it('vrai si toutes les voies sont scolaires, faux dès qu un thème ludique est présent', () => {
    // injecte un module ludique + sa catégorie
    setSubjectsData({
      modules: { college: { key: 'college', name: 'Collège', kind: 'school' }, film: { key: 'film', name: 'Film', kind: 'themed' } },
      moduleKeys: ['college', 'film'],
      subjects: { maths: { module: 'college', name: 'Maths' }, rpg: { module: 'film', name: 'RPG' } },
      keys: ['maths', 'rpg'],
    });
    const S = () => useGameStore.getState();
    useGameStore.setState({ boardSubjects: ['maths'] });
    expect(S().isSchoolSession()).toBe(true);
    useGameStore.setState({ boardSubjects: ['rpg'] });           // sous-thème ludique
    expect(S().isSchoolSession()).toBe(false);
    useGameStore.setState({ boardSubjects: ['college', 'film'] }); // voies-thèmes (multi)
    expect(S().isSchoolSession()).toBe(false);
    useGameStore.setState({ boardSubjects: ['college'] });
    expect(S().isSchoolSession()).toBe(true);
    resetSubjectsData();
    useGameStore.setState({ boardSubjects: [] });
  });
});
