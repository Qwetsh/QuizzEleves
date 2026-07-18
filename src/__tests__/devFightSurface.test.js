// Tests : testeur de mini-jeux — choix de surface (tactile / manette / en ligne).
// devStartFight force les flags de la surface testée et stash les réglages
// réels dans _devRestore ; reset (sortie ✕ du bac à sable) les restaure.
import { describe, it, expect } from 'vitest';
import { useGameStore } from '../store/gameStore.js';

const S = () => useGameStore.getState();

function setup() {
  useGameStore.setState({
    phase: 'setup', devSandbox: false, _devRestore: null,
    connectionMode: 'board', phoneController: false, sessionCode: 'REAL',
    showFight: null, finished: false, log: [],
  });
}

describe('testeur de mini-jeux : surfaces', () => {
  it('tactile (défaut) : flags neutres, duel lancé, sandbox actif', () => {
    setup();
    S().devStartFight('anglais');
    expect(S().devSandbox).toBe(true);
    expect(S().phase).toBe('game');
    expect(S().showFight).toBeTruthy();
    expect(S().connectionMode).toBe('board');
    expect(S().phoneController).toBe(false);
    expect(S().sessionCode).toBe(null); // session propre au sandbox
  });

  it('phone : manette activée (connectionMode phone + phoneController)', () => {
    setup();
    S().devStartFight('geographie', false, 'phone');
    expect(S().connectionMode).toBe('phone');
    expect(S().phoneController).toBe(true);
    expect(S().sessionCode).toBe(null);
    expect(S()._devRestore).toEqual({ connectionMode: 'board', phoneController: false, sessionCode: 'REAL' });
  });

  it('online : mode en ligne (OnlineHost créera la session)', () => {
    setup();
    S().devStartFight('anglais', false, 'online');
    expect(S().connectionMode).toBe('online');
    expect(S().phoneController).toBe(false);
    expect(S().sessionCode).toBe(null);
  });

  it('reset (sortie ✕) : restaure les réglages de connexion réels', () => {
    setup();
    S().devStartFight('anglais', false, 'online');
    S().reset();
    expect(S().devSandbox).toBe(false);
    expect(S()._devRestore).toBe(null);
    expect(S().connectionMode).toBe('board');
    expect(S().phoneController).toBe(false);
    expect(S().sessionCode).toBe('REAL');
  });

  it('reset hors sandbox : ne restaure rien (nouvelle partie = nouveau code)', () => {
    setup();
    useGameStore.setState({ connectionMode: 'online', _devRestore: null, devSandbox: false, phase: 'game', teams: [], board: null });
    S().reset();
    expect(S().sessionCode).toBe(null);
    expect(S().connectionMode).toBe('online'); // réglage persistant, inchangé par reset
  });
});
