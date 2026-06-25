// Tests des effets avancés : blocage pouvoirs/consommables, saignement d'or (DoT),
// immunités vol d'objet/or, et renvoi (« miroir ») d'effets négatifs.
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { runEffects } from '../store/effectEngine.js';
import { isItemStealImmune, isGoldStealImmune, reflectChanceOf } from '../logic/itemEffects.js';

const LINEAR = (() => {
  const b = { depart: { x: 0, y: 0, type: 'depart', next: ['n1'] } };
  for (let i = 1; i <= 8; i++) b[`n${i}`] = { x: i, y: 0, type: 'subject', subject: 'maths', next: [i === 8 ? 'arrivee' : `n${i + 1}`] };
  b.arrivee = { x: 9, y: 0, type: 'arrivee', next: [] };
  return b;
})();

function mkTeam(i, over = {}) {
  return {
    name: `T${i}`, color: '#111', emoji: '🦁', pos: 'n4', correct: 0, wrong: 0, money: 50,
    powerDef: null, powerOff: null, powers: {}, sablierActif: false, doubleActive: false,
    equipment: { head: null, body: null, feet: null }, bag: [], ...over,
  };
}

function freshGame(overrides = [{}, {}]) {
  useGameStore.setState({
    phase: 'game', devSandbox: true, teams: overrides.map((o, i) => mkTeam(i, o)),
    currentTeam: 0, board: LINEAR, finished: false, askedQuestions: {}, questions: {}, log: [],
    rolling: false, diceValue: null, pendingMove: null, pendingLanding: false, awaitingChoice: false,
    showQuestion: null, showEvent: null, showFight: null, showTargetPicker: null, showShop: false,
    showInventory: false, showChargePicker: false, showDiceModal: false, indiceUsed: false,
    indiceHidden: [], freeActivation: false, movePath: null, preRollPos: null, preRollValue: null,
    pendingActions: null, showTilePicker: null, showActionDice: null, showSubjectPicker: false,
    rerollUsed: false, trapDepth: 0, extensions: {},
  });
}

const S = () => useGameStore.getState();
const team = (i = 0) => S().teams[i];
const set = (patch) => useGameStore.setState(patch);
const get = () => S();
const exec = (actions, ctx = {}) => runEffects(set, get, actions, ctx);

beforeEach(() => freshGame());

// --- Blocage des pouvoirs / consommables -------------------------------
describe('blocage pouvoirs & consommables', () => {
  it('blockPowers pose un compteur sur la cible et garde l’usage', () => {
    exec([{ action: 'blockPowers', target: 'target', turns: 2 }], { sourceTeam: 0, targetTeam: 1 });
    expect(team(1).powersBlockedTurns).toBe(2);
    // L'équipe 1 (bloquée) ne peut pas lancer de pouvoir : pas de sélecteur de cible.
    useGameStore.setState({ currentTeam: 1, teams: S().teams.map((t, i) => (i === 1 ? { ...t, powers: { foudre: { charges: 3, level: 1 } } } : t)) });
    S().usePower('foudre');
    expect(S().showTargetPicker).toBeNull();
  });

  it('blockConsumables empêche d’utiliser un consommable', () => {
    useGameStore.setState({ currentTeam: 1, teams: S().teams.map((t, i) => (i === 1 ? { ...t, consumablesBlockedTurns: 2, bag: ['painVoyageur'] } : t)) });
    S().useConsumable(0);
    // L'objet n'est pas consommé (toujours dans le sac).
    expect(S().teams[1].bag[0]).toBe('painVoyageur');
  });

  it('le compteur de blocage décroît quand l’équipe regagne la main', () => {
    useGameStore.setState({ teams: S().teams.map((t, i) => (i === 1 ? { ...t, powersBlockedTurns: 2 } : t)) });
    S().nextTurn(); // 0 -> 1 : l'équipe 1 regagne la main
    expect(team(1).powersBlockedTurns).toBe(1);
  });
});

