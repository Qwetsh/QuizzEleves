// Tests du moteur d'effets composable (objets ultra-custom).
// On pilote le vrai store zustand + les fonctions exportées du moteur.
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { ITEMS, setItemsData } from '../data/items.js';
import {
  runEffects, resumeQueue, legacyToActions, consumableActions,
  equipOnRollActions, questionRerollOptions, d6Branch, expandUseTriggers,
  resolveAmount, diceLabel,
} from '../store/effectEngine.js';

// Plateau linéaire : depart -> n1..n8 -> arrivee (cases maths)
const LINEAR = (() => {
  const b = { depart: { x: 0, y: 0, type: 'depart', next: ['n1'] } };
  for (let i = 1; i <= 8; i++) {
    b[`n${i}`] = { x: i, y: 0, type: 'subject', subject: 'maths', next: [i === 8 ? 'arrivee' : `n${i + 1}`] };
  }
  b.arrivee = { x: 9, y: 0, type: 'arrivee', next: [] };
  return b;
})();

// Plateau avec une jonction en n2 (deux branches a/b qui rejoignent l'arrivée)
const JUNCTION = {
  depart: { x: 0, y: 0, type: 'depart', next: ['n1'] },
  n1: { x: 1, y: 0, type: 'subject', subject: 'maths', next: ['n2'] },
  n2: { x: 2, y: 0, type: 'jonction', next: ['a1', 'b1'] },
  a1: { x: 3, y: -1, type: 'subject', subject: 'maths', next: ['arrivee'] },
  b1: { x: 3, y: 1, type: 'subject', subject: 'maths', next: ['arrivee'] },
  arrivee: { x: 4, y: 0, type: 'arrivee', next: [] },
};

const QUESTIONS = {
  maths: [
    { q: 'Q1 ?', a: ['A', 'B', 'C', 'D'], c: 1 },
    { q: 'Q2 ?', a: ['A', 'B', 'C', 'D'], c: 2 },
  ],
  francais: [{ q: 'F1 ?', a: ['A', 'B', 'C', 'D'], c: 0 }],
};

function mkTeam(i, over = {}) {
  return {
    name: `T${i}`, color: '#111', emoji: '🦁',
    pos: 'n4', correct: 0, wrong: 0, money: 50,
    powerDef: null, powerOff: null, powers: {},
    sablierActif: false, doubleActive: false,
    equipment: { head: null, body: null, feet: null }, bag: [],
    ...over,
  };
}

function freshGame(overrides = [{}, {}], board = LINEAR) {
  useGameStore.setState({
    phase: 'game', devSandbox: true,
    teams: overrides.map((o, i) => mkTeam(i, o)),
    currentTeam: 0, board, finished: false,
    askedQuestions: {}, questions: QUESTIONS, log: [],
    rolling: false, diceValue: null, pendingMove: null, pendingLanding: false,
    awaitingChoice: false, showQuestion: null, showEvent: null, showFight: null,
    showTargetPicker: null, showShop: false, showInventory: false,
    showChargePicker: false, showDiceModal: false,
    indiceUsed: false, indiceHidden: [], freeActivation: false,
    movePath: null, preRollPos: null, preRollValue: null,
    pendingActions: null, showTilePicker: null, showActionDice: null,
    showSubjectPicker: false, rerollUsed: false, trapDepth: 0,
  });
}

const S = () => useGameStore.getState();
const team = (i = 0) => S().teams[i];

// Le moteur attend (set, get) — mêmes primitives que le store zustand.
const set = (patch) => useGameStore.setState(patch);
const get = () => S();
const exec = (actions, ctx = {}) => runEffects(set, get, actions, ctx);

beforeEach(() => freshGame());

// --- Schéma / helpers purs ---------------------------------------------

