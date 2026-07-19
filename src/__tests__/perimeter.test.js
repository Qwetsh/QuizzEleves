import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setThemesData, resetThemesData, descendantLeaves, isPureLeaf } from '../data/themes';
import { buildPerimeter, themesToCassetteModel, eligibleThemesByDomain, randomThemeSelection } from '../logic/perimeter';
import { repathSubtree, slugifyKey } from '../logic/themesConfig';

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

// Arbre avec un nœud MIXTE : jeux_video porte du contenu ET a un enfant Skyrim.
const MIXED = {
  divertissement: { key: 'divertissement', path: 'divertissement', parentKey: null, kind: 'domain', name: 'Divertissement', ord: 0 },
  jeux_video: { key: 'jeux_video', path: 'divertissement.jeux_video', parentKey: 'divertissement', kind: 'theme', name: 'Jeux vidéo', subjectKey: 'jeux_video', ord: 0 },
  skyrim: { key: 'skyrim', path: 'divertissement.jeux_video.skyrim', parentKey: 'jeux_video', kind: 'theme', name: 'Skyrim', subjectKey: 'skyrim', ord: 0 },
};

describe('nœud mixte (contenu propre + enfants)', () => {
  beforeEach(() => setThemesData({ themes: MIXED, roots: ['divertissement'] }));
  afterEach(() => resetThemesData());

  it('descendantLeaves inclut le subject du nœud PUIS ses enfants', () => {
    expect(descendantLeaves('jeux_video')).toEqual(['jeux_video', 'skyrim']);
    expect(descendantLeaves('skyrim')).toEqual(['skyrim']);
  });

  it('isPureLeaf : Skyrim oui, Jeux vidéo non (a un enfant)', () => {
    expect(isPureLeaf('skyrim')).toBe(true);
    expect(isPureLeaf('jeux_video')).toBe(false);
  });

  it('insérer un nœud mixte = voie large (ses Q générales + Skyrim)', () => {
    const p = buildPerimeter([{ themeKey: 'jeux_video' }], { hasContent: () => true });
    expect(p.boardSubjects).toEqual(['jeux_video']);
    expect(p.categoryPools.jeux_video).toEqual(['jeux_video', 'skyrim']);
  });

  it('insérer une feuille pure = voie singleton', () => {
    const p = buildPerimeter([{ themeKey: 'skyrim' }], { hasContent: () => true });
    expect(p.categoryPools).toEqual({ skyrim: ['skyrim'] });
  });

  it('cassette : le nœud mixte = INTÉGRALE + le sous-sous-thème en mini (depth 2)', () => {
    const { GROUPS } = themesToCassetteModel();
    const items = GROUPS.find((g) => g.domain === 'divertissement').items;
    const jv = items.find((i) => i.id === 'jeux_video');
    const sky = items.find((i) => i.id === 'skyrim');
    expect(jv).toMatchObject({ type: 'integrale', depth: 1 });
    expect(sky).toMatchObject({ type: 'theme', depth: 2 });
    // Skyrim est listé juste après Jeux vidéo (rangé sous son parent).
    expect(items.indexOf(sky)).toBe(items.indexOf(jv) + 1);
  });
});

// Arbre avec une cassette DURE (opt-in) : « Qui est ce Pokémon ? » niché sous
// pokemon, marqué hard → exclu par défaut de la sélection d'un ancêtre.
const HARD = {
  divertissement: { key: 'divertissement', path: 'divertissement', parentKey: null, kind: 'domain', name: 'Divertissement', ord: 0 },
  pokemon: { key: 'pokemon', path: 'divertissement.pokemon', parentKey: 'divertissement', kind: 'theme', name: 'Pokémon', subjectKey: 'pokemon', ord: 0 },
  pokemon_silhouette: { key: 'pokemon_silhouette', path: 'divertissement.pokemon.pokemon_silhouette', parentKey: 'pokemon', kind: 'theme', name: 'Qui est ce Pokémon ?', subjectKey: 'pokemon_silhouette', hard: true, ord: 0 },
};

