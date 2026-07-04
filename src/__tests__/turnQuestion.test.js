// Tests : manette téléphone — question pilotée par le store (deadline,
// sélection, révélation) + intents turnAnswerSelect/turnQuestionContinue +
// stripping anti-triche du payload.
import { describe, it, expect } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { questionDuration } from '../logic/turnHelpers.js';
import { buildTurnPayload } from '../logic/sessionConfig.js';

const S = () => useGameStore.getState();

const Q = { q: 'Combien font 2 + 2 ?', a: ['1', '4', '3', '22'], c: 1, e: 'Deux plus deux font quatre.' };

const BOARD = {
  depart: { type: 'depart', x: 0, y: 0, next: ['a'] },
  a: { type: 'subject', subject: 'maths', x: 1, y: 0, next: ['b'] },
  b: { type: 'subject', subject: 'svt', x: 2, y: 0, next: [] },
};

const RESET = {
  showQuestion: null, showEvent: null, showFight: null, showDuelChoice: null,
  rolling: false, showDiceModal: false, awaitingChoice: false, pendingActions: null,
  pendingLanding: false, pendingMove: null, diceValue: null,
  indiceUsed: false, indiceHidden: [],
};

let uidSeq = 100;
const uid = () => `tq-uid-${++uidSeq}`;

// Pose une question « à la main » (même forme que askQuestion) : le flux
// sélection/révélation/continuer ne dépend pas du tirage dans le pool.
function openQuestion(over = {}, sqOver = {}) {
  const sq = {
    question: Q, subject: 'maths', index: 0, timerHalved: false, timerDivisor: 1,
    itemBonusTime: 0, multiIndex: null, multiTotal: null, sharedStart: undefined,
    confused: false, timerCap: null, modeleur: null, revealHint: false, revealed: false,
    ...sqOver,
  };
  useGameStore.setState({
    phase: 'game', devSandbox: true, finished: false, currentTeam: 0, log: [],
    phoneController: true, board: BOARD, ...RESET,
    showQuestion: { ...sq, deadline: Date.now() + questionDuration(sq) * 1000, selected: null, answerRevealed: false, timeLeftAtReveal: null },
    teams: [
      { name: 'A', emoji: '🦁', color: '#111', money: 10, token: 'tA', pos: 'b', correct: 0, wrong: 0, equipment: { head: null, body: null, feet: null }, bag: [], powers: {} },
      { name: 'B', emoji: '🦅', color: '#222', money: 10, token: 'tB', pos: 'depart', correct: 0, wrong: 0, equipment: { head: null, body: null, feet: null }, bag: [], powers: {} },
    ],
    ...over,
  });
}

describe('questionDuration (formule unique du timer)', () => {
  it('base 30 s ; Sablier ÷2 ; bonus équipement ; chrono partagé ; plafond', () => {
    expect(questionDuration({ timerDivisor: 1, itemBonusTime: 0 })).toBe(30);
    expect(questionDuration({ timerDivisor: 2, itemBonusTime: 0 })).toBe(15);
    expect(questionDuration({ timerHalved: true, itemBonusTime: 0 })).toBe(15);
    expect(questionDuration({ timerDivisor: 1, itemBonusTime: 8 })).toBe(38);
    expect(questionDuration({ sharedStart: 12, timerDivisor: 2, itemBonusTime: 8 })).toBe(12);
    expect(questionDuration({ timerDivisor: 1, itemBonusTime: 0, timerCap: 10 })).toBe(10);
  });
});

describe('selectAnswer / revealQuestionTimeout / continueQuestion', () => {
  it('selectAnswer fige la sélection, la révélation et le temps restant', () => {
    openQuestion();
    S().selectAnswer(1);
    const sq = S().showQuestion;
    expect(sq.selected).toBe(1);
    expect(sq.answerRevealed).toBe(true);
    expect(sq.timeLeftAtReveal).toBeGreaterThanOrEqual(29);
    expect(sq.timeLeftAtReveal).toBeLessThanOrEqual(30);
  });

  it('selectAnswer refuse une seconde sélection', () => {
    openQuestion();
    S().selectAnswer(1);
    S().selectAnswer(2);
    expect(S().showQuestion.selected).toBe(1); // la première fait foi
  });

  it('selectAnswer refuse une réponse barrée (indiceHidden)', () => {
    openQuestion({ indiceHidden: [0, 2] });
    S().selectAnswer(0);
    expect(S().showQuestion.answerRevealed).toBe(false);
  });

  it('selectAnswer refuse un index hors bornes', () => {
    openQuestion();
    S().selectAnswer(9);
    expect(S().showQuestion.answerRevealed).toBe(false);
  });

  it('revealQuestionTimeout : révélation sans sélection, temps 0', () => {
    openQuestion();
    S().revealQuestionTimeout();
    const sq = S().showQuestion;
    expect(sq.selected).toBeNull();
    expect(sq.answerRevealed).toBe(true);
    expect(sq.timeLeftAtReveal).toBe(0);
  });

  it('continueQuestion (bonne réponse) : résout et compte le point', () => {
    openQuestion();
    S().selectAnswer(1); // bonne réponse (c = 1)
    S().continueQuestion();
    expect(S().teams[0].correct).toBe(1);
    expect(S().showQuestion).toBeNull();
  });

  it('continueQuestion (mauvaise réponse) : compte l’erreur', () => {
    openQuestion();
    S().selectAnswer(0);
    S().continueQuestion();
    expect(S().teams[0].wrong).toBe(1);
  });

  it('continueQuestion sans révélation : no-op', () => {
    openQuestion();
    S().continueQuestion();
    expect(S().showQuestion).not.toBeNull();
    expect(S().teams[0].correct).toBe(0);
  });

  it('extendQuestionDeadline prolonge l’horloge', () => {
    openQuestion();
    const before = S().showQuestion.deadline;
    S().extendQuestionDeadline(10);
    expect(S().showQuestion.deadline).toBe(before + 10000);
  });
});