describe('schéma & adaptateurs', () => {
  it('legacyToActions mappe les types historiques', () => {
    expect(legacyToActions({ type: 'gainMoney', value: 8 })).toEqual([{ action: 'money', mode: 'gain', target: 'self', n: 8, unit: 'flat' }]);
    expect(legacyToActions({ type: 'moveForward', value: 3 })).toEqual([{ action: 'move', target: 'self', dir: 'forward', n: 3 }]);
    expect(legacyToActions({ type: 'fumigene', value: 1 })).toEqual([{ action: 'fumigene' }]);
  });

  it('consumableActions combine legacy + composable', () => {
    const item = { effects: [{ type: 'gainMoney', value: 5 }, { kind: 'trigger', on: 'use', do: [{ action: 'shieldNext', n: 1 }] }] };
    const acts = consumableActions(item);
    expect(acts).toHaveLength(2);
    expect(acts[0].action).toBe('money');
    expect(acts[1].action).toBe('shieldNext');
  });

  it('consumableActions applique la probabilité de déclenchement (chance)', () => {
    const item = { effects: [{ type: 'gainMoney', value: 5, chance: 0.2 }] };
    vi.spyOn(Math, 'random').mockReturnValue(0.1);  // < 0.2 → déclenche
    expect(consumableActions(item)).toHaveLength(1);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);  // ≥ 0.2 → raté
    expect(consumableActions(item)).toHaveLength(0);
    vi.restoreAllMocks();
  });

  it('d6Branch sélectionne par valeur et par plage', () => {
    const table = { '1': [{ action: 'fumigene' }], '2-3': [{ action: 'gainCharge' }], '6': [] };
    expect(d6Branch(table, 1)[0].action).toBe('fumigene');
    expect(d6Branch(table, 3)[0].action).toBe('gainCharge');
    expect(d6Branch(table, 5)).toEqual([]);
  });

  it('expandUseTriggers résout chance/else (déterministe aux bornes)', () => {
    expect(expandUseTriggers([{ chance: 1, do: [{ action: 'fumigene' }], else: [{ action: 'gainCharge' }] }])[0].action).toBe('fumigene');
    expect(expandUseTriggers([{ chance: 0, do: [{ action: 'fumigene' }], else: [{ action: 'gainCharge' }] }])[0].action).toBe('gainCharge');
  });
});

// --- Or ----------------------------------------------------------------

describe('actions : or', () => {
  it('gain self', () => {
    exec([{ action: 'money', mode: 'gain', target: 'self', n: 10, unit: 'flat' }], { source: 'item' });
    expect(team(0).money).toBe(60);
    expect(S().pendingActions).toBeNull();
  });

  it('gain all (legacy gainMoneyAll)', () => {
    exec(legacyToActions({ type: 'gainMoneyAll', value: 5 }), { source: 'item' });
    expect(team(0).money).toBe(55);
    expect(team(1).money).toBe(55);
  });

  it('steal target : conservation attaquant↔victime (50% protection)', () => {
    freshGame([{}, { equipment: { head: null, body: 'capeOmbre', feet: null } }]);
    exec([{ action: 'money', mode: 'steal', target: 'target', n: 30, unit: 'flat' }], { source: 'item' });
    // interactif : un picker de cible s'ouvre
    expect(S().showTargetPicker?.source).toBe('engine');
    S().selectTarget(1);
    // capeOmbre = stealProtection 50% -> 15 volés
    expect(team(1).money).toBe(35);
    expect(team(0).money).toBe(65);
    expect(S().pendingActions).toBeNull();
  });

  it('steal vs protection 100% : rien volé', () => {
    freshGame([{}, { equipment: { head: null, body: 'armureGarde', feet: null } }]);
    exec([{ action: 'money', mode: 'steal', target: 'target', n: 30, unit: 'flat' }], { source: 'item' });
    S().selectTarget(1);
    expect(team(1).money).toBe(50);
    expect(team(0).money).toBe(50);
  });

  it('lose self percent sur 0 pièce = 0', () => {
    freshGame([{ money: 0 }, {}]);
    exec([{ action: 'money', mode: 'lose', target: 'self', n: 50, unit: 'percent' }], { source: 'item' });
    expect(team(0).money).toBe(0);
  });

  it('steal randomOpponent (2 équipes) cible l’autre, non interactif', () => {
    exec([{ action: 'money', mode: 'steal', target: 'randomOpponent', n: 10, unit: 'flat' }], { source: 'item' });
    expect(S().showTargetPicker).toBeNull();
    expect(team(1).money).toBe(40);
    expect(team(0).money).toBe(60);
  });
});

// --- Déplacement -------------------------------------------------------

describe('actions : déplacement', () => {
  it('move self forward', () => {
    exec([{ action: 'move', target: 'self', dir: 'forward', n: 2 }], { source: 'item' });
    expect(team(0).pos).toBe('n6');
  });

  it('move back vs reculReduction (bottesMontagne -2)', () => {
    freshGame([{ equipment: { head: null, body: null, feet: 'bottesMontagne' } }, {}]);
    exec([{ action: 'move', target: 'self', dir: 'back', n: 3 }], { source: 'item' });
    // recul 3 - 2 = 1 case : n4 -> n3
    expect(team(0).pos).toBe('n3');
  });

  it('move self forward jusqu’à l’arrivée => victoire', () => {
    exec([{ action: 'move', target: 'self', dir: 'forward', n: 8 }], { source: 'item' });
    expect(team(0).pos).toBe('arrivee');
    expect(S().finished).toBe(true);
  });

  it('move self sur jonction : suspend puis reprise après chooseJunction', () => {
    freshGame([{ pos: 'n1' }, {}], JUNCTION);
    exec([{ action: 'move', target: 'self', dir: 'forward', n: 2 }], { source: 'item' });
    // s'arrête à la jonction n2
    expect(S().awaitingChoice).toBe(true);
    expect(S().pendingActions).toBeTruthy();
    S().chooseJunction('a1');
    expect(team(0).pos).toBe('a1');
    expect(S().pendingActions).toBeNull();
  });
});

