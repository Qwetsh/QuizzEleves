// Tests des effets ajoutés le 2026-07-10 :
//  - épines (thorns) : renvoi partiel du vol d'or / du recul à l'attaquant
//  - garde-série (streakGuard) : la série ne casse pas sur une erreur
//  - seconde chance (secondChance) : rejoue une mauvaise réponse une fois
//  - échange de place (swapPositions)
//  - vol d'objet ciblé (stealItem)
//  - thème « aléatoire (avec/sans choix) » sur forceSubject / rerollQuestion
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { ITEMS } from '../data/items.js';
import { SUBJECTS, SUBJECT_KEYS } from '../data/subjects.js';
import { allSubjectsWithContent, getSubjectPool } from '../data/questions/index.js';
import { runEffects } from '../store/effectEngine.js';
import { applyRecul } from '../logic/turnHelpers.js';
import { cellKey, normalizeBag } from '../store/itemHandlers.js';

const LINEAR = (() => {
  const b = { depart: { x: 0, y: 0, type: 'depart', next: ['n1'] } };
  for (let i = 1; i <= 8; i++) b[`n${i}`] = { x: i, y: 0, type: 'subject', subject: 'maths', next: [i === 8 ? 'arrivee' : `n${i + 1}`] };
  b.arrivee = { x: 9, y: 0, type: 'arrivee', next: [] };
  return b;
})();

const QUESTIONS = {
  maths: [{ q: 'Q1 ?', a: ['A', 'B', 'C', 'D'], c: 1 }, { q: 'Q2 ?', a: ['A', 'B', 'C', 'D'], c: 2 }],
  francais: [{ q: 'F1 ?', a: ['A', 'B', 'C', 'D'], c: 0 }],
};

function mkTeam(i, over = {}) {
  return {
    name: `T${i}`, color: '#111', emoji: '🦁',
    pos: 'n4', correct: 0, wrong: 0, streak: 0, money: 50,
    powerDef: null, powerOff: null, powers: {},
    sablierActif: false, doubleActive: false, buffs: [],
    equipment: { head: null, body: null, feet: null }, bag: [],
    ...over,
  };
}

function freshGame(overrides = [{}, {}], board = LINEAR) {
  useGameStore.setState({
    phase: 'game', devSandbox: true,
    teams: overrides.map((o, i) => mkTeam(i, o)),
    currentTeam: 0, board, finished: false,
    askedQuestions: {}, questions: QUESTIONS, log: [], boardSubjects: SUBJECT_KEYS.slice(),
    rolling: false, diceValue: null, pendingMove: null, pendingLanding: false,
    awaitingChoice: false, showQuestion: null, showEvent: null, showFight: null,
    showTargetPicker: null, showShop: false, showInventory: false,
    showInvestPicker: null, investResult: null, pendingInvestResult: null,
    showChargePicker: false, showDiceModal: false,
    indiceUsed: false, indiceHidden: [], freeActivation: false,
    movePath: null, preRollPos: null, preRollValue: null,
    pendingActions: null, showTilePicker: null, showActionDice: null,
    showSubjectPicker: false, rerollUsed: false, trapDepth: 0, categoryPools: {},
    // Loot de bonne réponse NEUTRALISÉ : les canaux consommable/équipement tirent
    // Math.random() à chaque bonne réponse et un drop ouvre LootReveal — ce qui
    // diffère afterCorrectResolve (bilan d'investissement) et rendait ces tests
    // FLAKY (~20 %). Catalogue vide → aucun tirage ne peut aboutir.
    enabledItems: [],
  });
}

const S = () => useGameStore.getState();
const team = (i = 0) => S().teams[i];
const set = (patch) => useGameStore.setState(patch);
const get = () => S();
const exec = (actions, ctx = {}) => runEffects(set, get, actions, ctx);

beforeEach(() => freshGame());