describe('intents turnAnswerSelect / turnQuestionContinue', () => {
  it('l’équipe active répond depuis son téléphone', () => {
    openQuestion();
    S().applyTeamIntent('tA', 'turnAnswerSelect', { index: 1, uid: uid() });
    expect(S().showQuestion.answerRevealed).toBe(true);
    S().applyTeamIntent('tA', 'turnQuestionContinue', { uid: uid() });
    expect(S().teams[0].correct).toBe(1);
  });

  it('une équipe NON active ne peut pas répondre', () => {
    openQuestion();
    S().applyTeamIntent('tB', 'turnAnswerSelect', { index: 1, uid: uid() });
    expect(S().showQuestion.answerRevealed).toBe(false);
  });

  it('double turnAnswerSelect (uids distincts) : la première sélection fait foi', () => {
    openQuestion();
    S().applyTeamIntent('tA', 'turnAnswerSelect', { index: 2, uid: uid() });
    S().applyTeamIntent('tA', 'turnAnswerSelect', { index: 1, uid: uid() });
    expect(S().showQuestion.selected).toBe(2);
  });

  it('turnAnswerSelect sur une réponse barrée : refusé', () => {
    openQuestion({ indiceHidden: [3] });
    S().applyTeamIntent('tA', 'turnAnswerSelect', { index: 3, uid: uid() });
    expect(S().showQuestion.answerRevealed).toBe(false);
  });

  it('turnQuestionContinue avant révélation : no-op', () => {
    openQuestion();
    S().applyTeamIntent('tA', 'turnQuestionContinue', { uid: uid() });
    expect(S().showQuestion).not.toBeNull();
  });
});

describe('payload turn.question — anti-triche', () => {
  const stateFor = () => ({
    finished: false, teams: S().teams, currentTeam: 0, board: BOARD,
    rolling: false, showDiceModal: false, diceValue: null,
    awaitingChoice: false, pendingMove: null, pendingLanding: false,
    showQuestion: S().showQuestion, showEvent: null, showFight: null, showDuelChoice: null,
    showTargetPicker: null, showTilePicker: null, showSubjectPicker: false,
    showChargePicker: false, showActionDice: null, lootReveal: null,
    showStarterChest: false, lastStarterReward: null, showShopPrompt: false,
    showMetierPicker: false, indiceHidden: S().indiceHidden, indiceUsed: S().indiceUsed,
  });

  it('AVANT révélation : ni bonne réponse ni explication dans le payload', () => {
    openQuestion({ indiceHidden: [2] });
    const turn = buildTurnPayload(stateFor());
    expect(turn.phase).toBe('question');
    expect(turn.question.q).toBe(Q.q);
    expect(turn.question.a).toEqual(Q.a);
    expect(turn.question.hidden).toEqual([2]);
    expect(turn.question.answerRevealed).toBe(false);
    expect(turn.question.correctIndex).toBeUndefined();
    expect(turn.question.explanation).toBeUndefined();
    const raw = JSON.stringify(turn);
    expect(raw).not.toContain(Q.e); // l'explication trahirait la réponse
  });

  it('APRÈS révélation : bonne réponse + explication publiées', () => {
    openQuestion();
    S().selectAnswer(0);
    const turn = buildTurnPayload(stateFor());
    expect(turn.question.answerRevealed).toBe(true);
    expect(turn.question.selected).toBe(0);
    expect(turn.question.correctIndex).toBe(1);
    expect(turn.question.explanation).toBe(Q.e);
  });

  it('la Clairvoyance (revealHint) n’est jamais publiée', () => {
    openQuestion({}, { revealHint: true, revealed: true });
    const turn = buildTurnPayload(stateFor());
    expect(JSON.stringify(turn)).not.toContain('revealHint');
  });
});