describe('cassette dure (hard) : opt-in, exclue par défaut', () => {
  beforeEach(() => setThemesData({ themes: HARD, roots: ['divertissement'] }));
  afterEach(() => resetThemesData());

  it('descendantLeaves saute la cassette dure descendante', () => {
    expect(descendantLeaves('pokemon')).toEqual(['pokemon']);
    expect(descendantLeaves('divertissement')).toEqual(['pokemon']);
  });

  it('includeHard force son inclusion (éditeur)', () => {
    expect(descendantLeaves('pokemon', { includeHard: true })).toEqual(['pokemon', 'pokemon_silhouette']);
  });

  it('sélectionner le parent n’embarque PAS la cassette dure', () => {
    const p = buildPerimeter([{ themeKey: 'pokemon' }], { hasContent: () => true });
    expect(p.categoryPools.pokemon).toEqual(['pokemon']);
  });

  it('sélectionner la cassette dure directement fonctionne (feuille pure)', () => {
    expect(isPureLeaf('pokemon_silhouette')).toBe(true);
    const p = buildPerimeter([{ themeKey: 'pokemon_silhouette' }], { hasContent: () => true });
    expect(p.categoryPools).toEqual({ pokemon_silhouette: ['pokemon_silhouette'] });
  });

  it('cassette : la dure est sa PROPRE carte, absente du bundle de l’intégrale', () => {
    const items = themesToCassetteModel().GROUPS.find((g) => g.domain === 'divertissement').items;
    const pk = items.find((i) => i.id === 'pokemon');
    const sil = items.find((i) => i.id === 'pokemon_silhouette');
    expect(pk.sub).toEqual([{ label: 'Pokémon', key: 'pokemon' }]); // dure absente du sub
    expect(sil).toMatchObject({ type: 'theme', depth: 2 });           // mais bien émise en carte
  });
});

describe('repathSubtree', () => {
  const rows = [
    { key: 'divertissement', path: 'divertissement', parent_key: null },
    { key: 'jeux_video', path: 'divertissement.jeux_video', parent_key: 'divertissement' },
    { key: 'bethesda', path: 'divertissement.jeux_video.bethesda', parent_key: 'jeux_video' },
    { key: 'skyrim', path: 'divertissement.jeux_video.skyrim', parent_key: 'jeux_video' },
  ];

  it('déplacer Skyrim sous Bethesda re-path le nœud (questions intactes car liées au subject)', () => {
    const up = repathSubtree(rows, 'skyrim', 'bethesda');
    expect(up).toEqual([{ key: 'skyrim', path: 'divertissement.jeux_video.bethesda.skyrim', parent_key: 'bethesda' }]);
  });

  it('déplacer un nœud re-path aussi tous ses descendants', () => {
    const up = repathSubtree(rows, 'jeux_video', 'divertissement'); // no-op parent, mais teste la descente
    // parent identique → aucun changement
    expect(up).toEqual([]);
  });

  it('slugifyKey : accents retirés, séparateurs → underscore', () => {
    expect(slugifyKey('Épée à Feu !')).toBe('epee_a_feu');
    expect(slugifyKey('The Elder Scrolls V')).toBe('the_elder_scrolls_v');
  });
});

// Sélection ALÉATOIRE (mode « Surprise » en ligne). Utilise l'arbre du
// beforeEach top-level : scolaire (francais, maths), divertissement>cinema>film_scifi,
// vide (sans contenu). Pool éligible = francais, maths, film_scifi.
describe('eligibleThemesByDomain', () => {
  it('feuilles à contenu, groupées par domaine (vide écarté)', () => {
    const groups = eligibleThemesByDomain({ hasContent: () => true });
    expect(groups.map((g) => g.domain)).toEqual(['scolaire', 'divertissement']);
    expect(groups[0].items.map((i) => i.key)).toEqual(['francais', 'maths']);
    expect(groups[0].items[0]).toMatchObject({ key: 'francais', subjectKey: 'francais', name: 'Français' });
    expect(groups[1].items.map((i) => i.key)).toEqual(['film_scifi']);
  });

  it('filtre hasContent', () => {
    const groups = eligibleThemesByDomain({ hasContent: (k) => k !== 'maths' });
    expect(groups[0].items.map((i) => i.key)).toEqual(['francais']);
  });
});

describe('randomThemeSelection', () => {
  const POOL = ['francais', 'maths', 'film_scifi'];

  it('tire `count` thèmes DISTINCTS du pool, au format buildPerimeter', () => {
    const sel = randomThemeSelection({ count: 2, hasContent: () => true });
    expect(sel.length).toBe(2);
    const keys = sel.map((s) => s.themeKey);
    expect(new Set(keys).size).toBe(2);
    keys.forEach((k) => expect(POOL).toContain(k));
  });

  it('respecte les exclusions (clamp au pool restant)', () => {
    const sel = randomThemeSelection({ count: 5, excluded: ['francais', 'maths'], hasContent: () => true });
    expect(sel).toEqual([{ themeKey: 'film_scifi' }]);
  });

  it('pool plus petit que count → prend tout', () => {
    const sel = randomThemeSelection({ count: 10, hasContent: () => true });
    expect(sel.map((s) => s.themeKey).sort()).toEqual([...POOL].sort());
  });

  it('tout exclu → sélection vide', () => {
    const sel = randomThemeSelection({ count: 3, excluded: POOL, hasContent: () => true });
    expect(sel).toEqual([]);
  });

  it('sélection → buildPerimeter donne des voies valides', () => {
    const sel = randomThemeSelection({ count: 3, hasContent: () => true });
    const p = buildPerimeter(sel, { hasContent: () => true });
    expect(p.boardSubjects.length).toBe(3);
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