describe('épines (thorns)', () => {
  it('renvoie un % de l’or volé à l’attaquant', () => {
    freshGame([{ money: 50 }, { money: 50, buffs: [{ type: 'thorns', n: 50, turns: 3 }] }]);
    exec([{ action: 'money', mode: 'steal', target: 'target', n: 20, unit: 'flat' }], { sourceTeam: 0, targetTeam: 1 });
    expect(team(1).money).toBe(30);        // 50 − 20 volés
    expect(team(0).money).toBe(60);        // 50 + 20 − 10 (épines : 50 % de 20)
  });

  it('renvoie une part du recul à l’attaquant', () => {
    freshGame([{ pos: 'n4' }, { pos: 'n6', buffs: [{ type: 'thorns', n: 50, turns: 3 }] }]);
    exec([{ action: 'move', target: 'target', dir: 'back', n: 4 }], { sourceTeam: 0, targetTeam: 1 });
    expect(team(1).pos).toBe('n2');        // n6 − 4
    expect(team(0).pos).toBe('n2');        // n4 − 2 (épines : 50 % de 4)
  });

  it('sans épines : aucun retour', () => {
    exec([{ action: 'money', mode: 'steal', target: 'target', n: 20, unit: 'flat' }], { sourceTeam: 0, targetTeam: 1 });
    expect(team(0).money).toBe(70);        // 50 + 20, pas de retour
  });
});

describe('échange de place (swapPositions)', () => {
  it('permute les positions source ↔ cible', () => {
    freshGame([{ pos: 'n2' }, { pos: 'n6' }]);
    exec([{ action: 'swapPositions', target: 'target' }], { sourceTeam: 0, targetTeam: 1 });
    expect(team(0).pos).toBe('n6');
    expect(team(1).pos).toBe('n2');
  });

  it('même case : sans effet', () => {
    freshGame([{ pos: 'n4' }, { pos: 'n4' }]);
    exec([{ action: 'swapPositions', target: 'target' }], { sourceTeam: 0, targetTeam: 1 });
    expect(team(0).pos).toBe('n4');
    expect(team(1).pos).toBe('n4');
  });
});

describe('vol d’objet ciblé (stealItem)', () => {
  const consKey = Object.keys(ITEMS).find((k) => ITEMS[k]?.slot === 'consumable');

  it('transfère un objet de la cible vers la source', () => {
    if (!consKey) return; // pas de catalogue chargé : test ignoré
    freshGame([{ bag: [] }, { bag: [consKey] }]);
    exec([{ action: 'stealItem', target: 'target' }], { sourceTeam: 0, targetTeam: 1 });
    const thiefHas = normalizeBag(team(0).bag).some((c) => cellKey(c) === consKey);
    const victimHas = normalizeBag(team(1).bag).some((c) => cellKey(c) === consKey);
    expect(thiefHas).toBe(true);
    expect(victimHas).toBe(false);
  });

  it('cible immunisée au vol d’objet : rien pris', () => {
    if (!consKey) return;
    freshGame([{ bag: [] }, { bag: [consKey], buffs: [{ type: 'itemStealImmune', turns: 3 }] }]);
    exec([{ action: 'stealItem', target: 'target' }], { sourceTeam: 0, targetTeam: 1 });
    expect(normalizeBag(team(1).bag).some((c) => cellKey(c) === consKey)).toBe(true);
    expect(normalizeBag(team(0).bag).some((c) => cellKey(c) === consKey)).toBe(false);
  });
});

describe('garde-série & seconde chance (réponse)', () => {
  const openQ = () => set({ showQuestion: { question: QUESTIONS.maths[0], subject: 'maths', index: 0, timerHalved: false, timerDivisor: 1, itemBonusTime: 0 } });

  it('garde-série : la série tient malgré une mauvaise réponse', () => {
    freshGame([{ streak: 3, buffs: [{ type: 'streakGuard', turns: 3 }] }, {}]);
    openQ();
    S().answerQuestion(0, 5); // c=1 → mauvaise réponse
    expect(team(0).streak).toBe(3);
  });

  it('sans garde-série : la série casse', () => {
    freshGame([{ streak: 3 }, {}]);
    openQ();
    S().answerQuestion(0, 5);
    expect(team(0).streak).toBe(0);
  });

  it('seconde chance : 1re mauvaise sélection barrée + rejeu, SANS révéler la réponse', () => {
    freshGame([{ streak: 2, pos: 'n4', buffs: [{ type: 'secondChance', turns: 3 }] }, {}]);
    openQ(); // question c=1
    S().selectAnswer(0); // mauvaise sélection
    expect(S().showQuestion).toBeTruthy();
    expect(S().showQuestion.answerRevealed).toBe(false);           // pas de spoiler
    expect(S().showQuestion.secondChanceUsed).toBe(true);
    expect(S().indiceHidden).toContain(0);                          // mauvaise réponse barrée
    expect(team(0).buffs.some((b) => b.type === 'secondChance')).toBe(false); // consommé
    expect(team(0).pos).toBe('n4');                                 // pas de recul
    expect(team(0).streak).toBe(2);
    // 2e sélection (plus de buff) → révélation normale
    S().selectAnswer(2);
    expect(S().showQuestion.answerRevealed).toBe(true);
    expect(S().showQuestion.selected).toBe(2);
  });

  it('bonne réponse : la seconde chance n’est PAS consommée', () => {
    freshGame([{ buffs: [{ type: 'secondChance', turns: 3 }] }, {}]);
    openQ();
    S().selectAnswer(1); // correcte (c=1)
    expect(S().showQuestion.answerRevealed).toBe(true);
    expect(team(0).buffs.some((b) => b.type === 'secondChance')).toBe(true);
  });

  it('seconde chance : temps écoulé rejoué (sans révéler)', () => {
    freshGame([{ buffs: [{ type: 'secondChance', turns: 3 }] }, {}]);
    openQ();
    S().revealQuestionTimeout();
    expect(S().showQuestion.answerRevealed).toBe(false);
    expect(S().showQuestion.secondChanceUsed).toBe(true);
    expect(team(0).buffs.some((b) => b.type === 'secondChance')).toBe(false);
  });
});

