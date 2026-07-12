// Tests : manette téléphone — intents « de tour » (turn*) appliqués par le TBI.
// Gardes : toggle phoneController, équipe active uniquement, anti-doublon uid,
// garde de phase (l'intent n'agit que si l'état de tour correspondant est ouvert).
import { describe, it, expect, vi } from 'vitest';
import { useGameStore } from '../store/gameStore.js';

const S = () => useGameStore.getState();

const RESET = {
  showQuestion: null, showEvent: null, showFight: null, showDuelChoice: null,
  rolling: false, showDiceModal: false, awaitingChoice: false, pendingActions: null,
  pendingLanding: false, pendingMove: null, diceValue: null, movePath: null,
  showStarterChest: false, showMetierPicker: false, showTilePicker: null,
};

// Plateau minimal : une jonction « a » à deux branches, chaînées vers l'avant.
const BOARD = {
  depart: { type: 'depart', x: 0, y: 0, next: ['a'] },
  a: { type: 'jonction', x: 1, y: 0, next: ['b', 'c'] },
  b: { type: 'subject', subject: 'maths', x: 2, y: -1, next: ['d'] },
  c: { type: 'subject', subject: 'svt', x: 2, y: 1, next: ['d'] },
  d: { type: 'subject', subject: 'histoire', x: 3, y: 0, next: [] },
};

let uidSeq = 0;
const uid = () => `test-uid-${++uidSeq}`;

function setup(over = {}) {
  useGameStore.setState({
    phase: 'game', devSandbox: true, finished: false, currentTeam: 0, log: [],
    phoneController: true, board: BOARD, ...RESET,
    teams: [
      { name: 'A', emoji: '🦁', color: '#111', money: 0, token: 'tA', pos: 'depart', equipment: { head: null, body: null, feet: null }, bag: [], powers: {} },
      { name: 'B', emoji: '🦅', color: '#222', money: 0, token: 'tB', pos: 'depart', equipment: { head: null, body: null, feet: null }, bag: [], powers: {} },
    ],
    ...over,
  });
}

describe('applyTurnIntent — gardes globales', () => {
  it('turnRoll par l’équipe ACTIVE lance le dé', () => {
    setup();
    S().applyTeamIntent('tA', 'turnRoll', { uid: uid() });
    expect(S().rolling).toBe(true);
    expect(S().showDiceModal).toBe(true);
    expect(S().diceValue).toBeGreaterThanOrEqual(1);
    expect(S().diceValue).toBeLessThanOrEqual(6);
  });

  it('turnRoll refusé pour une équipe NON active', () => {
    setup();
    S().applyTeamIntent('tB', 'turnRoll', { uid: uid() });
    expect(S().rolling).toBe(false);
  });

  it('turnRoll refusé si phoneController est désactivé', () => {
    setup({ phoneController: false });
    S().applyTeamIntent('tA', 'turnRoll', { uid: uid() });
    expect(S().rolling).toBe(false);
  });

  it('turnRoll refusé si la partie est finie', () => {
    setup({ finished: true });
    S().applyTeamIntent('tA', 'turnRoll', { uid: uid() });
    expect(S().rolling).toBe(false);
  });

  it('turnRoll pendant une résolution : no-op (gardes internes de rollDice)', () => {
    setup({ showQuestion: { question: {} } });
    S().applyTeamIntent('tA', 'turnRoll', { uid: uid() });
    expect(S().rolling).toBe(false);
  });

  it('uid dupliqué : le second intent est ignoré (anti-doublon)', () => {
    setup();
    const u = uid();
    S().applyTeamIntent('tA', 'turnRoll', { uid: u });
    expect(S().rolling).toBe(true);
    // On « termine » artificiellement le lancer, puis on rejoue le MÊME uid
    // (fetch de rattrapage + realtime livrent parfois deux fois la même ligne).
    useGameStore.setState({ rolling: false, showDiceModal: false, diceValue: null });
    S().applyTeamIntent('tA', 'turnRoll', { uid: u });
    expect(S().rolling).toBe(false); // ignoré
  });

  it('jeton inconnu : aucune action, aucune erreur', () => {
    setup();
    expect(() => S().applyTeamIntent('???', 'turnRoll', { uid: uid() })).not.toThrow();
    expect(S().rolling).toBe(false);
  });
});

