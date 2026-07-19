// Duel Memory (paires) multi-surface : sur la surface « écran + téléphones »
// (phoneController), fightBegin route vers un plateau PILOTÉ PAR LE STORE
// (showFight.memory) — plateau TV en lecture seule sur l'écran partagé
// (MemoryDuelStage), retournements par intents turnMemoryFlip (memoryDuelFlip).
// L'hôte est l'autorité : minuteries de capture / retournement, alternance des
// tours, victoire de manche (BO3). Seul le camp ACTIF peut retourner une carte.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { buildTurnPayload } from '../logic/sessionConfig.js';
import {
  MEMORY_MATCH_HOLD_MS, MEMORY_FLIP_BACK_MS, MEMORY_REVEAL_MS,
} from '../store/memoryFightHandlers.js';

const S = () => useGameStore.getState();

function startMemoryDuel(surface = 'phone') {
  useGameStore.setState({
    phase: 'setup', devSandbox: false, _devRestore: null,
    connectionMode: 'board', phoneController: false, sessionCode: null,
    showFight: null, finished: false, log: [],
  });
  S().devStartFight('vocabulaire', false, surface);
  S().fightBegin();
}

// Indices des deux cartes d'une paire encore libre (appariement = même pairId).
function freePair(m) {
  const pid = [...new Set(m.cards.map((c) => c.pairId))].find((p) => m.matched[p] == null);
  return m.cards.map((c, i) => (c.pairId === pid ? i : -1)).filter((i) => i >= 0);
}
// Deux cartes de paires DIFFÉRENTES, toutes deux libres.
function mismatch(m) {
  const free = m.cards.map((c, i) => ({ c, i })).filter(({ c }) => m.matched[c.pairId] == null);
  for (let a = 0; a < free.length; a++) {
    for (let b = a + 1; b < free.length; b++) {
      if (free[a].c.pairId !== free[b].c.pairId) return [free[a].i, free[b].i];
    }
  }
  return null;
}

describe('duel Memory multi-surface (showFight.memory)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('surface téléphone : fightBegin distribue un plateau piloté par le store', () => {
    startMemoryDuel('phone');
    const f = S().showFight;
    expect(f.phase).toBe('minigame');
    expect(f.memory).toBeTruthy();
    expect(f.memory.cards).toHaveLength(12); // 6 paires
    expect(f.memory.activeSide).toBe('attacker');
    expect(f.memory.scores).toEqual({ attacker: 0, defender: 0 });
    expect(f.memory.flipped).toEqual([]);
  });

  it('surface tactile : pas de plateau store — briefing puis moteur composant', () => {
    startMemoryDuel('board');
    expect(S().showFight.phase).toBe('briefing');
    expect(S().showFight.memory).toBeUndefined();
  });

  it('paire trouvée : capture colorée au camp, +1, et le MÊME camp rejoue', () => {
    startMemoryDuel('phone');
    const [i, j] = freePair(S().showFight.memory);
    S().memoryDuelFlip('attacker', i);
    S().memoryDuelFlip('attacker', j);
    expect(S().showFight.memory.busy).toBe(true); // figé pendant la résolution
    vi.advanceTimersByTime(MEMORY_MATCH_HOLD_MS);
    const m = S().showFight.memory;
    const pid = m.cards[i].pairId;
    expect(m.matched[pid]).toBe('attacker'); // carte capturée par l'attaquant
    expect(m.scores.attacker).toBe(1);
    expect(m.activeSide).toBe('attacker'); // rejoue
    expect(m.flipped).toEqual([]);
    expect(m.busy).toBe(false);
  });

  it('deux cartes différentes : retournées, puis la main passe à l\'autre camp', () => {
    startMemoryDuel('phone');
    const [i, j] = mismatch(S().showFight.memory);
    S().memoryDuelFlip('attacker', i);
    S().memoryDuelFlip('attacker', j);
    vi.advanceTimersByTime(MEMORY_FLIP_BACK_MS);
    const m = S().showFight.memory;
    expect(m.matched).toEqual({}); // rien de capturé
    expect(m.flipped).toEqual([]); // cartes retournées face cachée
    expect(m.activeSide).toBe('defender'); // main à l'adversaire
  });

  it('seul le camp actif peut retourner une carte', () => {
    startMemoryDuel('phone');
    const [i] = freePair(S().showFight.memory);
    S().memoryDuelFlip('defender', i); // pas son tour → ignoré
    expect(S().showFight.memory.flipped).toEqual([]);
    S().memoryDuelFlip('attacker', i); // camp actif → accepté
    expect(S().showFight.memory.flipped).toEqual([i]);
  });

  it('anti-triche : le payload ne publie ni texte ni appariement d\'une carte au dos', () => {
    startMemoryDuel('phone');
    const [i] = freePair(S().showFight.memory);
    S().memoryDuelFlip('attacker', i); // une seule carte face visible
    const payload = buildTurnPayload(S());
    const pm = payload.fight.memory;
    expect(pm).toBeTruthy();
    // La carte retournée porte son texte ; toutes les autres sont muettes.
    expect(pm.cards[i].text).toBeTruthy();
    const hidden = pm.cards.filter((_, idx) => idx !== i);
    expect(hidden.every((c) => c.text === null)).toBe(true);
    // Aucun pairId ne fuit (impossible de deviner les paires en amont).
    expect(pm.cards.every((c) => c.pairId === undefined)).toBe(true);
  });

  it('plateau complété par un camp → il gagne la manche (BO3) et un plateau neuf est servi', () => {
    startMemoryDuel('phone');
    // L'attaquant capture les 6 paires d'affilée (chaque paire le fait rejouer).
    for (let n = 0; n < 6; n++) {
      const [i, j] = freePair(S().showFight.memory);
      S().memoryDuelFlip('attacker', i);
      S().memoryDuelFlip('attacker', j);
      vi.advanceTimersByTime(MEMORY_MATCH_HOLD_MS);
    }
    expect(S().showFight.memory.reveal).toEqual({ winner: 'attacker' });
    expect(S().showFight.wins.attacker).toBe(0); // pas encore marqué (révélation en cours)
    vi.advanceTimersByTime(MEMORY_REVEAL_MS);
    expect(S().showFight.wins.attacker).toBe(1); // manche marquée
    // Le combat continue (BO3) → nouveau plateau propre.
    const nm = S().showFight.memory;
    expect(nm.reveal).toBeNull();
    expect(Object.keys(nm.matched)).toHaveLength(0);
    expect(nm.scores).toEqual({ attacker: 0, defender: 0 });
  });
});