describe('thème aléatoire (avec / sans choix)', () => {
  // Le vivier = TOUS les thèmes chargés (STORE global), pas seulement ceux de la
  // partie. On vérifie donc que le thème tiré a bien un pool de questions.
  it('forceSubject aléatoire sans choix : impose un thème DISPONIBLE (hors partie ok)', () => {
    exec([{ action: 'forceSubject', target: 'self', subject: { random: true } }], { sourceTeam: 0 });
    const s = team(0).forcedSubject;
    expect(typeof s).toBe('string');
    expect(getSubjectPool(s).length).toBeGreaterThan(0);
    expect(allSubjectsWithContent()).toContain(s);
    expect(S().showSubjectPicker).toBeFalsy();
  });

  it('forceSubject aléatoire à 2 choix : ouvre un picker limité puis résout', () => {
    if (allSubjectsWithContent().length < 2) return; // vivier trop petit : ignoré
    exec([{ action: 'forceSubject', target: 'self', subject: { random: true, choices: 2 } }], { sourceTeam: 0 });
    const sp = S().showSubjectPicker;
    expect(sp && Array.isArray(sp.choices)).toBe(true);
    expect(sp.choices.length).toBe(2);
    const chosen = sp.choices[0];
    S().selectSubject(chosen);
    expect(S().showSubjectPicker).toBeFalsy();
    expect(team(0).forcedSubject).toBe(chosen);
  });

  it('pool restreint : ne tire que dans le pool fourni', () => {
    // 'francais' a du contenu dans le STORE embarqué ; on restreint à lui seul.
    if (!getSubjectPool('francais').length) return;
    exec([{ action: 'forceSubject', target: 'self', subject: { random: true, pool: ['francais'] } }], { sourceTeam: 0 });
    expect(team(0).forcedSubject).toBe('francais');
  });

  it('rerollQuestion aléatoire (hors question) : force un thème disponible', () => {
    exec([{ action: 'rerollQuestion', subject: { random: true } }], { sourceTeam: 0 });
    expect(getSubjectPool(S().forcedSubject).length).toBeGreaterThan(0);
  });
});

describe('ancre (déplacement forcé)', () => {
  it('bloque le recul infligé', () => {
    freshGame([{ pos: 'n4' }, { pos: 'n6', buffs: [{ type: 'anchor', turns: 2 }] }]);
    exec([{ action: 'move', target: 'target', dir: 'back', n: 3 }], { sourceTeam: 0, targetTeam: 1 });
    expect(team(1).pos).toBe('n6'); // ancré : pas de recul
  });
  it('bloque l’échange de place', () => {
    freshGame([{ pos: 'n2' }, { pos: 'n6', buffs: [{ type: 'anchor', turns: 2 }] }]);
    exec([{ action: 'swapPositions', target: 'target' }], { sourceTeam: 0, targetTeam: 1 });
    expect(team(0).pos).toBe('n2');
    expect(team(1).pos).toBe('n6');
  });
});

