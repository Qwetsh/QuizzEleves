// Tests : manette téléphone — événements, duel, loot, coffre de départ,
// prompt boutique et périphérie de combat (Phase 4).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { normalizeBag, cellKey } from '../store/itemHandlers.js';

const S = () => useGameStore.getState();

const BOARD = {
  depart: { type: 'depart', x: 0, y: 0, next: ['a'] },
  a: { type: 'subject', subject: 'maths', x: 1, y: 0, next: ['b'] },
  b: { type: 'subject', subject: 'svt', x: 2, y: 0, next: [] },
};

const RESET = {
  showQuestion: null, showEvent: null, showFight: null, showDuelChoice: null,
  rolling: false, showDiceModal: false, awaitingChoice: false, pendingActions: null,
  pendingLanding: false, pendingMove: null, diceValue: null,
  lootReveal: null, showStarterChest: false, lastStarterReward: null, showShopPrompt: false,
  indiceUsed: false, indiceHidden: [],
};

let uidSeq = 900;
const uid = () => `te-uid-${++uidSeq}`;

function setup(over = {}) {
  useGameStore.setState({
    phase: 'game', devSandbox: true, finished: false, currentTeam: 0, log: [],
    phoneController: true, board: BOARD, ...RESET,
    teams: [
      { name: 'A', emoji: '🦁', color: '#111', money: 50, token: 'tA', pos: 'a', correct: 0, wrong: 0, equipment: { head: null, body: null, feet: null }, bag: [], powers: { foudre: { level: 1, charges: 1 } } },
      { name: 'B', emoji: '🦅', color: '#222', money: 50, token: 'tB', pos: 'b', correct: 0, wrong: 0, equipment: { head: null, body: null, feet: null }, bag: [], powers: { bouclier: { level: 1, charges: 2 } } },
    ],
    ...over,
  });
}

afterEach(() => { vi.useRealTimers(); });

describe('intents événements — gardes de phase', () => {
  it('turnEventAccept refusé hors phase intro', () => {
    setup({ showEvent: { key: 'troisCoffres', event: {}, phase: 'choice', data: { gifts: [] } } });
    S().applyTeamIntent('tA', 'turnEventAccept', { uid: uid() });
    expect(S().showEvent.phase).toBe('choice'); // inchangé
  });

  it('turnEventAnswer : répond à la question d’événement (résultat figé)', () => {
    vi.useFakeTimers(); // eventAnswerQuestion arme un setTimeout de 2 s (applyEventEffect)
    setup({ showEvent: { key: 'duel', event: {}, phase: 'question', data: { eventQuestion: { q: '?', a: ['x', 'y'], c: 1 }, targetIndex: 1 } } });
    S().applyTeamIntent('tA', 'turnEventAnswer', { index: 1, uid: uid() });
    expect(S().showEvent.data.questionRevealed).toBe(true);
    expect(S().showEvent.data.questionResult).toBe(true);
    vi.clearAllTimers();
  });

  it('turnEventAnswer refusé si déjà révélée', () => {
    setup({ showEvent: { key: 'duel', event: {}, phase: 'question', data: { eventQuestion: { q: '?', a: ['x', 'y'], c: 1 }, questionRevealed: true, questionSelected: 0 } } });
    S().applyTeamIntent('tA', 'turnEventAnswer', { index: 1, uid: uid() });
    expect(S().showEvent.data.questionSelected).toBe(0); // premier choix conservé
  });

  it('turnEventTarget : cible une AUTRE équipe seulement', () => {
    // Événement « vol » : la cible (B) a des charges → passage en phase choice.
    setup({ showEvent: { key: 'vol', event: {}, phase: 'target', data: {} } });
    S().applyTeamIntent('tA', 'turnEventTarget', { index: 0, uid: uid() }); // soi-même
    expect(S().showEvent.phase).toBe('target');
    S().applyTeamIntent('tA', 'turnEventTarget', { index: 1, uid: uid() });
    expect(S().showEvent.phase).toBe('choice');
    expect(S().showEvent.data.targetIndex).toBe(1);
  });

  it('turnEventGift : objet hors des coffres proposés refusé', () => {
    setup({ showEvent: { key: 'troisCoffres', event: {}, phase: 'choice', data: { gifts: ['painVoyageur'] } } });
    S().applyTeamIntent('tA', 'turnEventGift', { itemKey: 'chapeauPaille', uid: uid() });
    expect(normalizeBag(S().teams[0].bag).filter(Boolean)).toEqual([]);
    S().applyTeamIntent('tA', 'turnEventGift', { itemKey: 'painVoyageur', uid: uid() });
    expect(normalizeBag(S().teams[0].bag).map(cellKey)).toContain('painVoyageur');
  });

  it('turnEventRecharge : seulement un pouvoir POSSÉDÉ (événement recharge)', () => {
    setup({ showEvent: { key: 'recharge', event: {}, phase: 'choice', data: {} } });
    S().applyTeamIntent('tA', 'turnEventRecharge', { key: 'bouclier', uid: uid() }); // non possédé
    expect(S().teams[0].powers.bouclier).toBeUndefined();
    S().applyTeamIntent('tA', 'turnEventRecharge', { key: 'foudre', uid: uid() });
    expect(S().teams[0].powers.foudre.charges).toBe(2);
  });

  it('turnEventClose seulement en phase result', () => {
    setup({ showEvent: { key: 'x', event: {}, phase: 'intro', data: {} } });
    S().applyTeamIntent('tA', 'turnEventClose', { uid: uid() });
    expect(S().showEvent).not.toBeNull();
  });
});

