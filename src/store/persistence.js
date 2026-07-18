const STORAGE_KEY = 'quete-matieres-save';

// Champs de l'état de jeu persistés (sauvegarde locale). Exporté pour être
// réutilisé par le snapshot « jeu en ligne » (onlineSnapshot.js), qui diffuse
// ce même socle + des champs transitoires de rendu.
export const SAVE_FIELDS = [
  'teams', 'currentTeam', 'board', 'boardDecor', 'boardSpace', 'viewBox', 'finished',
  'askedQuestions', 'questions', 'log', 'phase', 'boardSubjects', 'categoryPools',
  'extensions', 'enabledEvents', 'knownEventKeys', 'enabledItems', 'knownItemKeys', 'level', 'useBrevet', 'forcedDuels', 'phoneController', 'connectionMode', 'sessionCode', 'boardParams', 'englishMode',
  'shopStock', 'shopStockTurns', 'shopFaceStock',
  // Prestation de forgeage en cours : la réserve du forgeron est en ESCROW DANS
  // cet objet (sa faceStock est vidée). Sans persistance, un reload du TBI en
  // pleine session perdrait définitivement ces faces achetées → on le sauvegarde.
  'forgeService',
  'starterChestConfig', 'starterGold',
  'gameStats', 'statsArchived', 'classLabel',
  // Météo : état ambiant + préavis + compteurs de cadence (l'overlay transitoire
  // weatherCeremony n'est PAS persisté — il est recréé au prochain déclenchement).
  'weather', 'weatherNotice', 'turnCount', 'lastWeatherTurn',
  // Curioscope : anti-répétition des spots (un spot montré au TBI est connu de
  // toute la classe — l'historique doit survivre au reload).
  'curioSeen', 'curioSeq',
];

/**
 * Save relevant game state to localStorage.
 * askedQuestions values are Sets — serialize them as arrays.
 */
export function saveGame(state) {
  // Bac a sable dev (simulateur de combat) : ne jamais ecraser la vraie partie
  if (state.devSandbox) return;
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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (quotaErr) {
      // Quota localStorage dépassé (grosses parties : le pool `questions` peut
      // peser plusieurs Mo avec des cassettes intégrales). Save DÉGRADÉE sans
      // le pool — resumeGame le RECONSTRUIT depuis level/useBrevet (catalogue).
      data.questions = null;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
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
