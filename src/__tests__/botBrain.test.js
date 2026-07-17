// Tests du CERVEAU des bots (mode solo) : fonctions pures état → décision.
import { describe, it, expect } from 'vitest';
import {
  BOT_LEVELS, pickAnswerIndex, pickJunction, distanceToFinish,
  pickLeaderTarget, pickReward, pendingDecision, stateSignature,
} from '../logic/botBrain.js';

// Plateau minimal avec jonction : depart → n1 → j1 → (a1→a2→arrivee | b1→b2→b3→arrivee)
const BOARD = {
  depart: { x: 0, y: 0, type: 'depart', next: ['n1'] },
  n1: { x: 1, y: 0, type: 'subject', subject: 'maths', next: ['j1'] },
  j1: { x: 2, y: 0, type: 'jonction', next: ['a1', 'b1'] },
  a1: { x: 3, y: -1, type: 'subject', subject: 'maths', next: ['a2'] },
  a2: { x: 4, y: -1, type: 'subject', subject: 'maths', next: ['arrivee'] },
  b1: { x: 3, y: 1, type: 'subject', subject: 'maths', next: ['b2'] },
  b2: { x: 4, y: 1, type: 'subject', subject: 'maths', next: ['b3'] },
  b3: { x: 5, y: 1, type: 'subject', subject: 'maths', next: ['arrivee'] },
  arrivee: { x: 6, y: 0, type: 'arrivee', next: [] },
};

const Q = { q: 'Q ?', a: ['a', 'b', 'c', 'd'], c: 2 };

const bot = (over = {}) => ({
  name: 'Bot', isBot: true, botLevel: 'moyen', pos: 'depart', money: 0,
  powers: {}, equipment: { head: null, body: null, feet: null }, bag: [], ...over,
});
const human = (over = {}) => ({
  name: 'Hum', pos: 'depart', money: 0,
  powers: {}, equipment: { head: null, body: null, feet: null }, bag: [], ...over,
});

// État de jeu minimal : humain (0) + bot (1), au bot de jouer par défaut.
const state = (over = {}) => ({
  phase: 'game', finished: false, teams: [human(), bot()], currentTeam: 1,
  board: BOARD, questions: { maths: [Q] },
  showQuestion: null, showEvent: null, showFight: null, showDuelChoice: null,
  showTargetPicker: null, showTilePicker: null, showChargePicker: false,
  showSubjectPicker: false, showInvestPicker: null, investResult: null,
  lootReveal: null, showStarterChest: false, lastStarterReward: null,
  showMetierPicker: false, awaitingChoice: false, pendingMove: null,
  pendingLanding: false, pendingActions: null, rolling: false,
  showDiceModal: false, hackOverlay: null, showShop: false, showShopPrompt: false,
  indiceHidden: [], turnCount: 0, boardSubjects: ['maths'],
  ...over,
});

describe('pickAnswerIndex', () => {
  it('rng < p → vise la bonne réponse', () => {
    expect(pickAnswerIndex(Q, [], 0.6, () => 0.1)).toBe(2);
  });
  it('rng ≥ p → une mauvaise réponse non barrée', () => {
    const idx = pickAnswerIndex(Q, [0, 1], 0.6, () => 0.9);
    expect(idx).toBe(3); // seule mauvaise non barrée
  });
  it('toutes les mauvaises barrées → bonne réponse forcée', () => {
    expect(pickAnswerIndex(Q, [0, 1, 3], 0.0, () => 0.9)).toBe(2);
  });
});

