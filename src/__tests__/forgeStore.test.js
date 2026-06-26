// Phase 2b-2 / 2c — actions store de la Forge : achat (buyFace) et pose (forgeFace).
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { getDieFaces } from '../logic/forge.js';

const S = () => useGameStore.getState();
const baseTeam = (over = {}) => ({ name: 'T', emoji: '🦁', money: 100, correct: 0, wrong: 0, powers: {}, equipment: { head: null, body: null, feet: null }, bag: [], faceStock: [], ...over });

beforeEach(() => {
  useGameStore.setState({
    phase: 'game', devSandbox: true, finished: false, currentTeam: 0,
    extensions: { forge: true }, log: [],
    teams: [baseTeam()],
    shopFaceStock: [{ value: 3, effect: null, price: 25, power: 3 }],
  });
});

describe('Forge — buyFace', () => {
  it('déplace une face de la vitrine vers la réserve et débite le prix', () => {
    S().buyFace(0);
    const t = S().teams[0];
    expect(t.money).toBe(75);
    expect(t.faceStock).toHaveLength(1);
    expect(t.faceStock[0]).toEqual({ value: 3, effect: null });
    expect(S().shopFaceStock).toHaveLength(1); // emplacement renouvelé
  });

  it('refuse si l\'or est insuffisant', () => {
    useGameStore.setState({ teams: [baseTeam({ money: 10 })] });
    S().buyFace(0);
    expect(S().teams[0].faceStock).toHaveLength(0);
    expect(S().teams[0].money).toBe(10);
  });

  it('ne fait rien si l\'extension Forge est désactivée', () => {
    useGameStore.setState({ extensions: { forge: false } });
    S().buyFace(0);
    expect(S().teams[0].faceStock).toHaveLength(0);
  });
});

describe('Forge — forgeFace', () => {
  it('pose une face de la réserve sur un slot et la retire de la réserve', () => {
    useGameStore.setState({ teams: [baseTeam({ faceStock: [{ value: 0, effect: { type: 'egide', tier: 2 } }] })] });
    S().forgeFace(2, 0); // slot index 2 = base 3
    const faces = getDieFaces(S().teams[0]);
    expect(faces[2]).toEqual({ base: 3, value: 0, effect: { type: 'egide', tier: 2 } });
    expect(S().teams[0].faceStock).toHaveLength(0);
  });

  it('l\'adresse (base) du slot reste immuable', () => {
    useGameStore.setState({ teams: [baseTeam({ faceStock: [{ value: 5, effect: null }] })] });
    S().forgeFace(0, 0); // slot 0 = base 1
    expect(getDieFaces(S().teams[0])[0].base).toBe(1);
    expect(getDieFaces(S().teams[0])[0].value).toBe(5);
  });

  it('écrase la face existante (perte) — la réserve diminue', () => {
    useGameStore.setState({ teams: [baseTeam({
      dieFaces: getDieFaces({}).map((f, i) => (i === 1 ? { ...f, value: 6 } : f)),
      faceStock: [{ value: 2, effect: null }],
    })] });
    S().forgeFace(1, 0);
    expect(getDieFaces(S().teams[0])[1].value).toBe(2); // remplacée
    expect(S().teams[0].faceStock).toHaveLength(0);
  });
});