// --- Saignement d'or (DoT) ---------------------------------------------
describe('saignement d’or (bleedGold)', () => {
  it('mode steal : la victime perd, le lanceur encaisse, à chaque tour', () => {
    useGameStore.setState({ teams: [mkTeam(0, { money: 10 }), mkTeam(1, { money: 50 })], currentTeam: 0 });
    exec([{ action: 'buff', target: 'target', buff: { type: 'bleedGold', turns: 2, n: 5, mode: 'steal' } }], { sourceTeam: 0, targetTeam: 1 });
    expect(team(1).buffs.find((b) => b.type === 'bleedGold')?.from).toBe(0);
    S().nextTurn(); // l'équipe 1 regagne la main → saignement
    expect(team(1).money).toBe(45);
    expect(team(0).money).toBe(15); // le lanceur encaisse
  });

  it('mode lose : perte sèche (personne ne récupère)', () => {
    useGameStore.setState({ teams: [mkTeam(0, { money: 10 }), mkTeam(1, { money: 50 })], currentTeam: 0 });
    exec([{ action: 'buff', target: 'target', buff: { type: 'bleedGold', turns: 2, n: 5, mode: 'lose' } }], { sourceTeam: 0, targetTeam: 1 });
    S().nextTurn();
    expect(team(1).money).toBe(45);
    expect(team(0).money).toBe(10); // inchangé
  });

  it('respecte l’immunité au vol d’or', () => {
    useGameStore.setState({ teams: [mkTeam(0), mkTeam(1, { money: 50, buffs: [{ type: 'bleedGold', turns: 2, n: 5, mode: 'lose' }, { type: 'goldStealImmune', turns: 5 }] })], currentTeam: 0 });
    S().nextTurn();
    expect(team(1).money).toBe(50); // protégé
  });
});

// --- Immunités ----------------------------------------------------------
describe('immunités vol d’or / vol d’objet', () => {
  it('goldStealImmune (passif) annule un vol d’or', () => {
    useGameStore.setState({ teams: [mkTeam(0, { money: 50 }), mkTeam(1, { money: 50, equipment: { head: null, body: null, feet: 'cadenasRunique' } })], currentTeam: 0 });
    expect(isGoldStealImmune(team(1))).toBe(true);
    exec([{ action: 'money', mode: 'steal', target: 'target', n: 20, unit: 'flat' }], { sourceTeam: 0, targetTeam: 1 });
    expect(team(1).money).toBe(50); // rien volé
    expect(team(0).money).toBe(50);
  });

  it('itemStealImmune est détecté (passif équipement)', () => {
    const t = mkTeam(1, { equipment: { head: null, body: null, feet: 'talismanGardien' } });
    expect(isItemStealImmune(t)).toBe(true);
  });
});

// --- Renvoi (« miroir ») ------------------------------------------------
describe('renvoi d’effet négatif', () => {
  it('reflectChance 100 % renvoie un vol d’or en perte pour l’attaquant', () => {
    useGameStore.setState({ teams: [mkTeam(0, { money: 50 }), mkTeam(1, { money: 50, buffs: [{ type: 'reflectChance', turns: 5, n: 100 }] })], currentTeam: 0 });
    expect(reflectChanceOf(team(1))).toBe(100);
    exec([{ action: 'money', mode: 'steal', target: 'target', n: 10, unit: 'flat' }], { sourceTeam: 0, targetTeam: 1 });
    expect(team(1).money).toBe(50); // la cible est épargnée
    expect(team(0).money).toBe(40); // l'attaquant subit la perte
  });

  it('reflectChance 100 % renvoie un recul sur l’attaquant', () => {
    useGameStore.setState({ teams: [mkTeam(0, { pos: 'n4' }), mkTeam(1, { pos: 'n4', buffs: [{ type: 'reflectChance', turns: 5, n: 100 }] })], currentTeam: 0 });
    exec([{ action: 'move', dir: 'back', target: 'target', n: 2 }], { sourceTeam: 0, targetTeam: 1 });
    expect(team(1).pos).toBe('n4'); // cible épargnée
    expect(team(0).pos).toBe('n2'); // attaquant reculé
  });
});