describe('vol de charge', () => {
  it('transfère 1 charge de la cible au voleur', () => {
    freshGame([
      { powers: { foudre: { level: 1, charges: 0 } } },
      { powers: { bouclier: { level: 1, charges: 2 } } },
    ]);
    exec([{ action: 'stealCharge', target: 'target' }], { sourceTeam: 0, targetTeam: 1 });
    expect(team(1).powers.bouclier.charges).toBe(1);
    expect(team(0).powers.foudre.charges).toBe(1);
  });
});

describe('assurance', () => {
  it('rembourse un % de l’or volé', () => {
    freshGame([{ money: 50 }, { money: 50, buffs: [{ type: 'insurance', n: 50, turns: 3 }] }]);
    exec([{ action: 'money', mode: 'steal', target: 'target', n: 20, unit: 'flat' }], { sourceTeam: 0, targetTeam: 1 });
    expect(team(1).money).toBe(40); // 50 − 20 volés + 10 remboursés
    expect(team(0).money).toBe(70); // le voleur garde les 20
  });
});

describe('prime (bounty)', () => {
  it('la mauvaise réponse de la cible rapporte à qui l’a posée', () => {
    freshGame([{ money: 50 }, { money: 50, bountyBy: 0, bountyGold: 15 }]);
    set({ currentTeam: 1, showQuestion: { question: QUESTIONS.maths[0], subject: 'maths', index: 0, timerHalved: false, timerDivisor: 1, itemBonusTime: 0 } });
    S().answerQuestion(0, 5); // c=1 → mauvaise réponse
    expect(team(0).money).toBe(65); // +15 de prime
    expect(team(1).bountyBy).toBeUndefined();
  });
});

describe('investissement', () => {
  const openQ = () => set({ showQuestion: { question: QUESTIONS.maths[0], subject: 'maths', index: 0, timerHalved: false, timerDivisor: 1, itemBonusTime: 0 } });
  it('ouvre la modale de mise et suspend la file', () => {
    freshGame([{ money: 100 }, {}]);
    exec([{ action: 'invest', rate: 200 }], { sourceTeam: 0 });
    expect(S().showInvestPicker).toMatchObject({ teamIndex: 0, gold: 100, rate: 200 });
    expect(team(0).money).toBe(100); // rien n'est déduit tant que la mise n'est pas confirmée
  });
  it('refuser : aucune mise, pas d’investissement', () => {
    freshGame([{ money: 100 }, {}]);
    exec([{ action: 'invest', rate: 200 }], { sourceTeam: 0 });
    S().cancelInvest();
    expect(S().showInvestPicker).toBeNull();
    expect(team(0).investment).toBeUndefined();
    expect(team(0).money).toBe(100);
  });
  it('bonne réponse : remboursé au taux %, bilan mis de côté', () => {
    freshGame([{ money: 100 }, {}]);
    exec([{ action: 'invest', rate: 150 }], { sourceTeam: 0 });
    S().confirmInvest(40);
    expect(team(0).money).toBe(60); // mise déduite
    expect(team(0).investment).toMatchObject({ stake: 40, rate: 150 });
    openQ();
    S().answerQuestion(1, 30); // c=1 → bonne réponse
    expect(team(0).investment).toBeUndefined();
    expect(team(0).money).toBeGreaterThanOrEqual(60 + 60); // +60 (40×150%) au moins
    // Le bilan est présenté en modale après le loot (afterCorrectResolve).
    expect(S().investResult).toMatchObject({ stake: 40, rate: 150, payout: 60 });
  });
  it('mise plafonnée à l’or disponible', () => {
    freshGame([{ money: 30 }, {}]);
    exec([{ action: 'invest', rate: 200 }], { sourceTeam: 0 });
    S().confirmInvest(999);
    expect(team(0).investment).toMatchObject({ stake: 30 });
    expect(team(0).money).toBe(0);
  });
  it('rétrocompat : ancien mult → taux ×100', () => {
    freshGame([{ money: 100 }, {}]);
    exec([{ action: 'invest', mult: 2 }], { sourceTeam: 0 });
    expect(S().showInvestPicker).toMatchObject({ rate: 200 });
    S().confirmInvest(20);
    expect(team(0).investment).toMatchObject({ stake: 20, rate: 200 });
  });
  it('mauvaise réponse : mise perdue', () => {
    freshGame([{ money: 100 }, {}]);
    exec([{ action: 'invest', rate: 200 }], { sourceTeam: 0 });
    S().confirmInvest(20);
    openQ();
    S().answerQuestion(0, 5); // mauvaise réponse
    expect(team(0).investment).toBeUndefined();
    expect(team(0).money).toBe(80); // mise non récupérée
  });
});