describe('heuristiques de plateau', () => {
  it('distanceToFinish suit next[] (BFS)', () => {
    expect(distanceToFinish(BOARD, 'arrivee')).toBe(0);
    expect(distanceToFinish(BOARD, 'a1')).toBe(2);
    expect(distanceToFinish(BOARD, 'b1')).toBe(3);
  });
  it('pickJunction choisit la branche la plus courte', () => {
    expect(pickJunction(BOARD, 'j1', () => 0)).toBe('a1');
  });
  it('pickLeaderTarget vise l’adversaire le plus proche de l’arrivée', () => {
    const s = state({ teams: [human({ pos: 'a2' }), bot(), bot({ pos: 'n1' })], currentTeam: 1 });
    expect(pickLeaderTarget(s, 1)).toBe(0);
  });
  it('pickReward : recul si le perdant est devant, sinon vol si bourse', () => {
    const ahead = state({ teams: [human({ pos: 'a2', money: 0 }), bot({ pos: 'n1' })] });
    expect(pickReward(ahead, { winnerSide: 'defender', attackerIndex: 0, defenderIndex: 1 })).toBe('knockback');
    const rich = state({ teams: [human({ pos: 'depart', money: 20 }), bot({ pos: 'a2' })] });
    expect(pickReward(rich, { winnerSide: 'defender', attackerIndex: 0, defenderIndex: 1 })).toBe('steal');
    const poor = state({ teams: [human({ pos: 'depart', money: 2 }), bot({ pos: 'a2' })] });
    expect(pickReward(poor, { winnerSide: 'defender', attackerIndex: 0, defenderIndex: 1 })).toBe('loot');
  });
});

describe('pendingDecision — tour de base', () => {
  it('tour de l’humain → null', () => {
    expect(pendingDecision(state({ currentTeam: 0 }))).toBeNull();
  });
  it('aucun bot dans la partie → null', () => {
    expect(pendingDecision(state({ teams: [human(), human()] }))).toBeNull();
  });
  it('tour libre du bot → rollDice', () => {
    const p = pendingDecision(state());
    expect(p.decide(() => 0.5).action).toBe('rollDice');
  });
  it('dé en cours d’animation → rien', () => {
    expect(pendingDecision(state({ rolling: true, showDiceModal: true }))).toBeNull();
  });
  it('question non révélée → botSelectAnswer (bonne réponse si rng < p)', () => {
    const sq = { question: Q, deadline: 123456, answerRevealed: false };
    const p = pendingDecision(state({ showQuestion: sq }));
    const d = p.decide(() => 0.1);
    expect(d.action).toBe('botSelectAnswer');
    expect(d.args[0]).toBe(2);
    const [lo, hi] = BOT_LEVELS.moyen.ratio;
    expect(d.args[1]).toBeGreaterThanOrEqual(lo);
    expect(d.args[1]).toBeLessThanOrEqual(hi);
  });
  it('question révélée → continueQuestion (et signature distincte)', () => {
    const open = state({ showQuestion: { question: Q, deadline: 9, answerRevealed: false } });
    const revealed = state({ showQuestion: { question: Q, deadline: 9, answerRevealed: true, selected: 2 } });
    expect(pendingDecision(revealed).decide(() => 0).action).toBe('continueQuestion');
    expect(stateSignature(open)).not.toBe(stateSignature(revealed));
  });
  it('jonction → chooseJunction sur la branche la plus courte', () => {
    const s = state({ teams: [human(), bot({ pos: 'j1' })], awaitingChoice: true, pendingMove: { remaining: 2 } });
    const d = pendingDecision(s).decide(() => 0);
    expect(d.action).toBe('chooseJunction');
    expect(d.args[0]).toBe('a1');
  });
  it('atterrissage → confirmLanding', () => {
    expect(pendingDecision(state({ pendingLanding: true })).decide(() => 0).action).toBe('confirmLanding');
  });
  it('choix de duel → declineDuel (v1)', () => {
    expect(pendingDecision(state({ showDuelChoice: { defenders: [0] } })).decide(() => 0).action).toBe('declineDuel');
  });
  it('coffre de départ → closeStarterChest avec ≤ keep choix valides', () => {
    const s = state({ showStarterChest: true, lastStarterReward: { gold: 20, choices: ['x', 'y', 'z'], keep: 2 } });
    const d = pendingDecision(s).decide(() => 0.4);
    expect(d.action).toBe('closeStarterChest');
    expect(d.args[0]).toHaveLength(2);
    d.args[0].forEach((k) => expect(['x', 'y', 'z']).toContain(k));
  });
});