describe('applyTurnIntent — jonction et atterrissage', () => {
  it('turnChooseJunction : choisit la branche si elle est valide', () => {
    setup({ awaitingChoice: true, pendingMove: { remaining: 1 } });
    useGameStore.setState({ teams: [{ ...S().teams[0], pos: 'a' }, S().teams[1]] });
    S().applyTeamIntent('tA', 'turnChooseJunction', { nodeId: 'b', uid: uid() });
    expect(S().teams[0].pos).not.toBe('a');
    expect(S().awaitingChoice).toBe(false);
  });

  it('turnChooseJunction : nodeId hors des branches → no-op', () => {
    setup({ awaitingChoice: true, pendingMove: { remaining: 1 } });
    useGameStore.setState({ teams: [{ ...S().teams[0], pos: 'a' }, S().teams[1]] });
    S().applyTeamIntent('tA', 'turnChooseJunction', { nodeId: 'd', uid: uid() });
    expect(S().teams[0].pos).toBe('a'); // refusé (d n'est pas une branche de a)
    expect(S().awaitingChoice).toBe(true);
  });

  it('turnChooseJunction hors phase (pas de jonction en attente) → no-op', () => {
    setup();
    useGameStore.setState({ teams: [{ ...S().teams[0], pos: 'a' }, S().teams[1]] });
    S().applyTeamIntent('tA', 'turnChooseJunction', { nodeId: 'b', uid: uid() });
    expect(S().teams[0].pos).toBe('a');
  });

  it('turnConfirmLanding : consomme pendingLanding', () => {
    setup({ pendingLanding: true });
    S().applyTeamIntent('tA', 'turnConfirmLanding', { uid: uid() });
    expect(S().pendingLanding).toBe(false);
  });

  it('turnConfirmLanding hors phase → no-op silencieux', () => {
    setup();
    expect(() => S().applyTeamIntent('tA', 'turnConfirmLanding', { uid: uid() })).not.toThrow();
    expect(S().pendingLanding).toBe(false);
  });

  it('turnConfirmLanding émis par l’équipe non active → ignoré', () => {
    setup({ pendingLanding: true });
    S().applyTeamIntent('tB', 'turnConfirmLanding', { uid: uid() });
    expect(S().pendingLanding).toBe(true);
  });
});

describe('applyTurnIntent — n’interfère pas avec les intents historiques', () => {
  it('un intent classique (equip) reste soumis au verrou de résolution', () => {
    setup({ showQuestion: { question: {} } });
    useGameStore.setState({ teams: [{ ...S().teams[0], bag: ['chapeauPaille'] }, S().teams[1]] });
    S().applyTeamIntent('tA', 'equip', { key: 'chapeauPaille' });
    expect(S().teams[0].equipment.head).toBeNull(); // toujours bloqué
  });
});

describe('applyTurnIntent — point de contrôle & pose de piège', () => {
  it('turnCheckpoint : l’équipe active se téléporte sur son checkpoint', () => {
    vi.useFakeTimers();
    setup();
    useGameStore.setState({ teams: [{ ...S().teams[0], pos: 'd', checkpoint: 'b', checkpointConsumeChance: 100 }, S().teams[1]] });
    S().applyTeamIntent('tA', 'turnCheckpoint', { uid: uid() });
    vi.advanceTimersByTime(600); // le saut est différé (effet visuel de warp)
    expect(S().teams[0].pos).toBe('b');
    expect(S().teams[0].checkpoint).toBeUndefined();
    vi.useRealTimers();
  });

  it('turnCheckpoint : refusé pour une équipe NON active', () => {
    setup();
    useGameStore.setState({ teams: [S().teams[0], { ...S().teams[1], pos: 'd', checkpoint: 'b', checkpointConsumeChance: 100 }] });
    S().applyTeamIntent('tB', 'turnCheckpoint', { uid: uid() });
    expect(S().teams[1].pos).toBe('d'); // pas de téléportation
  });

  it('turnSelectTile : consomme le sélecteur de case si ouvert', () => {
    setup({ showTilePicker: { label: null } });
    S().applyTeamIntent('tA', 'turnSelectTile', { nodeId: 'b', uid: uid() });
    expect(S().showTilePicker).toBeNull();
  });

  it('turnSelectTile : case invalide (arrivée) → no-op', () => {
    setup({ showTilePicker: { label: null }, board: { ...BOARD, arr: { type: 'arrivee', x: 4, y: 0, next: [] } } });
    S().applyTeamIntent('tA', 'turnSelectTile', { nodeId: 'arr', uid: uid() });
    expect(S().showTilePicker).not.toBeNull(); // toujours ouvert
  });

  it('turnCancelTile : ferme le sélecteur', () => {
    setup({ showTilePicker: { label: null } });
    S().applyTeamIntent('tA', 'turnCancelTile', { uid: uid() });
    expect(S().showTilePicker).toBeNull();
  });
});
