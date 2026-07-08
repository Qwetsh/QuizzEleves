import { describe, it, expect } from 'vitest';
import { composeSpaceBoard, CONT_SCALE } from '../logic/mapComposer.js';
import { CONTINENT, CONTINENTS, SOCLE_KEYS, ILOT_KEYS } from '../data/maps/espace.js';

const defaultParams = {
  casesParVoie: 4,
  nbVoies: 3,
  nbSections: 3,
  voieFinale: 'court-long',
  couloirsMix: 2,
  eventEveryX: 3,
};

const minimalParams = {
  casesParVoie: 3,
  nbVoies: 2, // ignoré : le mode espace est figé à 3 voies
  nbSections: 2,
  voieFinale: 'aucune',
  couloirsMix: 0,
  eventEveryX: 0,
};

const maxParams = {
  casesParVoie: 8,
  nbVoies: 3,
  nbSections: 4,
  voieFinale: 'unique',
  couloirsMix: 3,
  eventEveryX: 2,
};

const allParamSets = [
  ['default', defaultParams],
  ['minimal', minimalParams],
  ['max', maxParams],
];

describe('composeSpaceBoard', () => {
  it('retourne nodes, viewBox et space', () => {
    const result = composeSpaceBoard(defaultParams);
    expect(result).toHaveProperty('nodes');
    expect(result).toHaveProperty('viewBox');
    expect(result).toHaveProperty('space');
    expect(Array.isArray(result.space.layers)).toBe(true);
    expect(Array.isArray(result.space.stars)).toBe(true);
    expect(Array.isArray(result.space.constellations)).toBe(true);
  });

  it('pose un continent par voie et par section (1 continent = 1 voie, 2 voies figées)', () => {
    for (const nbSections of [2, 3, 4]) {
      const { space } = composeSpaceBoard({ ...defaultParams, nbSections });
      expect(space.layers.length).toBe(nbSections * 2);
      for (const l of space.layers) {
        // les matières scolaires sont servies par des îles culture-G (alias)
        expect(l.img).toMatch(/^cont(inent)?-/);
        expect(l.w).toBeGreaterThan(0);
      }
    }
  });

  it('quinconce : les 2 continents d’une section sont disjoints en x et de part et d’autre de l’épine', () => {
    const { space, viewBox } = composeSpaceBoard({ ...defaultParams, nbSections: 3 });
    const spine = viewBox.h / 2;
    const bySection = new Map();
    for (const l of space.layers) {
      if (!bySection.has(l.s)) bySection.set(l.s, []);
      bySection.get(l.s).push(l);
    }
    for (const layers of bySection.values()) {
      expect(layers.length).toBe(2);
      const near = layers.find((l) => l.v === 0);
      const far = layers.find((l) => l.v === 1);
      // lointain strictement après le proche (pas de chevauchement horizontal)
      expect(far.x).toBeGreaterThanOrEqual(near.x + near.w);
      // de part et d'autre de l'épine centrale (centres opposés)
      const cNear = near.y + near.h / 2 - spine;
      const cFar = far.y + far.h / 2 - spine;
      expect(cNear * cFar).toBeLessThan(0);
    }
  });

  it('les sections de continents ne se chevauchent pas horizontalement', () => {
    const { space } = composeSpaceBoard({ ...defaultParams, nbSections: 3, couloirsMix: 2 });
    const maxX = (s) => Math.max(...space.layers.filter((l) => l.s === s).map((l) => l.x + l.w));
    const minX = (s) => Math.min(...space.layers.filter((l) => l.s === s).map((l) => l.x));
    for (let s = 1; s < 3; s++) {
      expect(minX(s)).toBeGreaterThan(maxX(s - 1));
    }
  });

  it('respecte casesParVoie (sous-ensemble des 8 ancres)', () => {
    for (const n of [3, 4, 6, 8]) {
      const { nodes } = composeSpaceBoard({ ...defaultParams, casesParVoie: n, eventEveryX: 0, subjects: ['maths'] });
      const laneCases = Object.keys(nodes).filter((id) => /^s0v\d_maths_/.test(id));
      // 2 voies × n cases (toutes 'maths' car sélection unique)
      expect(laneCases.length).toBe(2 * n);
    }
  });

  it('chaque case porte un socle : pierre sur continent, îlot dans l’espace', () => {
    const { nodes, space } = composeSpaceBoard(defaultParams);
    for (const [id, node] of Object.entries(nodes)) {
      const socle = space.socles[id];
      expect(socle, `case "${id}" sans socle`).toBeTruthy();
      // Les jonctions jin/jout flottent désormais dans l'espace (choix de voie
      // AVANT l'éventail de continents) : seules les cases s{X}v{Y} sont posées
      // sur un continent.
      const onContinent = /^s\d+v\d/.test(id);
      if (onContinent) {
        expect(SOCLE_KEYS, `case continent "${id}"`).toContain(socle);
      } else {
        expect(ILOT_KEYS, `case espace "${id}"`).toContain(socle);
      }
      void node;
    }
  });

  it('utilise le continent thématique quand il existe, le générique sinon', () => {
    expect(CONTINENTS.cinema).toBeTruthy();
    expect(CONTINENTS.animaux).toBeTruthy();
    const { space } = composeSpaceBoard({ ...defaultParams, nbSections: 1, subjects: ['cinema', 'animaux'] });
    const imgs = space.layers.map((l) => l.img).sort();
    expect(imgs).toEqual(['cont-animaux', 'cont-cinema']);
    // matière scolaire → île culture-G voisine (alias)
    const maths = composeSpaceBoard({ ...defaultParams, nbSections: 1, subjects: ['maths'] });
    for (const l of maths.space.layers) expect(l.img).toBe('cont-maths_logique');
    // thème totalement inconnu (hors arbre, hors alias) → générique
    const fallback = composeSpaceBoard({ ...defaultParams, nbSections: 1, subjects: ['zzz_theme_inconnu'] });
    for (const l of fallback.space.layers) expect(l.img).toBe(CONTINENT.img);
  });

  it('la calibration dérivée reste dans les bornes de chaque asset', () => {
    for (const [theme, def] of Object.entries(CONTINENTS)) {
      const pts = [def.in, def.out, def.jin, def.jout, ...def.route];
      for (const p of pts) {
        expect(p.x, `${theme} x`).toBeGreaterThanOrEqual(0);
        expect(p.x, `${theme} x`).toBeLessThanOrEqual(def.w);
        expect(p.y, `${theme} y`).toBeGreaterThanOrEqual(0);
        expect(p.y, `${theme} y`).toBeLessThanOrEqual(def.h);
      }
    }
  });

  it('restreint les matières à la sélection `subjects`', () => {
    const { nodes } = composeSpaceBoard({ ...defaultParams, subjects: ['maths', 'histoire'] });
    const used = new Set(
      Object.values(nodes)
        .filter((n) => n.type === 'subject' && n.subject !== 'multi')
        .map((n) => n.subject),
    );
    for (const s of used) expect(['maths', 'histoire']).toContain(s);
    expect(used.size).toBeGreaterThan(0);
  });

  it('depart x minimal, arrivee x maximal', () => {
    const { nodes } = composeSpaceBoard(defaultParams);
    const allX = Object.values(nodes).map((n) => n.x);
    expect(nodes.depart.x).toBe(Math.min(...allX));
    expect(nodes.arrivee.x).toBe(Math.max(...allX));
  });

  describe.each(allParamSets)('avec params %s', (_label, params) => {
    it('depart/arrivee présents avec les bons types', () => {
      const { nodes } = composeSpaceBoard(params);
      expect(nodes.depart.type).toBe('depart');
      expect(nodes.arrivee.type).toBe('arrivee');
    });

    it('tous les nœuds ont x, y, type, next', () => {
      const { nodes } = composeSpaceBoard(params);
      for (const [id, node] of Object.entries(nodes)) {
        expect(typeof node.x, `node "${id}" x`).toBe('number');
        expect(typeof node.y, `node "${id}" y`).toBe('number');
        expect(node, `node "${id}" type`).toHaveProperty('type');
        expect(Array.isArray(node.next), `node "${id}" next`).toBe(true);
      }
    });

    it('les next référencent des nœuds existants', () => {
      const { nodes } = composeSpaceBoard(params);
      const ids = new Set(Object.keys(nodes));
      for (const [id, node] of Object.entries(nodes)) {
        for (const nx of node.next) {
          expect(ids.has(nx), `node "${id}" -> inconnu "${nx}"`).toBe(true);
        }
      }
    });

    it('tout nœud est atteignable depuis depart', () => {
      const { nodes } = composeSpaceBoard(params);
      const visited = new Set(['depart']);
      const queue = ['depart'];
      while (queue.length) {
        const cur = queue.shift();
        for (const nx of nodes[cur].next) {
          if (!visited.has(nx)) { visited.add(nx); queue.push(nx); }
        }
      }
      for (const id of Object.keys(nodes)) {
        expect(visited.has(id), `node "${id}" inatteignable`).toBe(true);
      }
    });

    it('viewBox couvre tous les nœuds et les continents', () => {
      const { nodes, viewBox, space } = composeSpaceBoard(params);
      expect(viewBox.w).toBeGreaterThan(0);
      expect(viewBox.h).toBeGreaterThan(0);
      for (const [id, n] of Object.entries(nodes)) {
        expect(n.x, `node "${id}" x hors viewBox`).toBeLessThan(viewBox.w);
        expect(n.y, `node "${id}" y hors viewBox`).toBeGreaterThan(0);
        expect(n.y, `node "${id}" y hors viewBox`).toBeLessThan(viewBox.h);
      }
      for (const l of space.layers) {
        expect(l.x + l.w).toBeLessThanOrEqual(viewBox.w);
      }
    });
  });

  describe('distribution des événements', () => {
    const countEvents = (nodes) => Object.values(nodes).filter((n) => n.type === 'event').length;

    it('aucun événement quand eventEveryX = 0', () => {
      const { nodes } = composeSpaceBoard({ ...defaultParams, eventEveryX: 0 });
      expect(countEvents(nodes)).toBe(0);
    });

    it('au moins un événement quand eventEveryX >= 1', () => {
      const { nodes } = composeSpaceBoard({ ...defaultParams, eventEveryX: 3 });
      expect(countEvents(nodes)).toBeGreaterThan(0);
    });

    it('plus d’événements avec un intervalle plus court', () => {
      const dense = composeSpaceBoard({ ...defaultParams, eventEveryX: 2 });
      const sparse = composeSpaceBoard({ ...defaultParams, eventEveryX: 5 });
      expect(countEvents(dense.nodes)).toBeGreaterThan(countEvents(sparse.nodes));
    });
  });
});
