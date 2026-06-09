import { describe, it, expect } from 'vitest';
import { generateBoard } from '../logic/boardGenerator.js';

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
  nbVoies: 2,
  nbSections: 2,
  voieFinale: 'aucune',
  couloirsMix: 0,
  eventEveryX: 0,
};

const maxVoiesParams = {
  casesParVoie: 6,
  nbVoies: 3,
  nbSections: 4,
  voieFinale: 'unique',
  couloirsMix: 3,
  eventEveryX: 2,
};

const allParamSets = [
  ['default', defaultParams],
  ['minimal', minimalParams],
  ['maxVoies', maxVoiesParams],
];

describe('generateBoard', () => {
  it('returns an object with nodes and viewBox', () => {
    const result = generateBoard(defaultParams);
    expect(result).toHaveProperty('nodes');
    expect(result).toHaveProperty('viewBox');
    expect(typeof result.nodes).toBe('object');
    expect(typeof result.viewBox).toBe('object');
  });

  it('nodes contains depart and arrivee keys', () => {
    const { nodes } = generateBoard(defaultParams);
    expect(nodes).toHaveProperty('depart');
    expect(nodes).toHaveProperty('arrivee');
  });

  it('depart has type depart and arrivee has type arrivee', () => {
    const { nodes } = generateBoard(defaultParams);
    expect(nodes.depart.type).toBe('depart');
    expect(nodes.arrivee.type).toBe('arrivee');
  });

  it('all nodes have x, y, type, and next properties', () => {
    const { nodes } = generateBoard(defaultParams);
    for (const [id, node] of Object.entries(nodes)) {
      expect(node, `node "${id}" missing x`).toHaveProperty('x');
      expect(node, `node "${id}" missing y`).toHaveProperty('y');
      expect(node, `node "${id}" missing type`).toHaveProperty('type');
      expect(node, `node "${id}" missing next`).toHaveProperty('next');
      expect(typeof node.x, `node "${id}" x not a number`).toBe('number');
      expect(typeof node.y, `node "${id}" y not a number`).toBe('number');
      expect(Array.isArray(node.next), `node "${id}" next not an array`).toBe(true);
    }
  });

  it('next arrays reference existing node IDs', () => {
    const { nodes } = generateBoard(defaultParams);
    const nodeIds = new Set(Object.keys(nodes));
    for (const [id, node] of Object.entries(nodes)) {
      for (const nextId of node.next) {
        expect(nodeIds.has(nextId), `node "${id}" references unknown next "${nextId}"`).toBe(true);
      }
    }
  });

  it('depart x is minimal and arrivee x is maximal', () => {
    const { nodes } = generateBoard(defaultParams);
    const allX = Object.values(nodes).map((n) => n.x);
    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    expect(nodes.depart.x).toBe(minX);
    expect(nodes.arrivee.x).toBe(maxX);
  });

  describe.each(allParamSets)('with %s params', (_label, params) => {
    it('returns nodes and viewBox', () => {
      const result = generateBoard(params);
      expect(result).toHaveProperty('nodes');
      expect(result).toHaveProperty('viewBox');
    });

    it('contains depart and arrivee with correct types', () => {
      const { nodes } = generateBoard(params);
      expect(nodes.depart.type).toBe('depart');
      expect(nodes.arrivee.type).toBe('arrivee');
    });

    it('all nodes have required properties', () => {
      const { nodes } = generateBoard(params);
      for (const [id, node] of Object.entries(nodes)) {
        expect(node, `node "${id}"`).toHaveProperty('x');
        expect(node, `node "${id}"`).toHaveProperty('y');
        expect(node, `node "${id}"`).toHaveProperty('type');
        expect(node, `node "${id}"`).toHaveProperty('next');
      }
    });

    it('next arrays only reference existing nodes', () => {
      const { nodes } = generateBoard(params);
      const nodeIds = new Set(Object.keys(nodes));
      for (const [id, node] of Object.entries(nodes)) {
        for (const nextId of node.next) {
          expect(nodeIds.has(nextId), `node "${id}" -> unknown "${nextId}"`).toBe(true);
        }
      }
    });
  });

  const countByType = (nodes, type) =>
    Object.values(nodes).filter((n) => n.type === type).length;

  describe('event distribution (eventEveryX)', () => {
    it('places no events when eventEveryX is 0', () => {
      const { nodes } = generateBoard({ ...defaultParams, eventEveryX: 0 });
      expect(countByType(nodes, 'event')).toBe(0);
    });

    it('places at least one event when eventEveryX >= 1', () => {
      const { nodes } = generateBoard({ ...defaultParams, eventEveryX: 3 });
      expect(countByType(nodes, 'event')).toBeGreaterThan(0);
    });

    it('produces more events with a smaller interval', () => {
      const dense = generateBoard({ ...defaultParams, eventEveryX: 2 });
      const sparse = generateBoard({ ...defaultParams, eventEveryX: 5 });
      expect(countByType(dense.nodes, 'event')).toBeGreaterThan(
        countByType(sparse.nodes, 'event')
      );
    });

    it('leaves no long run of subject cases without an event along any path', () => {
      const X = 3;
      const { nodes } = generateBoard({ ...defaultParams, eventEveryX: X });
      // Longest chain of consecutive subject cases (no event) reachable from depart.
      // With "one event every X", a player should never cross many subject cases in a row.
      let worst = 0;
      const stack = [['depart', 0]];
      const seen = new Set();
      while (stack.length) {
        const [id, run] = stack.pop();
        const node = nodes[id];
        const newRun = node.type === 'subject' ? run + 1 : 0;
        if (newRun > worst) worst = newRun;
        const key = `${id}:${newRun}`;
        if (seen.has(key)) continue;
        seen.add(key);
        for (const nx of node.next) stack.push([nx, newRun]);
      }
      // A voie has at most `casesParVoie` (4) cases; with X=3 the gap stays bounded.
      expect(worst).toBeLessThanOrEqual(2 * X);
    });
  });

  it('viewBox w and h are positive numbers', () => {
    const { viewBox } = generateBoard(defaultParams);
    expect(typeof viewBox.w).toBe('number');
    expect(typeof viewBox.h).toBe('number');
    expect(viewBox.w).toBeGreaterThan(0);
    expect(viewBox.h).toBeGreaterThan(0);
  });

  it('every node is reachable from depart (graph connectivity via BFS)', () => {
    const { nodes } = generateBoard(defaultParams);
    const visited = new Set();
    const queue = ['depart'];
    visited.add('depart');

    while (queue.length > 0) {
      const current = queue.shift();
      for (const nextId of nodes[current].next) {
        if (!visited.has(nextId)) {
          visited.add(nextId);
          queue.push(nextId);
        }
      }
    }

    const allIds = Object.keys(nodes);
    for (const id of allIds) {
      expect(visited.has(id), `node "${id}" is not reachable from depart`).toBe(true);
    }
  });
});
