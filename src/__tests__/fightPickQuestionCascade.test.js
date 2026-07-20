// Cascade « conteneur » de fightPickQuestion : un nœud PARENT (INTÉGRALE/domaine,
// ex. `harrypotter`) n'a AUCUNE question directe — elles vivent dans ses feuilles
// (`hp_livre1`…). fightPickQuestion doit agréger les pools des feuilles
// descendantes quand le pool direct est vide, sinon le duel de sorciers (testeur
// de mini-jeux comme vraie partie sur la voie large) n'aurait jamais de question.
import { describe, it, expect, afterEach } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { setThemesData, resetThemesData } from '../data/themes.js';

const S = () => useGameStore.getState();

// Arbre minimal : harrypotter (conteneur, pas de subjectKey) → hp_livre1 (feuille).
function loadThemes() {
  setThemesData({
    themes: {
      harrypotter: { key: 'harrypotter', parentKey: null, kind: 'integrale', name: 'Harry Potter' },
      hp_livre1: { key: 'hp_livre1', parentKey: 'harrypotter', subjectKey: 'hp_livre1', kind: 'theme', name: 'Livre 1' },
    },
    roots: ['harrypotter'],
  });
}

function pool(prefix) {
  return Array.from({ length: 6 }, (_, i) => ({
    q: `${prefix} ${i} ?`, a: [`bon-${i}`, `faux-${i}`, `x-${i}`, `y-${i}`], c: 0, e: `expl ${i}`,
  }));
}

describe('fightPickQuestion — cascade conteneur → feuilles', () => {
  afterEach(() => resetThemesData());

  it('un thème parent sans question directe tire dans ses feuilles descendantes', () => {
    loadThemes();
    useGameStore.setState({
      showFight: null, currentTeam: 0, categoryPools: {}, askedQuestions: {},
      // Les questions vivent sous la FEUILLE, pas sous le parent (reflète la base).
      questions: { hp_livre1: pool('HP') },
    });
    const q = S().fightPickQuestion('harrypotter');
    expect(q).toBeTruthy();
    expect(q.q).toMatch(/^HP /); // provient bien du pool de la feuille hp_livre1
  });

  it('sans feuille chargée (arbre absent), pool vide → null (pas de soft-lock)', () => {
    // Pas de setThemesData → descendantLeaves('harrypotter') = [] → pas de cascade.
    useGameStore.setState({
      showFight: null, currentTeam: 0, categoryPools: {}, askedQuestions: {}, questions: {},
    });
    expect(S().fightPickQuestion('harrypotter')).toBeNull();
  });

  it('anti-répétition : la cascade épuise le pool agrégé sans doublon', () => {
    loadThemes();
    useGameStore.setState({
      showFight: null, currentTeam: 0, categoryPools: {}, askedQuestions: {},
      questions: { hp_livre1: pool('HP') },
    });
    const seen = new Set();
    for (let i = 0; i < 6; i++) {
      const q = S().fightPickQuestion('harrypotter');
      expect(q).toBeTruthy();
      expect(seen.has(q.q)).toBe(false); // jamais deux fois la même dans un cycle
      seen.add(q.q);
    }
    expect(seen.size).toBe(6);
  });
});
