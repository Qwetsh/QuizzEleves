import {
  buildPredecessors,
  moveForward,
  moveBack,
  findNextJunction,
  findPrevJunction,
} from '../logic/pathfinding.js';

const testBoard = {
  depart: { x: 0, y: 0, type: 'depart', next: ['a'] },
  a: { x: 1, y: 0, type: 'subject', subject: 'maths', next: ['b'] },
  b: { x: 2, y: 0, type: 'jonction', next: ['c', 'd'] },
  c: { x: 3, y: -1, type: 'subject', subject: 'francais', next: ['e'] },
  d: { x: 3, y: 1, type: 'subject', subject: 'svt', next: ['e'] },
  e: { x: 4, y: 0, type: 'arrivee', next: [] },
};

describe('buildPredecessors', () => {
  it('correctly builds the predecessor map', () => {
    const preds = buildPredecessors(testBoard);
    expect(preds['a']).toEqual(['depart']);
    expect(preds['b']).toEqual(['a']);
    expect(preds['c']).toEqual(['b']);
    expect(preds['d']).toEqual(['b']);
    expect(preds['e']).toEqual(expect.arrayContaining(['c', 'd']));
    expect(preds['e']).toHaveLength(2);
    expect(preds['depart']).toBeUndefined();
  });
});

describe('moveForward', () => {
  it('moves forward by the given number of steps', () => {
    const result = moveForward(testBoard, 'depart', 1);
    expect(result.finalPos).toBe('a');
    expect(result.stoppedAtJunction).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('stops at a junction (>1 next) when not the first step', () => {
    const result = moveForward(testBoard, 'depart', 3);
    expect(result.finalPos).toBe('b');
    expect(result.stoppedAtJunction).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it('stops immediately when starting on a junction (choice required)', () => {
    const result = moveForward(testBoard, 'b', 1);
    expect(result.finalPos).toBe('b');
    expect(result.stoppedAtJunction).toBe(true);
    expect(result.remaining).toBe(1);
    expect(result.path).toEqual(['b']);
  });

  it('keeps the full remaining steps when starting on a junction', () => {
    const result = moveForward(testBoard, 'b', 3);
    expect(result.finalPos).toBe('b');
    expect(result.stoppedAtJunction).toBe(true);
    expect(result.remaining).toBe(3);
  });

  it('traverses junctions via next[0] with throughJunctions option', () => {
    const result = moveForward(testBoard, 'b', 2, { throughJunctions: true });
    expect(result.finalPos).toBe('e');
    expect(result.stoppedAtJunction).toBe(false);
    expect(result.path).toEqual(['b', 'c', 'e']);
  });

  it('stops at arrivee', () => {
    const result = moveForward(testBoard, 'c', 5);
    expect(result.finalPos).toBe('e');
    expect(result.stoppedAtJunction).toBe(false);
  });

  it('stays in place when there is no next node', () => {
    const result = moveForward(testBoard, 'e', 2);
    expect(result.finalPos).toBe('e');
  });
});

describe('moveBack', () => {
  it('moves backward by the given number of steps', () => {
    const preds = buildPredecessors(testBoard);
    const { finalPos } = moveBack(testBoard, 'b', 1, preds);
    expect(finalPos).toBe('a');
  });

  it('moves multiple steps backward', () => {
    const preds = buildPredecessors(testBoard);
    const { finalPos } = moveBack(testBoard, 'b', 2, preds);
    expect(finalPos).toBe('depart');
  });

  it('stops at depart (no predecessor)', () => {
    const preds = buildPredecessors(testBoard);
    const { finalPos } = moveBack(testBoard, 'a', 5, preds);
    expect(finalPos).toBe('depart');
  });

  it('builds predecessors automatically if not provided', () => {
    const { finalPos } = moveBack(testBoard, 'b', 1);
    expect(finalPos).toBe('a');
  });
});

describe('findNextJunction', () => {
  it('finds the next jonction node', () => {
    const pos = findNextJunction(testBoard, 'depart');
    expect(pos).toBe('b');
  });

  it('finds arrivee when no jonction ahead', () => {
    const pos = findNextJunction(testBoard, 'c');
    expect(pos).toBe('e');
  });

  it('returns currentPos when no path forward', () => {
    const pos = findNextJunction(testBoard, 'e');
    expect(pos).toBe('e');
  });
});

describe('findPrevJunction', () => {
  it('finds the previous jonction node', () => {
    const preds = buildPredecessors(testBoard);
    const pos = findPrevJunction(testBoard, 'c', preds);
    expect(pos).toBe('b');
  });

  it('finds depart when no jonction behind', () => {
    const preds = buildPredecessors(testBoard);
    const pos = findPrevJunction(testBoard, 'a', preds);
    expect(pos).toBe('depart');
  });

  it('returns currentPos when already at depart', () => {
    const preds = buildPredecessors(testBoard);
    const pos = findPrevJunction(testBoard, 'depart', preds);
    expect(pos).toBe('depart');
  });
});