describe('pendingDecision — événements', () => {
  it('intro → acceptEvent ; result → closeEvent', () => {
    expect(pendingDecision(state({ showEvent: { key: 'tresor', phase: 'intro', data: {} } })).decide(() => 0).action).toBe('acceptEvent');
    expect(pendingDecision(state({ showEvent: { key: 'tresor', phase: 'result', data: {} } })).decide(() => 0).action).toBe('closeEvent');
  });
  it('roulette → aucune action (auto), secours = revealEvent', () => {
    const p = pendingDecision(state({ showEvent: { key: 'x', phase: 'roulette', data: {} } }));
    expect(p.decide(() => 0)).toBeNull();
    expect(p.fallback.action).toBe('revealEvent');
  });
  it('target → eventSelectTarget sur le leader adverse', () => {
    const s = state({
      teams: [human({ pos: 'a2' }), bot(), bot({ pos: 'n1' })],
      showEvent: { key: 'volArgent', phase: 'target', data: {} },
    });
    const d = pendingDecision(s).decide(() => 0);
    expect(d.action).toBe('eventSelectTarget');
    expect(d.args[0]).toBe(0);
  });
  it('question d’événement → eventAnswerQuestion', () => {
    const s = state({ showEvent: { key: 'pari', phase: 'question', data: { eventQuestion: Q } } });
    const d = pendingDecision(s).decide(() => 0.05);
    expect(d.action).toBe('eventAnswerQuestion');
    expect(d.args[0]).toBe(2);
  });
  it('va-tout : pot > 0 → encaisser', () => {
    const s = state({ showEvent: { key: 'vaTout', phase: 'vaToutChoice', data: { vaToutPot: 5 } } });
    expect(pendingDecision(s).decide(() => 0).action).toBe('eventVaToutCashOut');
  });
  it('choice troisCoffres → eventChooseGift parmi les cadeaux', () => {
    const s = state({ showEvent: { key: 'troisCoffres', phase: 'choice', data: { gifts: ['g1', 'g2'] } } });
    const d = pendingDecision(s).decide(() => 0.9);
    expect(d.action).toBe('eventChooseGift');
    expect(['g1', 'g2']).toContain(d.args[0]);
  });
  it('choice recharge → le pouvoir le moins chargé', () => {
    const t = bot({ powers: { foudre: { charges: 3, level: 1 }, bouclier: { charges: 1, level: 1 } } });
    const s = state({ teams: [human(), t], showEvent: { key: 'recharge', phase: 'choice', data: {} } });
    const d = pendingDecision(s).decide(() => 0);
    expect(d.action).toBe('eventRechargeChoice');
    expect(d.args[0]).toBe('bouclier');
  });
  it('choice marchand → declineEvent (v1, pas d’achats)', () => {
    const s = state({ showEvent: { key: 'marchandAmbulant', phase: 'choice', data: { merchandise: ['a'] } } });
    expect(pendingDecision(s).decide(() => 0).action).toBe('declineEvent');
  });
  it('phase inconnue → secours declineEvent (anti soft-lock)', () => {
    const p = pendingDecision(state({ showEvent: { key: 'x', phase: 'mystere', data: {} } }));
    expect(p.fallback.action).toBe('declineEvent');
  });
});