// --- One-shots & recharge ---------------------------------------------

describe('actions : one-shots & recharge', () => {
  it('shieldNext / fumigene / extraTime posent les champs', () => {
    exec([{ action: 'shieldNext', n: 1 }, { action: 'fumigene' }, { action: 'extraTime', n: 7 }], { source: 'item' });
    expect(team(0).itemShield).toBe(1);
    expect(team(0).itemFumigene).toBe(true);
    expect(team(0).itemTimerBonus).toBe(7);
  });

  it('gainCharge ouvre le picker (engine) puis reprend', () => {
    freshGame([{ powers: { foudre: { charges: 0, level: 1 } } }, {}]);
    exec([{ action: 'gainCharge' }], { source: 'item' });
    expect(S().showChargePicker?.source).toBe('engine');
    expect(S().pendingActions).toBeTruthy();
    S().chargePickerChoice('foudre');
    expect(team(0).powers.foudre.charges).toBe(1);
    expect(S().pendingActions).toBeNull();
  });

  it('fumigène annule une action offensive (steal target)', () => {
    freshGame([{}, { itemFumigene: true }]);
    exec([{ action: 'money', mode: 'steal', target: 'target', n: 20, unit: 'flat' }], { source: 'item' });
    S().selectTarget(1);
    expect(team(1).money).toBe(50);          // rien volé
    expect(team(1).itemFumigene).toBe(false); // consommé
    expect(team(0).money).toBe(50);
  });
});

// --- Reroll de question ------------------------------------------------

describe('actions : reroll de question', () => {
  it('rerollQuestion same remplace la question (rerollUsed)', () => {
    useGameStore.setState({ showQuestion: { question: QUESTIONS.maths[0], subject: 'maths', index: 0, multiTotal: null }, askedQuestions: { maths: new Set([0]) } });
    exec([{ action: 'rerollQuestion', subject: 'same' }], { source: 'question' });
    expect(S().showQuestion.question.q).toBe('Q2 ?');
    expect(S().rerollUsed).toBe(true);
    expect(S().pendingActions).toBeNull();
  });

  it('rerollQuestion thème forcé change de matière', () => {
    useGameStore.setState({ showQuestion: { question: QUESTIONS.maths[0], subject: 'maths', index: 0 }, askedQuestions: {} });
    exec([{ action: 'rerollQuestion', subject: 'francais' }], { source: 'question' });
    expect(S().showQuestion.subject).toBe('francais');
    expect(S().showQuestion.question.q).toBe('F1 ?');
  });

  it('rerollQuestion choose ouvre le sélecteur de thème puis applique', () => {
    useGameStore.setState({ showQuestion: { question: QUESTIONS.maths[0], subject: 'maths', index: 0 }, askedQuestions: {} });
    exec([{ action: 'rerollQuestion', subject: 'choose' }], { source: 'question' });
    expect(S().showSubjectPicker).toBe(true);
    S().selectSubject('francais');
    expect(S().showSubjectPicker).toBe(false);
    expect(S().showQuestion.subject).toBe('francais');
  });

  it('questionRerollOptions liste équipement (plafonné) + sac', () => {
    // pas d'objets de reroll dans le catalogue par défaut -> 0
    expect(questionRerollOptions(mkTeam(0), false)).toHaveLength(0);
  });
});

// --- d6 (table) --------------------------------------------------------

describe('d6 table', () => {
  it('résout la branche via resumeQueue (simule le dé fini)', () => {
    exec([{ action: '__rollD6', table: { '1-3': [{ action: 'money', mode: 'lose', target: 'self', n: 5, unit: 'flat' }], '4-6': [{ action: 'money', mode: 'gain', target: 'self', n: 5, unit: 'flat' }] } }], { source: 'item' });
    // suspendu en attente du dé (animation)
    expect(S().pendingActions).toBeTruthy();
    expect(S().showActionDice).toBeTruthy();
    // on simule la résolution du dé sur 5 -> branche gain (4-6)
    resumeQueue(set, get, { rollResult: 5 });
    expect(team(0).money).toBe(55);
    expect(S().pendingActions).toBeNull();
  });
});