describe('point de contrôle (applyRecul)', () => {
  it('n’agit PAS comme une barrière : le recul est normal', () => {
    const board = LINEAR;
    const t = mkTeam(0, { pos: 'n6', checkpoint: 'n4', checkpointConsumeChance: 100 });
    const r = applyRecul(t, board, 4); // recule normalement à n2 (pas de clamp sur n4)
    expect(r.patch.pos).toBe('n2');
  });
  it('n’est jamais consommé par un recul (reste posé pour un TP manuel)', () => {
    const t = mkTeam(0, { pos: 'n6', checkpoint: 'n4', checkpointConsumeChance: 100 });
    const r = applyRecul(t, LINEAR, 4);
    expect(r.patch.checkpoint).toBeUndefined(); // pas touché par le recul
  });
});

describe('point de contrôle : téléportation manuelle (clic du propriétaire)', () => {
  it('téléporte l’équipe active sur son checkpoint et le consomme (100 %)', () => {
    vi.useFakeTimers();
    freshGame([{ pos: 'n6', checkpoint: 'n3', checkpointConsumeChance: 100 }, {}]);
    set({ currentTeam: 0 });
    S().teleportToCheckpoint(); // le saut est différé (effet visuel de warp)
    vi.advanceTimersByTime(600);
    expect(team(0).pos).toBe('n3');
    expect(team(0).checkpoint).toBeUndefined();
    vi.useRealTimers();
  });
  it('checkpoint 0 % : réutilisable après téléportation', () => {
    vi.useFakeTimers();
    freshGame([{ pos: 'n6', checkpoint: 'n3', checkpointConsumeChance: 0 }, {}]);
    set({ currentTeam: 0 });
    S().teleportToCheckpoint();
    vi.advanceTimersByTime(600);
    expect(team(0).pos).toBe('n3');
    expect(team(0).checkpoint).toBe('n3');
    vi.useRealTimers();
  });
  it('refusé pendant une question ouverte', () => {
    freshGame([{ pos: 'n6', checkpoint: 'n3', checkpointConsumeChance: 100 }, {}]);
    set({ currentTeam: 0, showQuestion: { question: QUESTIONS.maths[0], subject: 'maths' } });
    S().teleportToCheckpoint();
    expect(team(0).pos).toBe('n6');
  });
});

describe('dé : sabotage & chanceux (handleDiceResult)', () => {
  it('minRoll : plancher garanti', () => {
    freshGame([{ pos: 'depart', buffs: [{ type: 'minRoll', n: 5, turns: 3 }] }, {}]);
    S().handleDiceResult(2); // face 2 → planché à 5
    expect(S().preRollValue).toBe(5);
  });
  it('diceMalus (buff) : réduit l’avancée', () => {
    freshGame([{ pos: 'depart', buffs: [{ type: 'diceMalus', n: 2, turns: 3 }] }, {}]);
    S().handleDiceResult(5); // face 5 − 2 = 3
    expect(S().preRollValue).toBe(3);
  });
});

describe('intérêts & dîme (or)', () => {
  it('intérêts : +% au début du tour', () => {
    freshGame([{ money: 100 }, { money: 100, buffs: [{ type: 'interest', n: 10, turns: 5 }] }]);
    set({ currentTeam: 0 });
    S().nextTurn(); // la main passe à l'équipe 1
    expect(S().currentTeam).toBe(1);
    expect(team(1).money).toBe(110); // +10 %
  });
  it('dîme : prélève un % du gain adverse', () => {
    freshGame([{ money: 50 }, { money: 50, buffs: [{ type: 'tithe', n: 20, turns: 5 }] }]);
    set({ currentTeam: 0, showQuestion: { question: QUESTIONS.maths[0], subject: 'maths', index: 0, timerHalved: false, timerDivisor: 1, itemBonusTime: 0 } });
    const before = team(1).money;
    S().answerQuestion(1, 30); // bonne réponse → gain
    expect(team(1).money).toBeGreaterThan(before); // la dîme a prélevé
  });
});