describe('pendingDecision — duels (course)', () => {
  const fight = (over = {}) => ({
    attackerIndex: 0, defenderIndex: 1, subject: 'maths', phase: 'minigame',
    wins: { attacker: 0, defender: 0 }, winnerSide: null, reward: null,
    race: { q: Q, answers: {}, deadline: 777 }, ...over,
  });
  it('duelliste bot n’ayant pas répondu → submitFightAnswer', () => {
    const d = pendingDecision(state({ showFight: fight() })).decide(() => 0.1);
    expect(d.action).toBe('submitFightAnswer');
    expect(d.args).toEqual([1, 2]); // bot défenseur vise la bonne réponse
  });
  it('bot a répondu, humain pas encore → rien (timeout de course)', () => {
    const f = fight({ race: { q: Q, answers: { defender: { index: 2, at: 1 } }, deadline: 777 } });
    expect(pendingDecision(state({ showFight: f }))).toBeNull();
  });
  it('reward gagné par le bot → fightChooseReward', () => {
    const f = fight({ phase: 'reward', winnerSide: 'defender', race: null });
    expect(pendingDecision(state({ showFight: f })).decide(() => 0).action).toBe('fightChooseReward');
  });
  it('reward gagné par l’humain → rien', () => {
    const f = fight({ phase: 'reward', winnerSide: 'attacker', race: null });
    expect(pendingDecision(state({ showFight: f }))).toBeNull();
  });
  it('result avec humain au duel → l’humain garde le bouton', () => {
    const f = fight({ phase: 'result', winnerSide: 'defender', race: null });
    expect(pendingDecision(state({ showFight: f }))).toBeNull();
  });
  it('result 100 % bot (bot vs boss) → closeFight', () => {
    const f = fight({ attackerIndex: 1, defenderIndex: -1, boss: {}, bossFight: true, phase: 'result', winnerSide: 'attacker', race: null });
    expect(pendingDecision(state({ showFight: f })).decide(() => 0).action).toBe('closeFight');
  });
});

describe('pendingDecision — sélection des pouvoirs', () => {
  it('bot sans pouvoir choisi → selectPower puis advancePowerSetup', () => {
    const s = state({ phase: 'powerSelect', powerSetupIndex: 1, powerSetupCategory: 'def' });
    const d = pendingDecision(s).decide(() => 0);
    expect(d.action).toBe('selectPower');
    expect(d.args[0]).toBe(1);
    expect(d.args[1]).toBe('def');
    const s2 = state({ phase: 'powerSelect', powerSetupIndex: 1, powerSetupCategory: 'def', teams: [human(), bot({ powerDef: 'bouclier' })] });
    expect(pendingDecision(s2).decide(() => 0).action).toBe('advancePowerSetup');
    expect(stateSignature(s)).not.toBe(stateSignature(s2));
  });
  it('humain en sélection → null', () => {
    expect(pendingDecision(state({ phase: 'powerSelect', powerSetupIndex: 0, powerSetupCategory: 'def' }))).toBeNull();
  });
});

describe('pendingDecision — interrupts du moteur', () => {
  it('showTargetPicker → selectTarget (leader adverse)', () => {
    const s = state({ teams: [human({ pos: 'a2' }), bot()], showTargetPicker: { source: 'engine' } });
    const d = pendingDecision(s).decide(() => 0);
    expect(d.action).toBe('selectTarget');
    expect(d.args[0]).toBe(0);
  });
  it('interrupt d’un bot pendant le tour de l’HUMAIN (sourceTeam) → le bot répond', () => {
    const s = state({
      currentTeam: 0,
      pendingActions: { ctx: { sourceTeam: 1 } },
      showChargePicker: { source: 'engine' },
      teams: [human(), bot({ powers: { foudre: { charges: 0, level: 1 } } })],
    });
    const d = pendingDecision(s).decide(() => 0);
    expect(d.action).toBe('chargePickerChoice');
    expect(d.args[0]).toBe('foudre');
  });
  it('file d’effets en cours SANS interrupt → on attend', () => {
    expect(pendingDecision(state({ pendingActions: { ctx: {} } }))).toBeNull();
  });
  it('showInvestPicker → cancelInvest (v1)', () => {
    expect(pendingDecision(state({ showInvestPicker: { teamIndex: 1 } })).decide(() => 0).action).toBe('cancelInvest');
  });
});