describe('duel, loot, coffre, boutique', () => {
  it('turnDuelChoose : lance le combat contre un défenseur valide', () => {
    setup({ showDuelChoice: { defenders: [1], blocked: [], subject: 'maths' } });
    S().applyTeamIntent('tA', 'turnDuelChoose', { index: 1, uid: uid() });
    expect(S().showDuelChoice).toBeNull();
    expect(S().showFight).toBeTruthy();
  });

  it('turnDuelChoose sur une équipe non défiable : no-op', () => {
    setup({ showDuelChoice: { defenders: [], blocked: [1], subject: 'maths' } });
    S().applyTeamIntent('tA', 'turnDuelChoose', { index: 1, uid: uid() });
    expect(S().showDuelChoice).not.toBeNull();
  });

  it('turnDuelDecline : joue la case normalement', () => {
    setup({ showDuelChoice: { defenders: [1], blocked: [], subject: 'maths' }, askedQuestions: {}, questions: { maths: [{ q: '1+1 ?', a: ['2', '3'], c: 0 }], svt: [{ q: '?', a: ['a', 'b'], c: 0 }], histoire: [{ q: '?', a: ['a', 'b'], c: 0 }] } });
    S().applyTeamIntent('tA', 'turnDuelDecline', { uid: uid() });
    expect(S().showDuelChoice).toBeNull();
  });

  it('turnLootDismiss ferme la révélation de butin', () => {
    setup({ lootReveal: { itemKey: 'painVoyageur' } });
    S().applyTeamIntent('tA', 'turnLootDismiss', { uid: uid() });
    expect(S().lootReveal).toBeNull();
  });

  it('turnStarterChest : or versé + objets choisis (validés contre les coffres)', () => {
    setup({ showStarterChest: true, lastStarterReward: { gold: 20, choices: ['painVoyageur', 'chapeauPaille'], keep: 1 } });
    S().applyTeamIntent('tA', 'turnStarterChest', { keys: ['painVoyageur', 'chapeauPaille'], uid: uid() });
    expect(S().showStarterChest).toBe(false);
    expect(S().teams[0].money).toBe(70); // 50 + 20
    // keep=1 : un seul objet retenu malgré 2 clés envoyées
    const got = [S().teams[0].equipment.head, ...normalizeBag(S().teams[0].bag).map(cellKey)].filter(Boolean);
    expect(got).toEqual(['painVoyageur']);
  });

  it('turnShopDismiss ferme le prompt boutique', () => {
    setup({ showShopPrompt: true });
    S().applyTeamIntent('tA', 'turnShopDismiss', { uid: uid() });
    expect(S().showShopPrompt).toBe(false);
  });
});

describe('combat — périphérie', () => {
  it('turnFightBegin (manette) : versus → duel de rapidité direct, sans briefing TBI', () => {
    setup({ showFight: { phase: 'versus', attackerIndex: 0, defenderIndex: 1, subject: 'maths', round: 1, wins: { attacker: 0, defender: 0 } } });
    S().applyTeamIntent('tA', 'turnFightBegin', { uid: uid() });
    expect(S().showFight.phase).toBe('minigame');
    expect(S().showFight.race).toBeTruthy(); // question servie, jouable au téléphone
  });

  it('turnFightReward : refusé si l’équipe active n’est pas la gagnante', () => {
    setup({ showFight: { phase: 'reward', attackerIndex: 0, defenderIndex: 1, winnerSide: 'defender', reward: {}, wins: { attacker: 0, defender: 2 } } });
    S().applyTeamIntent('tA', 'turnFightReward', { choice: 'steal', uid: uid() });
    expect(S().showFight.reward?.choice).toBeUndefined();
  });
});
