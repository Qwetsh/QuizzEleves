import { describe, it, expect } from 'vitest';
import { generateBoard } from '../logic/boardGenerator.js';

const defaultParams = {
  casesParVoie: 4,
  nbVoies: 3,
  nbSections: 3,
  voieFinale: 'court-long',
  couloirsMix: 2,
  eventsPerCouloir: 1,
};

const minimalParams = {
  casesParVoie: 3,
  nbVoies: 2,
  nbSections: 2,
  voieFinale: 'aucune',
  couloirsMix: 0,
  eventsPerCouloir: 0,
};

const maxVoiesParams = {
  casesParVoie: 6,
  nbVoies: 3,
  nbSections: 4,
  voieFinale: 'unique',
  couloirsMix: 3,
  eventsPerCouloir: 2,
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
