// Tests : manette téléphone — dérivation de la phase de tour et bloc `turn`
// publié vers les mobiles (buildTurnPayload / buildSessionPayload).
// ⚠️ Anti-triche : le payload est reçu par TOUS les téléphones — jamais de
// token, et jamais la bonne réponse d'une question avant sa révélation.
import { describe, it, expect } from 'vitest';
import { deriveTurnPhase, buildTurnPayload, buildSessionPayload } from '../logic/sessionConfig.js';

const BOARD = {
  a: { type: 'jonction', x: 1, y: 0, label: '?', next: ['b', 'c'] },
  b: { type: 'subject', subject: 'maths', x: 2, y: -1, next: [] },
  c: { type: 'subject', subject: 'svt', x: 2, y: 1, next: [] },
};

const BASE = {
  finished: false, teams: [{ name: 'A', emoji: '🦁', pos: 'a', token: 'SECRET-tA' }],
  currentTeam: 0, board: BOARD,
  rolling: false, showDiceModal: false, diceValue: null,
  awaitingChoice: false, pendingMove: null, pendingLanding: false,
  showQuestion: null, showEvent: null, showFight: null, showDuelChoice: null,
  showTargetPicker: null, showTilePicker: null, showSubjectPicker: false,
  showChargePicker: false, showActionDice: null, lootReveal: null,
  showStarterChest: false, lastStarterReward: null, showShopPrompt: false,
  showMetierPicker: false, indiceHidden: [],
};

describe('deriveTurnPhase — priorités', () => {
  it('idle par défaut', () => {
    expect(deriveTurnPhase(BASE)).toBe('idle');
  });
  it('finished prime sur tout', () => {
    expect(deriveTurnPhase({ ...BASE, finished: true, showQuestion: {} })).toBe('finished');
  });
  it('question prime sur jonction et dé', () => {
    expect(deriveTurnPhase({ ...BASE, showQuestion: {}, awaitingChoice: true, rolling: true })).toBe('question');
  });
  it('duelChoice prime sur question', () => {
    expect(deriveTurnPhase({ ...BASE, showDuelChoice: {}, showQuestion: {} })).toBe('duelChoice');
  });
  it('fight prime sur duelChoice', () => {
    expect(deriveTurnPhase({ ...BASE, showFight: {}, showDuelChoice: {} })).toBe('fight');
  });
  it('dé : rolling OU showDiceModal', () => {
    expect(deriveTurnPhase({ ...BASE, rolling: true })).toBe('dice');
    expect(deriveTurnPhase({ ...BASE, showDiceModal: true })).toBe('dice');
  });
  it('junction / landing / loot / pickers', () => {
    expect(deriveTurnPhase({ ...BASE, awaitingChoice: true })).toBe('junction');
    expect(deriveTurnPhase({ ...BASE, pendingLanding: true })).toBe('landing');
    expect(deriveTurnPhase({ ...BASE, lootReveal: { itemKey: 'x' } })).toBe('loot');
    expect(deriveTurnPhase({ ...BASE, showTargetPicker: {} })).toBe('targetPicker');
    expect(deriveTurnPhase({ ...BASE, showTilePicker: {} })).toBe('tilePicker');
    expect(deriveTurnPhase({ ...BASE, showSubjectPicker: true })).toBe('subjectPicker');
    expect(deriveTurnPhase({ ...BASE, showChargePicker: true })).toBe('chargePicker');
    expect(deriveTurnPhase({ ...BASE, showShopPrompt: true })).toBe('shopPrompt');
    expect(deriveTurnPhase({ ...BASE, showStarterChest: true })).toBe('starterChest');
    expect(deriveTurnPhase({ ...BASE, showMetierPicker: true })).toBe('metier');
  });
});

describe('buildTurnPayload — données par phase', () => {
  it('dice : la valeur est MASQUÉE tant que l’animation TBI roule (anti-spoiler)', () => {
    const rollingTurn = buildTurnPayload({ ...BASE, rolling: true, showDiceModal: true, diceValue: 5 });
    expect(rollingTurn.phase).toBe('dice');
    expect(rollingTurn.dice.value).toBeNull();
    expect(rollingTurn.dice.rolling).toBe(true);
    const doneTurn = buildTurnPayload({ ...BASE, rolling: false, showDiceModal: true, diceValue: 5 });
    expect(doneTurn.dice.value).toBe(5);
  });

  it('junction : options dérivées du plateau (id + type + subject)', () => {
    const turn = buildTurnPayload({ ...BASE, awaitingChoice: true, pendingMove: { remaining: 3 } });
    expect(turn.phase).toBe('junction');
    expect(turn.junction.remaining).toBe(3);
    expect(turn.junction.options).toEqual([
      { id: 'b', type: 'subject', subject: 'maths', label: null },
      { id: 'c', type: 'subject', subject: 'svt', label: null },
    ]);
  });

  it('landing : type et matière de la case d’arrivée', () => {
    const state = { ...BASE, pendingLanding: true, teams: [{ ...BASE.teams[0], pos: 'b' }] };
    const turn = buildTurnPayload(state);
    expect(turn.phase).toBe('landing');
    expect(turn.landing).toEqual({ type: 'subject', subject: 'maths' });
  });

  it('team = index de l’équipe active', () => {
    expect(buildTurnPayload(BASE).team).toBe(0);
  });
});

describe('buildSessionPayload — bloc turn et anti-fuite', () => {
  const args = {
    teams: BASE.teams, currentTeam: 0, status: 'playing',
    shopStock: [], log: [], extensions: null,
    phoneController: true, turnState: { ...BASE, awaitingChoice: true },
  };

  it('publie controller + turn + publishedAt', () => {
    const p = buildSessionPayload(args);
    expect(p.controller).toBe(true);
    expect(p.turn.phase).toBe('junction');
    expect(typeof p.publishedAt).toBe('number');
  });

  it('sans turnState : turn = null (compat lobby)', () => {
    const p = buildSessionPayload({ ...args, turnState: null, phoneController: false });
    expect(p.turn).toBeNull();
    expect(p.controller).toBe(false);
  });

  it('ne fuit JAMAIS de token (même via le bloc turn)', () => {
    const raw = JSON.stringify(buildSessionPayload(args));
    expect(raw).not.toContain('SECRET-tA');
    expect(raw).not.toContain('token');
  });
});