// --- Pièges ------------------------------------------------------------

describe('pièges', () => {
  it('placeTrap : picker de case puis pose dans board[node].trap', () => {
    exec([{ action: 'placeTrap', trap: { label: 'Piège', icon: '🪤', do: [{ action: 'move', target: 'self', dir: 'back', n: 2 }] } }], { source: 'item' });
    expect(S().showTilePicker).toBeTruthy();
    S().selectTile('n6');
    expect(S().board.n6.trap).toBeTruthy();
    expect(S().board.n6.trap.do[0].action).toBe('move');
    expect(S().pendingActions).toBeNull();
  });

  it('déclenchement à l’atterrissage : recul + nettoyage', () => {
    // pose un piège recul sur n3, puis une équipe atterrit dessus
    useGameStore.setState({ board: { ...S().board, n3: { ...S().board.n3, trap: { label: 'X', icon: '🪤', do: [{ action: 'move', target: 'self', dir: 'back', n: 2 }], ownerTeam: 1 } } } });
    useGameStore.setState({ teams: [{ ...team(0), pos: 'n3' }, team(1)], currentTeam: 0 });
    S().handleLanding();
    expect(team(0).pos).toBe('n1');          // reculé de 2
    expect(S().board.n3.trap).toBeUndefined(); // consommé
  });

  it('piège qui pousse vers l’arrivée => victoire', () => {
    useGameStore.setState({ board: { ...S().board, n3: { ...S().board.n3, trap: { label: 'Boost', icon: '🪤', do: [{ action: 'move', target: 'self', dir: 'forward', n: 8 }] } } } });
    useGameStore.setState({ teams: [{ ...team(0), pos: 'n3' }, team(1)], currentTeam: 0 });
    S().handleLanding();
    expect(team(0).pos).toBe('arrivee');
    expect(S().finished).toBe(true);
  });
});

// --- on:roll équipement ------------------------------------------------

describe('on:roll équipement', () => {
  it('handleDiceResult applique l’effet on:roll selon la valeur du dé', () => {
    const snapshot = { ...ITEMS };
    setItemsData({
      ...ITEMS,
      testRing: {
        name: 'Anneau test', icon: '💍', slot: 'head', rarity: 'commun', price: 0,
        effects: [{ kind: 'trigger', on: 'roll', values: [6], do: [{ action: 'money', mode: 'gain', target: 'self', n: 10, unit: 'flat' }] }],
      },
    });
    freshGame([{ pos: 'depart', equipment: { head: 'testRing', body: null, feet: null } }, {}]);
    S().handleDiceResult(6);
    expect(team(0).money).toBe(60); // gain on:roll sur 6
    // une valeur non listée ne déclenche rien
    freshGame([{ pos: 'depart', equipment: { head: 'testRing', body: null, feet: null } }, {}]);
    S().handleDiceResult(3);
    expect(team(0).money).toBe(50);
    setItemsData(snapshot);
  });

  it('rerollQuestion sur on:roll force le thème de la PROCHAINE question', () => {
    const snapshot = { ...ITEMS };
    setItemsData({
      ...ITEMS,
      testHelm: {
        name: 'Casque test', icon: '🪖', slot: 'head', rarity: 'commun', price: 0,
        effects: [{ kind: 'trigger', on: 'roll', values: [6], do: [{ action: 'rerollQuestion', subject: 'francais' }] }],
      },
    });
    freshGame([{ pos: 'depart', equipment: { head: 'testHelm', body: null, feet: null } }, {}]);
    S().handleDiceResult(6);
    expect(S().forcedSubject).toBe('francais'); // pas de question à cet instant : on mémorise
    S().askQuestion('maths');                    // la case demanderait maths…
    expect(S().showQuestion.subject).toBe('francais'); // …mais le thème est forcé
    expect(S().forcedSubject).toBeNull();        // consommé
    setItemsData(snapshot);
  });

  it('on:roll se déclenche MÊME si le lancer passe par une jonction', () => {
    const snapshot = { ...ITEMS };
    setItemsData({
      ...ITEMS,
      testHelm: {
        name: 'Casque', icon: '🪖', slot: 'head', rarity: 'commun', price: 0,
        effects: [{ kind: 'trigger', on: 'roll', values: [3], do: [{ action: 'rerollQuestion', subject: 'francais' }] }],
      },
    });
    // JUNCTION : depart->n1->n2(jonction). Un 3 s'arrête à la jonction (remaining 1).
    freshGame([{ pos: 'depart', equipment: { head: 'testHelm', body: null, feet: null } }, {}], JUNCTION);
    S().handleDiceResult(3);
    expect(S().awaitingChoice).toBe(true);       // on est bien à la jonction
    expect(S().forcedSubject).toBe('francais');  // ET le on:roll a tiré malgré la jonction
    setItemsData(snapshot);
  });
});

