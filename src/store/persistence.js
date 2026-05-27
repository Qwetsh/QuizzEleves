const STORAGE_KEY = 'quete-matieres-save';

const SAVE_FIELDS = [
  'teams', 'currentTeam', 'board', 'viewBox', 'finished',
  'askedQuestions', 'questions', 'log', 'phase',
  'enabledEvents', 'level', 'boardParams',
];

/**
 * Save relevant game state to localStorage.
 * askedQuestions values are Sets — serialize them as arrays.
 */
export function saveGame(state) {
  try {
    const data = {};
    for (const key of SAVE_FIELDS) {
      if (key === 'askedQuestions') {
        // Convert each Set to an Array for JSON serialization
        const obj = {};
        for (const [subject, setOrArr] of Object.entries(state[key] || {})) {
          obj[subject] = setOrArr instanceof Set ? [...setOrArr] : Array.isArray(setOrArr) ? setOrArr : [];
        }
        data[key] = obj;
      } else {
        data[key] = state[key];
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save game:', e);
  }
}

/**
 * Load saved game state from localStorage.
 * Converts askedQuestions arrays back to Sets.
 * Returns the saved state object, or null if no save exists.
 */
export function loadGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);

    // Convert askedQuestions arrays back to Sets
    if (data.askedQuestions) {
      for (const subject of Object.keys(data.askedQuestions)) {
        const arr = data.askedQuestions[subject];
        data.askedQuestions[subject] = new Set(Array.isArray(arr) ? arr : []);
      }
    }

    return data;
  } catch (e) {
    console.warn('Failed to load saved game:', e);
    return null;
  }
}

/**
 * Remove the saved game from localStorage.
 */
export function clearSave() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear save:', e);
  }
}
