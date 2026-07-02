import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setThemesData, resetThemesData } from '../data/themes';
import { buildPerimeter, themesToCassetteModel } from '../logic/perimeter';

// Petit arbre de test : scolaire (2 matières), divertissement > cinema (1 film),
// et un domaine 'vide' sans contenu.
const THEMES = {
  scolaire: { key: 'scolaire', path: 'scolaire', parentKey: null, kind: 'scolaire', name: 'Scolaire', color: '#4f7a4a', ord: 0 },
  francais: { key: 'francais', path: 'scolaire.francais', parentKey: 'scolaire', kind: 'theme', name: 'Français', subjectKey: 'francais', ord: 0 },
  maths: { key: 'maths', path: 'scolaire.maths', parentKey: 'scolaire', kind: 'theme', name: 'Maths', subjectKey: 'maths', ord: 1 },
  divertissement: { key: 'divertissement', path: 'divertissement', parentKey: null, kind: 'domain', name: 'Divertissement', color: '#d2622b', ord: 1 },
  cinema: { key: 'cinema', path: 'divertissement.cinema', parentKey: 'divertissement', kind: 'integrale', name: 'Cinéma', ord: 0 },
  film_scifi: { key: 'film_scifi', path: 'divertissement.cinema.film_scifi', parentKey: 'cinema', kind: 'theme', name: 'SF', subjectKey: 'film_scifi', ord: 0 },
  vide: { key: 'vide', path: 'vide', parentKey: null, kind: 'domain', name: 'Vide', ord: 2 },
};

beforeEach(() => setThemesData({ themes: THEMES, roots: ['scolaire', 'divertissement', 'vide'] }));
afterEach(() => resetThemesData());

describe('buildPerimeter', () => {
  const all = () => true;

  it('feuille → voie identité (pool singleton)', () => {
    const p = buildPerimeter([{ themeKey: 'maths' }], { hasContent: all });
    expect(p.boardSubjects).toEqual(['maths']);
    expect(p.categoryPools).toEqual({ maths: ['maths'] });
  });

  it('nœud large → pool des feuilles descendantes + displayInject', () => {
    const p = buildPerimeter([{ themeKey: 'scolaire' }], { hasContent: all });
    expect(p.boardSubjects).toEqual(['scolaire']);
    expect(p.categoryPools.scolaire).toEqual(['francais', 'maths']);
    expect(p.displayInject.scolaire.color).toBe('#4f7a4a');
    // Invariant : boardSubjects === clés de categoryPools.
    expect(p.boardSubjects).toEqual(Object.keys(p.categoryPools));
  });

  it('exclusion d’un sous-thème', () => {
    const p = buildPerimeter([{ themeKey: 'scolaire', excludedSubjectKeys: ['maths'] }], { hasContent: all });
    expect(p.categoryPools.scolaire).toEqual(['francais']);
  });

  it('filtre hasContent (matière sans questions écartée)', () => {
    const p = buildPerimeter([{ themeKey: 'scolaire' }], { hasContent: (k) => k !== 'maths' });
    expect(p.categoryPools.scolaire).toEqual(['francais']);
  });

  it('nœud large imbriqué (cinema → film_scifi)', () => {
    const p = buildPerimeter([{ themeKey: 'cinema' }], { hasContent: all });
    expect(p.boardSubjects).toEqual(['cinema']);
    expect(p.categoryPools.cinema).toEqual(['film_scifi']);
  });

  it('domaine sans contenu → aucune voie', () => {
    const p = buildPerimeter([{ themeKey: 'vide' }], { hasContent: all });
    expect(p.boardSubjects).toEqual([]);
    expect(p.categoryPools).toEqual({});
  });
});

describe('themesToCassetteModel', () => {
  it('produit domaines + cartes avec id = clé de thème', () => {
    const { DOMAINS, GROUPS } = themesToCassetteModel();
    expect(DOMAINS.map((d) => d.id)).toEqual(['scolaire', 'divertissement', 'vide']);
    const sco = GROUPS.find((g) => g.domain === 'scolaire');
    // INTÉGRALE (cartouche) du domaine + 2 matières.
    expect(sco.items[0]).toMatchObject({ id: 'scolaire', type: 'cartouche' });
    expect(sco.items[0].sub).toEqual([
      { label: 'Français', key: 'francais' },
      { label: 'Maths', key: 'maths' },
    ]);
    expect(sco.items.slice(1).map((i) => i.id)).toEqual(['francais', 'maths']);
    // Domaine vide : pas d'INTÉGRALE, pas d'enfants à contenu.
    const vide = GROUPS.find((g) => g.domain === 'vide');
    expect(vide.items).toEqual([]);
  });
});
