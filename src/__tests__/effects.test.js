// Tests du moteur d'effets composable (objets ultra-custom).
// On pilote le vrai store zustand + les fonctions exportées du moteur.
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { ITEMS, setItemsData } from '../data/items.js';
import { getEffectValue, activeSets, hasBuff, isDuelImmune } from '../logic/itemEffects.js';
import { normalizeBag, cellKey } from '../store/itemHandlers.js';
import {
  runEffects, resumeQueue, legacyToActions, consumableActions,
  equipOnRollActions, equipTriggerActions, questionRerollOptions, d6Branch, expandUseTriggers,
  resolveAmount, diceLabel,
} from '../store/effectEngine.js';
import { questionDuration, QUESTION_TIME_FLOOR } from '../logic/turnHelpers.js';

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
    // Loot de bonne réponse neutralisé (tirages Math.random → LootReveal qui
    // diffère nextTurn = tests flaky). Catalogue vide : aucun drop possible.
    enabledItems: [],
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

  // --- Feedback bourse vide / vol partiel ---
  const lastLogText = () => {
    const last = S().log.at(-1);
    return typeof last === 'string' ? last : last.text;
  };

  it('steal sur bourse vide : rien transféré + message « bourse vide »', () => {
    freshGame([{}, { money: 0 }]);
    exec([{ action: 'money', mode: 'steal', target: 'target', n: 10, unit: 'flat' }], { source: 'item' });
    S().selectTarget(1);
    expect(team(0).money).toBe(50);
    expect(team(1).money).toBe(0);
    expect(lastLogText()).toMatch(/bourse vide/i);
  });

  it('steal partiel (bourse < montant visé) : plafonné et signalé', () => {
    freshGame([{}, { money: 4 }]);
    exec([{ action: 'money', mode: 'steal', target: 'target', n: 10, unit: 'flat' }], { source: 'item' });
    S().selectTarget(1);
    expect(team(1).money).toBe(0);
    expect(team(0).money).toBe(54);
    expect(lastLogText()).toMatch(/vide la bourse/i);
    expect(lastLogText()).toMatch(/sur 10/);
  });

  it('lose plafonné à la bourse : le journal donne la perte réelle', () => {
    freshGame([{ money: 3 }, {}]);
    exec([{ action: 'money', mode: 'lose', target: 'self', n: 10, unit: 'flat' }], { source: 'item' });
    expect(team(0).money).toBe(0);
    expect(lastLogText()).toMatch(/perd 3 pièces — toute sa bourse/);
  });

  it('lose sur bourse vide : message explicite (pas « perd 10 »)', () => {
    freshGame([{ money: 0 }, {}]);
    exec([{ action: 'money', mode: 'lose', target: 'self', n: 10, unit: 'flat' }], { source: 'item' });
    expect(team(0).money).toBe(0);
    expect(lastLogText()).toMatch(/bourse déjà vide/i);
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

  it('recul d’événement absorbé par le pouvoir Bouclier (bouclier universel)', () => {
    // Le recul des effets (événements/consommables) passe désormais par la chaîne
    // de bouclier : ici niv.2 (−4) absorbe un recul de 3, charge consommée.
    freshGame([{ powers: { bouclier: { charges: 1, level: 2 } } }, {}]);
    exec([{ action: 'move', target: 'self', dir: 'back', n: 3 }], { source: 'event' });
    expect(team(0).pos).toBe('n4'); // pas de recul
    expect(team(0).powers.bouclier.charges).toBe(0);
  });

  it('recul d’événement réduit de 1 case par le Bouclier de bois', () => {
    freshGame([{ itemShield: 2 }, {}]);
    exec([{ action: 'move', target: 'self', dir: 'back', n: 3 }], { source: 'event' });
    expect(team(0).pos).toBe('n3'); // 3 − 2 (deux charges) = 1 case : n4 → n3
    expect(team(0).itemShield).toBe(0);
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

  it('fumigène à durée (turns) expire après X tours', () => {
    exec([{ action: 'fumigene', turns: 2 }], { source: 'item' });
    expect(team(0).itemFumigene).toBe(true);
    expect(team(0).itemFumigeneTurns).toBe(2);
    S().nextTurn(); // 0 → 1
    S().nextTurn(); // 1 → 0 : l'équipe 0 regagne la main → 2 → 1
    expect(team(0).itemFumigeneTurns).toBe(1);
    expect(team(0).itemFumigene).toBe(true);
    S().nextTurn(); S().nextTurn(); // retour à 0 : 1 → 0 → dissipé
    expect(team(0).itemFumigene).toBe(false);
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

  it('rerollQuestion probabiliste : chance → thème principal, sinon → repli', () => {
    // Tirage gagnant (random < chance) → thème principal (francais)
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    useGameStore.setState({ showQuestion: { question: QUESTIONS.maths[0], subject: 'maths', index: 0 }, askedQuestions: {} });
    exec([{ action: 'rerollQuestion', subject: 'francais', chance: 0.5, elseSubject: 'maths' }], { source: 'question' });
    expect(S().showQuestion.subject).toBe('francais');
    Math.random.mockRestore();

    // Tirage perdant (random ≥ chance) → thème de repli (maths)
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    useGameStore.setState({ showQuestion: { question: QUESTIONS.francais[0], subject: 'francais', index: 0 }, askedQuestions: {} });
    exec([{ action: 'rerollQuestion', subject: 'francais', chance: 0.5, elseSubject: 'maths' }], { source: 'question' });
    expect(S().showQuestion.subject).toBe('maths');
    Math.random.mockRestore();
  });

  it('questionRerollOptions liste équipement (plafonné) + sac', () => {
    // pas d'objets de reroll dans le catalogue par défaut -> 0
    expect(questionRerollOptions(mkTeam(0), false)).toHaveLength(0);
  });

  it('questionRerollOptions filtre par matières (subjects)', () => {
    setItemsData({
      loupeSvt: { name: 'Loupe SVT', slot: 'head', rarity: 'rare', price: 10, icon: '🔬',
        effects: [{ kind: 'trigger', on: 'question', subjects: ['svt'], do: [{ action: 'rerollQuestion', subject: 'same' }] }] },
    });
    const t = mkTeam(0, { equipment: { head: 'loupeSvt', body: null, feet: null } });
    expect(questionRerollOptions(t, false, 'svt')).toHaveLength(1);    // matière ciblée → proposé
    expect(questionRerollOptions(t, false, 'maths')).toHaveLength(0);  // autre matière → masqué
    expect(questionRerollOptions(t, false)).toHaveLength(0);           // sans thème → masqué
  });
});

describe('action : téléportation case la plus avancée (teleportFurthest)', () => {
  it('renvoie sur maxPos quand il est devant', () => {
    freshGame([{ pos: 'n2', maxPos: 'n6' }, {}]);
    exec([{ action: 'teleportFurthest', target: 'self' }], { source: 'item' });
    expect(team(0).pos).toBe('n6');
  });
  it('sans effet si déjà au plus loin atteint', () => {
    freshGame([{ pos: 'n6', maxPos: 'n6' }, {}]);
    exec([{ action: 'teleportFurthest', target: 'self' }], { source: 'item' });
    expect(team(0).pos).toBe('n6');
  });
  it('avancer met à jour le high-water-mark maxPos', () => {
    freshGame([{ pos: 'n2' }, {}]);
    exec([{ action: 'move', target: 'self', dir: 'forward', n: 3 }], { source: 'item' });
    expect(team(0).pos).toBe('n5');
    expect(team(0).maxPos).toBe('n5');
  });
});

describe('immunité aux duels (isDuelImmune)', () => {
  it('vrai via passif d’équipement (duelImmune)', () => {
    setItemsData({
      amuletteDuel: { name: 'Amulette anti-duel', slot: 'feet', rarity: 'légendaire', price: 30,
        effects: [{ type: 'duelImmune', value: 1 }] },
    });
    const t = mkTeam(0, { equipment: { head: null, body: null, feet: 'amuletteDuel' } });
    expect(isDuelImmune(t)).toBe(true);
  });
  it('vrai via buff temporisé, faux sans rien', () => {
    expect(isDuelImmune(mkTeam(0, { buffs: [{ type: 'duelImmune', turns: 2 }] }))).toBe(true);
    expect(isDuelImmune(mkTeam(0))).toBe(false);
  });
});

describe('action : voie aléatoire (randomPathNext)', () => {
  it('pose le flag one-shot sur soi', () => {
    exec([{ action: 'randomPathNext', target: 'self' }], { source: 'item' });
    expect(team(0).randomPathNext).toBe(true);
    expect(S().pendingActions).toBeNull();
  });

  it('cible un adversaire', () => {
    exec([{ action: 'randomPathNext', target: 'randomOpponent' }], { source: 'item' });
    expect(team(1).randomPathNext).toBe(true);
    expect(team(0).randomPathNext).toBeFalsy();
  });

  it('le carrefour auto-choisit la voie et consomme le flag', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    freshGame([{}, {}], JUNCTION);
    useGameStore.setState({ teams: S().teams.map((t, i) => (i === 0 ? { ...t, pos: 'n2', randomPathNext: true } : t)) });
    S().resolvePostRoll(4, { stoppedAtJunction: true, junctionPos: 'n2', remaining: 1 });
    expect(S().awaitingChoice).toBe(false);     // pas de demande de voie au joueur
    expect(team(0).randomPathNext).toBe(false); // flag consommé
    vi.restoreAllMocks();
  });
});

// --- forceSubject (question forcée à l'adversaire) ---------------------

describe('forceSubject', () => {
  it('pose un thème forcé sur la cible, consommé à son prochain askQuestion', () => {
    exec([{ action: 'forceSubject', target: 'target', subject: 'hardcore' }], { source: 'item', targetTeam: 1 });
    expect(team(1).forcedSubject).toBe('hardcore');
    // l'équipe 1 joue : sa question est forcée en hardcore puis le forçage se consomme
    useGameStore.setState({ currentTeam: 1, questions: { ...QUESTIONS, hardcore: [{ q: 'HC ?', a: ['A', 'B', 'C', 'D'], c: 0 }] } });
    S().askQuestion('maths');
    expect(S().showQuestion.subject).toBe('hardcore');
    expect(team(1).forcedSubject).toBeNull();
  });

  it('cible self : force sa propre prochaine question', () => {
    exec([{ action: 'forceSubject', target: 'self', subject: 'cultureG' }], { source: 'item' });
    expect(team(0).forcedSubject).toBe('cultureG');
    useGameStore.setState({ questions: { ...QUESTIONS, cultureG: [{ q: 'CG ?', a: ['A', 'B', 'C', 'D'], c: 0 }] } });
    S().askQuestion('maths');
    expect(S().showQuestion.subject).toBe('cultureG');
  });
});

// --- déclencheurs de réponse conditionnés par le thème de la question ---

describe('equipTriggerActions : condition de thème', () => {
  const gain = (n) => ({ action: 'money', mode: 'gain', target: 'self', n, unit: 'flat' });
  it('ne joue le déclencheur que si la matière correspond', () => {
    setItemsData({
      coiffeNature: { name: 'Coiffe nature', slot: 'head', rarity: 'rare', price: 10,
        effects: [{ kind: 'trigger', on: 'correct', subject: 'svt', do: [gain(5)] }] },
    });
    const team = { equipment: { head: 'coiffeNature', body: null, feet: null } };
    expect(equipTriggerActions(team, 'correct', 'svt')).toHaveLength(1);   // SVT → joue
    expect(equipTriggerActions(team, 'correct', 'maths')).toHaveLength(0); // autre → rien
  });
  it('sans subject : joue pour toute matière', () => {
    setItemsData({
      anneauTout: { name: 'Anneau', slot: 'feet', rarity: 'commun', price: 5,
        effects: [{ kind: 'trigger', on: 'correct', do: [gain(2)] }] },
    });
    const team = { equipment: { head: null, body: null, feet: 'anneauTout' } };
    expect(equipTriggerActions(team, 'correct', 'histoire')).toHaveLength(1);
  });

  it('on:questionSubject filtre par liste de matières (subjects)', () => {
    setItemsData({
      toqueMaths: { name: 'Toque', slot: 'head', rarity: 'rare', price: 10,
        effects: [{ kind: 'trigger', on: 'questionSubject', subjects: ['maths', 'svt'], do: [gain(5)] }] },
      anneauTout: { name: 'Anneau', slot: 'feet', rarity: 'commun', price: 5,
        effects: [{ kind: 'trigger', on: 'questionSubject', subjects: [], do: [gain(2)] }] },
    });
    const t1 = { equipment: { head: 'toqueMaths', body: null, feet: null } };
    expect(equipTriggerActions(t1, 'questionSubject', 'maths')).toHaveLength(1);   // ciblé
    expect(equipTriggerActions(t1, 'questionSubject', 'francais')).toHaveLength(0); // hors liste
    const t2 = { equipment: { head: null, body: null, feet: 'anneauTout' } };
    expect(equipTriggerActions(t2, 'questionSubject', 'histoire')).toHaveLength(1); // liste vide = tout
  });
});

describe('déclencheur on:questionSubject (à l’apparition de la question)', () => {
  it('askQuestion joue l’effet sur le thème ciblé, et rien sinon', () => {
    setItemsData({
      toque: { name: 'Toque', slot: 'head', rarity: 'rare', price: 10,
        effects: [{ kind: 'trigger', on: 'questionSubject', subjects: ['maths'], do: [{ action: 'money', mode: 'gain', target: 'self', n: 7, unit: 'flat' }] }] },
    });
    // Thème ciblé → +7 or
    freshGame([{ equipment: { head: 'toque', body: null, feet: null }, money: 50 }, {}]);
    S().askQuestion('maths');
    expect(team(0).money).toBe(57);
    expect(S().showQuestion?.subject).toBe('maths');
    // Thème non ciblé → inchangé
    freshGame([{ equipment: { head: 'toque', body: null, feet: null }, money: 50 }, {}]);
    S().askQuestion('francais');
    expect(team(0).money).toBe(50);
  });

  it('hideWrong élimine une mauvaise réponse de la question courante', () => {
    setItemsData({
      loupe: { name: 'Loupe', slot: 'head', rarity: 'rare', price: 10,
        effects: [{ kind: 'trigger', on: 'questionSubject', subjects: ['maths'], do: [{ action: 'hideWrong', n: 1 }] }] },
    });
    freshGame([{ equipment: { head: 'loupe', body: null, feet: null } }, {}]);
    S().askQuestion('maths');
    expect(S().indiceHidden).toHaveLength(1);
    expect(S().indiceHidden).not.toContain(S().showQuestion.question.c); // jamais la bonne
  });

  it('extraTime sur question ouverte prolonge la question courante', () => {
    setItemsData({
      sablier: { name: 'Sablier', slot: 'body', rarity: 'rare', price: 10,
        effects: [{ kind: 'trigger', on: 'questionSubject', subjects: ['maths'], do: [{ action: 'extraTime', n: 8 }] }] },
    });
    freshGame([{ equipment: { head: null, body: 'sablier', feet: null } }, {}]);
    S().askQuestion('maths');
    expect(S().showQuestion?.itemBonusTime).toBe(8); // prolonge LA question, pas la suivante
    expect(team(0).itemTimerBonus ?? 0).toBe(0);
  });
});

// --- Sets d'équipement (bonus à 2/3 pièces) ---

describe('sets d’équipement', () => {
  beforeEach(() => {
    setItemsData({
      n1: { name: 'N1', slot: 'head', rarity: 'rare', price: 1, set: 'nature', effects: [] },
      n2: { name: 'N2', slot: 'body', rarity: 'rare', price: 1, set: 'nature', effects: [] },
      n3: { name: 'N3', slot: 'feet', rarity: 'rare', price: 1, set: 'nature', effects: [] },
    });
  });
  it('2 pièces → bonus2 injecté dans getEffectValue', () => {
    const team = { equipment: { head: 'n1', body: 'n2', feet: null } };
    expect(getEffectValue(team, 'timerBonus')).toBe(3); // SETS.nature.bonus2 = timerBonus 3
    expect(activeSets(team)[0]).toMatchObject({ key: 'nature', count: 2, tier: 2 });
  });
  it('3 pièces → bonus3 (déclencheur on:correct SVT) injecté', () => {
    const team = { equipment: { head: 'n1', body: 'n2', feet: 'n3' } };
    expect(equipTriggerActions(team, 'correct', 'svt')).toHaveLength(1); // gain(5) en SVT
    expect(equipTriggerActions(team, 'correct', 'maths')).toHaveLength(0); // pas en maths
    expect(activeSets(team)[0].tier).toBe(3);
  });
  it('1 pièce → aucun bonus', () => {
    const team = { equipment: { head: 'n1', body: null, feet: null } };
    expect(getEffectValue(team, 'timerBonus')).toBe(0);
    expect(activeSets(team)).toHaveLength(0);
  });
});

// --- Buffs temporisés ---

describe('buffs temporisés', () => {
  it('l’action buff pose un effet de durée sur la cible', () => {
    exec([{ action: 'buff', target: 'self', buff: { type: 'noRecul', turns: 2 } }], { source: 'item' });
    expect(team(0).buffs).toHaveLength(1);
    expect(team(0).buffs[0]).toMatchObject({ type: 'noRecul', turns: 2 });
    expect(hasBuff(team(0), 'noRecul')).toBe(true);
  });
  it('le buff se décrémente quand l’équipe regagne la main et expire à 0', () => {
    // 2 équipes : pose un buff turns:1 sur l'équipe 0, joue le tour de 1 → retour à 0
    const nt = [...S().teams];
    nt[0] = { ...nt[0], buffs: [{ type: 'noRecul', turns: 1 }] };
    useGameStore.setState({ teams: nt, currentTeam: 0 });
    S().nextTurn(); // → équipe 1
    expect(team(0).buffs).toHaveLength(1); // pas encore décrémenté (équipe 0 n'a pas rejoué)
    S().nextTurn(); // → équipe 0 regagne la main : décrément 1→0, expire
    expect(team(0).buffs).toHaveLength(0);
  });
});

// --- challenge (pari « Défi » : thème forcé sur soi + récompense/malus) ---

describe('challenge', () => {
  const HC = { q: 'HC ?', a: ['A', 'B', 'C', 'D'], c: 0 };
  it('force le thème, pose le pari, et verse la récompense sur bonne réponse', () => {
    exec([{ action: 'challenge', subject: 'hardcore',
      do: [{ action: 'money', mode: 'gain', target: 'self', n: 40, unit: 'flat' }],
      else: [{ action: 'money', mode: 'lose', target: 'self', n: 10, unit: 'flat' }] }], { source: 'item' });
    expect(team(0).forcedSubject).toBe('hardcore');
    expect(team(0).wager).toBeTruthy();
    useGameStore.setState({ questions: { ...QUESTIONS, hardcore: [HC] } });
    S().askQuestion('maths');
    expect(S().showQuestion.subject).toBe('hardcore');
    S().answerQuestion(S().showQuestion.question.c); // bonne réponse (index affiché)
    expect(team(0).money).toBe(90); // 50 + 40 de récompense (gain de base nul à 0s)
    expect(team(0).wager).toBeUndefined();
  });

  it('applique le malus sur mauvaise réponse et consomme le pari', () => {
    exec([{ action: 'challenge', subject: 'hardcore',
      do: [{ action: 'money', mode: 'gain', target: 'self', n: 40, unit: 'flat' }],
      else: [{ action: 'money', mode: 'lose', target: 'self', n: 10, unit: 'flat' }] }], { source: 'item' });
    useGameStore.setState({ questions: { ...QUESTIONS, hardcore: [HC] } });
    S().askQuestion('maths');
    const wrong = (S().showQuestion.question.c + 1) % 4; // un index faux
    S().answerQuestion(wrong);
    expect(team(0).money).toBe(40); // 50 − 10 de malus (le recul ne touche pas l'or)
    expect(team(0).wager).toBeUndefined();
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

// --- Buff bonus de dé --------------------------------------------------

describe('buff diceBonus', () => {
  it('le déplacement = valeur du dé + N pendant la durée', () => {
    freshGame([{ pos: 'depart', buffs: [{ type: 'diceBonus', turns: 4, n: 2 }] }, {}]);
    S().handleDiceResult(3);
    expect(team(0).pos).toBe('n5');        // depart + (3+2)
    expect(S().preRollValue).toBe(5);      // recul potentiel = avance effective
  });

  it('sans buff : déplacement = valeur du dé', () => {
    freshGame([{ pos: 'depart' }, {}]);
    S().handleDiceResult(3);
    expect(team(0).pos).toBe('n3');
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

  it('immunité aux pièges (buff) : atterrissage sans déclenchement, piège conservé', () => {
    useGameStore.setState({ board: { ...S().board, n3: { ...S().board.n3, trap: { label: 'X', icon: '🪤', do: [{ action: 'move', target: 'self', dir: 'back', n: 2 }], ownerTeam: 1 } } } });
    useGameStore.setState({ teams: [{ ...team(0), pos: 'n3', buffs: [{ type: 'trapImmune', turns: 2 }] }, team(1)], currentTeam: 0 });
    S().handleLanding();
    expect(team(0).pos).toBe('n3');            // pas de recul
    expect(S().board.n3.trap).toBeTruthy();    // piège toujours armé pour les autres
  });

  it('piège qui pousse vers l’arrivée => victoire', () => {
    useGameStore.setState({ board: { ...S().board, n3: { ...S().board.n3, trap: { label: 'Boost', icon: '🪤', do: [{ action: 'move', target: 'self', dir: 'forward', n: 8 }] } } } });
    useGameStore.setState({ teams: [{ ...team(0), pos: 'n3' }, team(1)], currentTeam: 0 });
    S().handleLanding();
    expect(team(0).pos).toBe('arrivee');
    expect(S().finished).toBe(true);
  });

  it('piège vol de pièces : l’or volé revient au POSEUR', () => {
    // Cible « celui qui marche dessus » (self) ; le poseur (équipe 1) encaisse.
    useGameStore.setState({ board: { ...S().board, n3: { ...S().board.n3, trap: { label: 'Bourse', icon: '🪤', do: [{ action: 'money', mode: 'steal', target: 'self', n: 10, unit: 'flat' }], ownerTeam: 1 } } } });
    useGameStore.setState({ teams: [{ ...team(0), pos: 'n3', money: 50 }, { ...team(1), money: 20 }], currentTeam: 0 });
    S().handleLanding();
    expect(team(0).money).toBe(40); // victime perd 10
    expect(team(1).money).toBe(30); // poseur gagne 10
    expect(S().board.n3.trap).toBeUndefined();
  });

  it('piège vol : le poseur sur SON piège ne se vole pas lui-même', () => {
    useGameStore.setState({ board: { ...S().board, n3: { ...S().board.n3, trap: { label: 'Bourse', icon: '🪤', do: [{ action: 'money', mode: 'steal', target: 'self', n: 10, unit: 'flat' }], ownerTeam: 0 } } } });
    useGameStore.setState({ teams: [{ ...team(0), pos: 'n3', money: 50 }, team(1)], currentTeam: 0 });
    S().handleLanding();
    expect(team(0).money).toBe(50); // inchangé
  });

  // --- Passage 50% / Arrêt 100% (déplacement au dé) ---
  it('passage sur un piège : 50% qui DÉCLENCHE → stoppe le pion sur la case', () => {
    useGameStore.setState({ board: { ...S().board, n3: { ...S().board.n3, trap: { label: 'X', icon: '🪤', do: [{ action: 'move', target: 'self', dir: 'back', n: 2 }], ownerTeam: 1 } } } });
    useGameStore.setState({ teams: [{ ...team(0), pos: 'n1' }, team(1)], currentTeam: 0 });
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // < 0.5 → le piège part au passage
    S().handleDiceResult(4); // n1 → n5, mais TRAVERSE n3 (piégé)
    expect(team(0).pos).toBe('n3');             // pion stoppé sur le piège
    S().handleLanding();
    expect(team(0).pos).toBe('n1');             // reculé de 2
    expect(S().board.n3.trap).toBeUndefined();  // consommé
    vi.restoreAllMocks();
  });

  it('passage sur un piège : 50% qui RATE → le pion continue, piège reste armé', () => {
    useGameStore.setState({ board: { ...S().board, n3: { ...S().board.n3, trap: { label: 'X', icon: '🪤', do: [{ action: 'move', target: 'self', dir: 'back', n: 2 }], ownerTeam: 1 } } } });
    useGameStore.setState({ teams: [{ ...team(0), pos: 'n1' }, team(1)], currentTeam: 0 });
    vi.spyOn(Math, 'random').mockReturnValue(0.9); // ≥ 0.5 → frôlé
    S().handleDiceResult(4);
    expect(team(0).pos).toBe('n5');             // arrive normalement (n3 traversé sans déclenchement)
    S().handleLanding();                        // n5 sans piège → rien
    expect(team(0).pos).toBe('n5');
    expect(S().board.n3.trap).toBeTruthy();     // reste armé pour la prochaine fois
    vi.restoreAllMocks();
  });

  it('arrêt EXACT sur un piège (au dé) : 100% même si le tirage « passage » aurait raté', () => {
    useGameStore.setState({ board: { ...S().board, n3: { ...S().board.n3, trap: { label: 'X', icon: '🪤', do: [{ action: 'move', target: 'self', dir: 'back', n: 2 }], ownerTeam: 1 } } } });
    useGameStore.setState({ teams: [{ ...team(0), pos: 'n1' }, team(1)], currentTeam: 0 });
    vi.spyOn(Math, 'random').mockReturnValue(0.9); // ≥ 0.5 : ne doit RIEN changer (arrêt = 100%)
    S().handleDiceResult(2); // n1 → n3 PILE (n3 = case d'arrêt, pas un passage)
    expect(team(0).pos).toBe('n3');
    S().handleLanding();
    expect(team(0).pos).toBe('n1');             // déclenché à 100% → reculé de 2
    expect(S().board.n3.trap).toBeUndefined();  // consommé
    vi.restoreAllMocks();
  });
});

describe('hacking (événement mode téléphone)', () => {
  it('hackApp pose hackedTurns sur la cible (self) + attribution « boss » via événement', () => {
    exec([{ action: 'hackApp', target: 'self', turns: 1 }], { source: 'event' });
    expect(team(0).hackedTurns).toBe(1);
    expect(team(0).hackedBy).toEqual({ boss: true }); // hack d'événement = le boss
  });

  it('hackApp lancé par une équipe sur allOthers : attribution = équipe lanceuse', () => {
    useGameStore.setState({ teams: [team(0), team(1), mkTeam(2)], currentTeam: 0 });
    exec([{ action: 'hackApp', target: 'allOthers', turns: 1 }], { source: 'item' });
    expect(team(0).hackedTurns).toBeUndefined();      // la source n'est pas touchée
    expect(team(1).hackedTurns).toBe(1);
    expect(team(1).hackedBy).toEqual({ name: 'T0', emoji: '🦁', color: '#111' });
    expect(team(2).hackedBy.name).toBe('T0');
  });

  it('le tour piraté arme la résolution puis est PERDU (auto-sauté)', () => {
    // Équipe 0 piratée (cinématique visible en continu). C'est au tour de
    // l'équipe 1 ; quand 0 regagne la main, la RÉSOLUTION s'arme (hackOverlay)
    // mais le compteur n'est consommé qu'à la fin du « beat » (endHackedTurn).
    useGameStore.setState({ teams: [{ ...team(0), hackedTurns: 1 }, team(1)], currentTeam: 1 });
    S().nextTurn();
    expect(S().currentTeam).toBe(0);              // 0 regagne la main…
    expect(S().hackOverlay).toBeTruthy();         // …résolution armée (verrou dé)
    expect(team(0).hackedTurns).toBe(1);          // compteur PAS encore consommé
    // Fin du « beat » → tour perdu, compteur consommé, équipe suivante.
    S().endHackedTurn();
    expect(S().hackOverlay).toBeNull();
    expect(team(0).hackedTurns).toBeUndefined();
    expect(S().currentTeam).toBe(1);
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

  it('on:roll qui déplace HORS de la jonction n’ouvre pas le choix de voie', () => {
    const snapshot = { ...ITEMS };
    setItemsData({
      ...ITEMS,
      ringBack: {
        name: 'Anneau recul', icon: '💍', slot: 'head', rarity: 'commun', price: 0,
        effects: [{ kind: 'trigger', on: 'roll', values: [3], do: [{ action: 'move', target: 'self', dir: 'back', n: 1 }] }],
      },
    });
    // 3 depuis depart → s'arrête à la jonction n2, puis l'effet recule en n1.
    freshGame([{ pos: 'depart', equipment: { head: 'ringBack', body: null, feet: null } }, {}], JUNCTION);
    S().handleDiceResult(3);
    expect(team(0).pos).toBe('n1');           // reculé hors de la jonction
    expect(S().awaitingChoice).toBe(false);   // donc PAS de choix de voie (bug corrigé)
    expect(S().pendingLanding).toBe(true);
    setItemsData(snapshot);
  });

  it('skipOnRoll (Relance) ne re-déclenche pas le bonus on:roll', () => {
    const snapshot = { ...ITEMS };
    setItemsData({
      ...ITEMS,
      ringGold: {
        name: 'Anneau doré', icon: '💍', slot: 'head', rarity: 'commun', price: 0,
        effects: [{ kind: 'trigger', on: 'roll', values: [6], do: [{ action: 'money', mode: 'gain', target: 'self', n: 10, unit: 'flat' }] }],
      },
    });
    freshGame([{ pos: 'depart', money: 50, equipment: { head: 'ringGold', body: null, feet: null } }, {}]);
    S().handleDiceResult(6, { skipOnRoll: true });
    expect(team(0).money).toBe(50);           // bonus ignoré (relance)
    freshGame([{ pos: 'depart', money: 50, equipment: { head: 'ringGold', body: null, feet: null } }, {}]);
    S().handleDiceResult(6);
    expect(team(0).money).toBe(60);           // lancer normal : +10
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
    expect(resolveAmount({ per: 'timeleft', factor: 0.1 }, { answerTimeRatio: 80 })).toBe(8); // 0.1 × 80%
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

// --- Vol de temps -------------------------------------------------------

describe('vol de temps (stealTime)', () => {
  it('vole N s à une cible : la cible perd, la source gagne', () => {
    exec([{ action: 'stealTime', target: 'target', n: 5 }], { source: 'item', targetTeam: 1 });
    expect(team(1).itemTimerBonus).toBe(-5);
    expect(team(0).itemTimerBonus).toBe(5);
  });

  it("cible 'allOthers' : chaque adversaire perd N, la source cumule N × adversaires", () => {
    freshGame([{}, {}, {}]); // 3 équipes, source = 0
    exec([{ action: 'stealTime', target: 'allOthers', n: 4 }], { source: 'item' });
    expect(team(1).itemTimerBonus).toBe(-4);
    expect(team(2).itemTimerBonus).toBe(-4);
    expect(team(0).itemTimerBonus).toBe(8); // 4 + 4 cumulés pour la source
  });

  it('la source ne se vole jamais elle-même (cible all)', () => {
    freshGame([{}, {}]);
    exec([{ action: 'stealTime', target: 'all', n: 6 }], { source: 'item' });
    // Équipe 0 = source : ne perd rien, gagne le vol sur l'équipe 1.
    expect(team(1).itemTimerBonus).toBe(-6);
    expect(team(0).itemTimerBonus).toBe(6);
  });

  it('le temps volé réduit le timer de la prochaine question de la cible', () => {
    exec([{ action: 'stealTime', target: 'target', n: 5 }], { source: 'item', targetTeam: 1 });
    useGameStore.setState({ currentTeam: 1 });
    S().askQuestion('maths');
    expect(S().showQuestion.itemBonusTime).toBe(-5);
    expect(team(1).itemTimerBonus).toBe(0); // one-shot consommé
    expect(questionDuration(S().showQuestion)).toBe(25); // 30 − 5
  });

  it('un vol massif est borné par le plancher de durée', () => {
    // itemBonusTime très négatif → questionDuration ne descend pas sous le plancher.
    expect(questionDuration({ itemBonusTime: -40 })).toBe(QUESTION_TIME_FLOOR);
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

describe('annulation du sélecteur de cible (consommable)', () => {
  const bagKeys = (i) => normalizeBag(team(i).bag).map(cellKey);

  beforeEach(() => {
    // Catalogue isolé : un consommable « blockPowers target:target » → exige un
    // choix de cible (ouvre le sélecteur). Évite la pollution d'ITEMS par les
    // setItemsData d'autres tests de ce fichier.
    setItemsData({
      testSceau: {
        name: 'Sceau test', icon: '🤐', slot: 'consumable', price: 10,
        effects: [{ kind: 'trigger', on: 'use', do: [{ action: 'blockPowers', target: 'target', turns: 2 }] }],
      },
    });
    freshGame([{ bag: ['testSceau'] }, {}]);
  });

  it('annuler REND le consommable et ne laisse pas la file suspendue', () => {
    expect(bagKeys(0)).toContain('testSceau');

    S().useConsumable(0);
    // L'objet est retiré et le sélecteur de cible (moteur) s'ouvre.
    expect(S().showTargetPicker?.source).toBe('engine');
    expect(bagKeys(0)).not.toContain('testSceau');

    S().cancelTargetPicker();
    // L'objet est rendu, la file est vidée, aucune cible n'a été touchée.
    expect(S().showTargetPicker).toBeNull();
    expect(S().pendingActions).toBeNull();
    expect(bagKeys(0)).toContain('testSceau');
    expect(team(1).powersBlockedTurns ?? 0).toBe(0);
  });

  it('valider la cible applique l’effet et consomme bien l’objet', () => {
    S().useConsumable(0);
    S().selectTarget(1);
    expect(S().showTargetPicker).toBeNull();
    expect(team(1).powersBlockedTurns).toBe(2);
    expect(bagKeys(0)).not.toContain('testSceau');
  });
});
