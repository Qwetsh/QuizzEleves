import { saveGame, loadGame, clearSave } from '../store/persistence.js';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store[key] = value; }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

describe('saveGame', () => {
  it('serializes Sets to arrays in askedQuestions', () => {
    const state = {
      teams: [{ name: 'A' }],
      currentTeam: 0,
      askedQuestions: {
        maths: new Set([0, 2, 4]),
        francais: new Set([1]),
      },
    };

    saveGame(state);

    expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
    const saved = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
    expect(saved.askedQuestions.maths).toEqual([0, 2, 4]);
    expect(saved.askedQuestions.francais).toEqual([1]);
    expect(Array.isArray(saved.askedQuestions.maths)).toBe(true);
  });

  it('saves non-Set fields as-is', () => {
    const state = {
      teams: [{ name: 'A' }, { name: 'B' }],
      currentTeam: 1,
      finished: false,
      askedQuestions: {},
    };

    saveGame(state);

    const saved = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
    expect(saved.teams).toEqual([{ name: 'A' }, { name: 'B' }]);
    expect(saved.currentTeam).toBe(1);
    expect(saved.finished).toBe(false);
  });
});

describe('loadGame', () => {
  it('deserializes arrays to Sets in askedQuestions', () => {
    const data = {
      teams: [{ name: 'A' }],
      currentTeam: 0,
      askedQuestions: {
        maths: [0, 2, 4],
        francais: [1],
      },
    };
    localStorageMock.setItem('quete-matieres-save', JSON.stringify(data));

    const loaded = loadGame();

    expect(loaded.askedQuestions.maths).toBeInstanceOf(Set);
    expect(loaded.askedQuestions.francais).toBeInstanceOf(Set);
    expect(loaded.askedQuestions.maths.has(0)).toBe(true);
    expect(loaded.askedQuestions.maths.has(2)).toBe(true);
    expect(loaded.askedQuestions.maths.has(4)).toBe(true);
    expect(loaded.askedQuestions.francais.has(1)).toBe(true);
  });

  it('returns null when no save exists', () => {
    const result = loadGame();
    expect(result).toBeNull();
  });

  it('returns other fields unchanged', () => {
    const data = {
      teams: [{ name: 'Team1' }],
      currentTeam: 0,
      finished: true,
    };
    localStorageMock.setItem('quete-matieres-save', JSON.stringify(data));

    const loaded = loadGame();
    expect(loaded.teams).toEqual([{ name: 'Team1' }]);
    expect(loaded.currentTeam).toBe(0);
    expect(loaded.finished).toBe(true);
  });
});

describe('clearSave', () => {
  it('removes the save from localStorage', () => {
    localStorageMock.setItem('quete-matieres-save', '{}');
    clearSave();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('quete-matieres-save');
  });
});