// --- Quantités aléatoires (dés) ----------------------------------------

describe('quantités aléatoires (1D4 / 1D6 / 1D10)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('resolveAmount : fixe vs dé (bornes)', () => {
    expect(resolveAmount(5)).toBe(5);
    expect(resolveAmount('d6')).toBeGreaterThanOrEqual(1);
    expect(resolveAmount('d6')).toBeLessThanOrEqual(6);
    vi.spyOn(Math, 'random').mockReturnValue(0); // → 1
    expect(resolveAmount('d10')).toBe(1);
    vi.spyOn(Math, 'random').mockReturnValue(0.999); // → max
    expect(resolveAmount('d4')).toBe(4);
    expect(resolveAmount('d10')).toBe(10);
  });

  it('diceLabel formate l’étiquette', () => {
    expect(diceLabel('d6')).toBe('1D6');
    expect(diceLabel(3)).toBe('3');
  });

  it('resolveAmount à l’échelle (série / précision)', () => {
    expect(resolveAmount({ per: 'streak', factor: 5 }, { streak: 3 })).toBe(15);
    expect(resolveAmount({ per: 'streak', factor: 5, base: 2 }, { streak: 3 })).toBe(17);
    expect(resolveAmount({ per: 'precision', factor: 0.5 }, { correct: 3, wrong: 1 })).toBe(38); // préc.75 → 37.5→38
    expect(resolveAmount({ per: 'imprecision', factor: 1 }, { correct: 1, wrong: 3 })).toBe(75);
    expect(resolveAmount({ per: 'streak', factor: 5 }, undefined)).toBe(0); // pas d'équipe → 0
  });

  it('move avec n:"d6" tire le déplacement à l’exécution', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // d6 → floor(3)+1 = 4
    exec([{ action: 'move', target: 'self', dir: 'forward', n: 'd6' }], { source: 'item' });
    expect(team(0).pos).toBe('n8'); // n4 + 4
  });

  it('money gain avec n:"d4" crédite la valeur tirée', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999); // d4 → 4
    exec([{ action: 'money', mode: 'gain', target: 'self', n: 'd4', unit: 'flat' }], { source: 'item' });
    expect(team(0).money).toBe(54);
  });

  it('extraTime avec n:"d10" applique le bonus tiré', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // d10 → 1
    exec([{ action: 'extraTime', n: 'd10' }], { source: 'item' });
    expect(team(0).itemTimerBonus).toBe(1);
  });
});

// --- Revue : actions sensibles au contexte -----------------------------

describe('robustesse selon le contexte', () => {
  it('gainCharge sans aucun pouvoir : pas de picker, on saute', () => {
    freshGame([{ powers: {} }, {}]);
    exec([{ action: 'gainCharge' }], { source: 'item' });
    expect(S().showChargePicker).toBeFalsy();
    expect(S().pendingActions).toBeNull();
  });

  it('extraTime (hors question) se reporte sur la PROCHAINE question', () => {
    exec([{ action: 'extraTime', n: 7 }], { source: 'item' });
    expect(team(0).itemTimerBonus).toBe(7);
    S().askQuestion('maths');
    expect(S().showQuestion.itemBonusTime).toBe(7);
    expect(team(0).itemTimerBonus).toBe(0); // consommé
  });

  it('rerollQuestion via consommable (sans question) force le thème suivant', () => {
    exec([{ action: 'rerollQuestion', subject: 'francais' }], { source: 'item' });
    expect(S().forcedSubject).toBe('francais');
    S().askQuestion('maths');
    expect(S().showQuestion.subject).toBe('francais');
  });

  it('shieldNext via on:roll arme le bouclier (protège la question à venir)', () => {
    exec([{ action: 'shieldNext', n: 1 }], { source: 'roll', diceValue: 5 });
    expect(team(0).itemShield).toBe(1);
  });

  it('fumigène via on:roll arme l’anti-pouvoir', () => {
    exec([{ action: 'fumigene' }], { source: 'roll', diceValue: 4 });
    expect(team(0).itemFumigene).toBe(true);
  });
});
