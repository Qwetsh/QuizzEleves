// Tests de l'extension « Magie » : accrual temps réel (magie/minute), actions
// du moteur (gainMagic/learnRune/learnSpell/blessFace/curseFace/cleanseFaces/
// unstableAnswers), incantation (castSpellFor : connu/découverte/fizzle/refus),
// résolution des faces bénies/maudites au lancer, intents et backfill de save.
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { runEffects } from '../store/effectEngine.js';
import { MAGIC } from '../logic/balanceConfig.js';
import {
  magicNow, magicRegenPerMin, magicMaxOf, materializeMagic, spendMagic,
  gainMagicBlock, initTeamMagic, starterKnowledge,
} from '../logic/magic.js';
import { SPELLS, BASE_SPELLS, matchSpell, setCustomSpells } from '../data/spells.js';
import { RUNE_KEYS } from '../data/runes.js';
import { saveGame } from '../store/persistence.js';

// Mock localStorage (backfill de save + saveGame appelés par castSpellFor).
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store[key] = value; }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Plateau linéaire : depart -> n1..n8 -> arrivee.
const LINEAR = (() => {
  const b = { depart: { x: 0, y: 0, type: 'depart', next: ['n1'] } };
  for (let i = 1; i <= 8; i++) {
    b[`n${i}`] = { x: i, y: 0, type: 'subject', subject: 'maths', next: [i === 8 ? 'arrivee' : `n${i + 1}`] };
  }
  b.arrivee = { x: 9, y: 0, type: 'arrivee', next: [] };
  return b;
})();

const QUESTIONS = {
  maths: [
    { q: 'Q1 ?', a: ['A', 'B', 'C', 'D'], c: 1 },
    { q: 'Q2 ?', a: ['A', 'B', 'C', 'D'], c: 2 },
  ],
};

const NOW = Date.now();

function mkTeam(i, over = {}) {
  return {
    name: `T${i}`, color: '#111', emoji: '🦁', token: `tok${i}`,
    pos: 'n4', correct: 0, wrong: 0, money: 50, streak: 0,
    powerDef: null, powerOff: null, powers: {},
    sablierActif: false, doubleActive: false,
    equipment: { head: null, body: null, feet: null }, bag: [],
    magic: { stored: 100, lastTs: NOW },
    knownRunes: ['cercle', 'eclair', 'fleche'],
    knownSpells: ['etincelle'],
    faceMods: {},
    ...over,
  };
}

function freshGame(overrides = [{}, {}], extensions = { magic: true }) {
  useGameStore.setState({
    phase: 'game', devSandbox: true,
    teams: overrides.map((o, i) => mkTeam(i, o)),
    currentTeam: 0, board: LINEAR, finished: false,
    extensions,
    askedQuestions: {}, questions: QUESTIONS, log: [],
    rolling: false, diceValue: null, pendingMove: null, pendingLanding: false,
    awaitingChoice: false, showQuestion: null, showEvent: null, showFight: null,
    showDuelChoice: null, showTargetPicker: null, showShop: false, showInventory: false,
    showChargePicker: false, showDiceModal: false,
    indiceUsed: false, indiceHidden: [], freeActivation: false,
    movePath: null, preRollPos: null, preRollValue: null,
    pendingActions: null, showTilePicker: null, showActionDice: null,
    showSubjectPicker: false, rerollUsed: false, trapDepth: 0,
    spellCeremony: null, spellCeremonySeq: 0,
    gameStats: { answers: [], itemUses: [], powerUses: [], spellCasts: [] },
  });
}

const S = () => useGameStore.getState();
const team = (i = 0) => S().teams[i];
const set = (patch) => useGameStore.setState(patch);
const get = () => S();
const exec = (actions, ctx = {}) => runEffects(set, get, actions, ctx);

// MAGIC est un objet muable (balanceConfig) : snapshot/restore pour isoler les
// tests qui le modifient (cooldown, fizzleCost…).
const MAGIC_SNAP = { ...MAGIC };
beforeAll(() => { MAGIC.castCooldownMs = 0; });
afterAll(() => { Object.assign(MAGIC, MAGIC_SNAP); });
beforeEach(() => {
  localStorageMock.clear();
  Object.assign(MAGIC, MAGIC_SNAP, { castCooldownMs: 0 });
  setCustomSpells([]); // catalogue = sorts intégrés
  freshGame();
});

// --- Accrual (logic/magic.js) -------------------------------------------

describe('accrual magie/minute', () => {
  it('magicNow régénère au fil du temps réel et plafonne au max', () => {
    const t = mkTeam(0, { magic: { stored: 10, lastTs: NOW } });
    expect(magicNow(t, NOW)).toBe(10);
    // +2,5 min au taux de base (4/min) → +10
    expect(magicNow(t, NOW + 2.5 * 60000)).toBeCloseTo(20, 5);
    // très longtemps après → plafonné à magicMaxOf
    expect(magicNow(t, NOW + 10 * 3600 * 1000)).toBe(magicMaxOf(t));
  });

  it('magicNow est défensif (équipe sans magie → 0, pas de throw)', () => {
    expect(magicNow({ name: 'X' })).toBe(0);
    expect(magicNow(null)).toBe(0);
  });

  it('les buffs magicRegen augmentent le taux ; jamais négatif', () => {
    const t = mkTeam(0, { buffs: [{ type: 'magicRegen', turns: 3, n: 6 }] });
    expect(magicRegenPerMin(t)).toBe(MAGIC.regenPerMin + 6);
    const tNeg = mkTeam(0, { buffs: [{ type: 'magicRegen', turns: 3, n: -99 }] });
    expect(magicRegenPerMin(tNeg)).toBe(0);
  });

  it('materialize fige la valeur courante ; spend refuse si insuffisant', () => {
    const t = mkTeam(0, { magic: { stored: 10, lastTs: NOW } });
    const later = NOW + 60000; // +1 min → +regenPerMin
    const mat = materializeMagic(t, later);
    expect(mat.stored).toBeCloseTo(10 + MAGIC.regenPerMin, 5);
    expect(mat.lastTs).toBe(later);
    expect(spendMagic(t, 10 + MAGIC.regenPerMin + 1, later)).toBeNull();
    const spent = spendMagic(t, 10, later);
    expect(spent.stored).toBeCloseTo(MAGIC.regenPerMin, 5);
  });

  it('gainMagicBlock plafonne au max effectif', () => {
    const t = mkTeam(0, { magic: { stored: 95, lastTs: NOW } });
    expect(gainMagicBlock(t, 50, NOW).stored).toBe(magicMaxOf(t));
  });

  it('starterKnowledge : sorts les moins chers + leurs runes toujours incluses', () => {
    const { knownRunes, knownSpells } = starterKnowledge(() => 0);
    expect(knownSpells).toHaveLength(MAGIC.starterSpells);
    const starterSpellRunes = SPELLS.filter((s) => knownSpells.includes(s.key)).flatMap((s) => s.runes);
    for (const r of starterSpellRunes) expect(knownRunes).toContain(r);
    expect(knownRunes.length).toBeGreaterThanOrEqual(Math.min(MAGIC.starterRunes, RUNE_KEYS.length));
  });
});

// --- Catalogue de sorts (data/spells.js) --------------------------------

describe('catalogue de sorts', () => {
  it("matchSpell est sensible à l'ORDRE de la séquence", () => {
    expect(matchSpell(['cercle', 'eclair'])?.key).toBe('etincelle');
    expect(matchSpell(['eclair', 'cercle'])).toBeNull();
    expect(matchSpell([])).toBeNull();
  });

  it('setCustomSpells fusionne par clé par-dessus les intégrés', () => {
    setCustomSpells([{ key: 'etincelle', name: 'Étincelle+', runes: ['croix'], cost: 5, actions: [] }]);
    expect(matchSpell(['croix'])?.name).toBe('Étincelle+');
    expect(matchSpell(['cercle', 'eclair'])).toBeNull(); // l'ancienne séquence n'existe plus
    setCustomSpells([]);
    expect(matchSpell(['cercle', 'eclair'])?.key).toBe('etincelle');
    expect(SPELLS.length).toBe(BASE_SPELLS.length);
  });
});

// --- Actions du moteur ---------------------------------------------------

describe('actions moteur magie', () => {
  it('gainMagic crédite la barre (plafonnée)', () => {
    freshGame([{ magic: { stored: 20, lastTs: Date.now() } }, {}]);
    exec([{ action: 'gainMagic', n: 15, target: 'self' }]);
    expect(Math.round(magicNow(team(0)))).toBe(35);
  });

  it('learnRune précise puis aléatoire-inconnue ; no-op si tout est connu', () => {
    exec([{ action: 'learnRune', rune: 'croix' }]);
    expect(team(0).knownRunes).toContain('croix');
    vi.spyOn(Math, 'random').mockReturnValue(0);
    exec([{ action: 'learnRune' }]);
    vi.restoreAllMocks();
    expect(team(0).knownRunes.length).toBe(5);
    // tout apprendre → no-op silencieux
    set({ teams: [{ ...team(0), knownRunes: [...RUNE_KEYS] }, team(1)] });
    exec([{ action: 'learnRune' }]);
    expect(team(0).knownRunes.length).toBe(RUNE_KEYS.length);
  });

  it('learnSpell ajoute le sort ET ses runes (un sort connu est traçable)', () => {
    freshGame([{ knownRunes: ['cercle'], knownSpells: [] }, {}]);
    exec([{ action: 'learnSpell', spell: 'brouillardMental' }]);
    expect(team(0).knownSpells).toContain('brouillardMental');
    expect(team(0).knownRunes).toEqual(expect.arrayContaining(['serpent', 'spirale']));
  });

  it('blessFace marque la face (ctx.face pré-résolu) ; curseFace vise la cible', () => {
    exec([{ action: 'blessFace', n: 12, target: 'self' }], { face: 3 });
    expect(team(0).faceMods[3]).toMatchObject({ kind: 'bless', gold: 12 });
    exec([{ action: 'curseFace', n: 8, target: 'target' }], { targetTeam: 1, face: 5 });
    expect(team(1).faceMods[5]).toMatchObject({ kind: 'curse', gold: 8, by: 0 });
  });

  it('cleanseFaces purge selon le scope', () => {
    freshGame([{ faceMods: { 2: { kind: 'bless', gold: 10 }, 5: { kind: 'curse', gold: 10 } } }, {}]);
    exec([{ action: 'cleanseFaces', scope: 'curse', target: 'self' }]);
    expect(team(0).faceMods[5]).toBeUndefined();
    expect(team(0).faceMods[2]).toBeTruthy();
    exec([{ action: 'cleanseFaces', scope: 'all', target: 'self' }]);
    expect(Object.keys(team(0).faceMods)).toHaveLength(0);
  });

  it('unstableAnswers pose modeleurInterval en gardant le plus agressif', () => {
    exec([{ action: 'unstableAnswers', interval: 4, target: 'target' }], { targetTeam: 1 });
    expect(team(1).modeleurInterval).toBe(4);
    // une météo/un cast plus agressif écrase ; un moins agressif est ignoré
    exec([{ action: 'unstableAnswers', interval: 2, target: 'target' }], { targetTeam: 1 });
    expect(team(1).modeleurInterval).toBe(2);
    exec([{ action: 'unstableAnswers', interval: 6, target: 'target' }], { targetTeam: 1 });
    expect(team(1).modeleurInterval).toBe(2);
  });

  it('unstableAnswers est consommé à la prochaine question (showQuestion.modeleur)', () => {
    exec([{ action: 'unstableAnswers', interval: 3, target: 'self' }]);
    expect(team(0).modeleurInterval).toBe(3);
    S().askQuestion('maths');
    expect(S().showQuestion.modeleur).toBe(3);
    expect(team(0).modeleurInterval).toBeUndefined();
  });
});

// --- Résolution des faces au lancer (handleDiceResult) -------------------

describe('faces bénies/maudites au lancer', () => {
  it('face bénie : +or quand elle tombe ; autre face : rien', () => {
    freshGame([{ pos: 'n1', money: 50, faceMods: { 3: { kind: 'bless', gold: 10, by: 0 } } }, {}]);
    S().handleDiceResult(3);
    expect(team(0).money).toBe(60);
    freshGame([{ pos: 'n1', money: 50, faceMods: { 3: { kind: 'bless', gold: 10, by: 0 } } }, {}]);
    S().handleDiceResult(4);
    expect(team(0).money).toBe(50);
  });

  it('face maudite : −or, plancher à 0 ; extension coupée : inerte', () => {
    freshGame([{ pos: 'n1', money: 5, faceMods: { 2: { kind: 'curse', gold: 10, by: 1 } } }, {}]);
    S().handleDiceResult(2);
    expect(team(0).money).toBe(0);
    freshGame([{ pos: 'n1', money: 50, faceMods: { 2: { kind: 'curse', gold: 10, by: 1 } } }, {}], { magic: false });
    S().handleDiceResult(2);
    expect(team(0).money).toBe(50);
  });
});

// --- Incantation (castSpellFor) ------------------------------------------

describe('castSpellFor', () => {
  it('sort connu : débit + effet + cérémonie « cast »', () => {
    const r = S().castSpellFor(0, { runes: ['cercle', 'eclair'] });
    expect(r).toMatchObject({ ok: true, spell: 'etincelle', discovered: false });
    expect(team(0).money).toBe(60); // +10 or
    expect(Math.round(magicNow(team(0)))).toBe(80); // 100 − 20
    expect(S().spellCeremony).toMatchObject({ outcome: 'cast', spellKey: 'etincelle', teamIdx: 0 });
  });

  it('combo valide inconnue : DÉCOUVERTE (codex + runes) + effet appliqué', () => {
    const r = S().castSpellFor(0, { runes: ['eclair', 'fleche'] }); // Pas de l'éclair (inconnu)
    expect(r).toMatchObject({ ok: true, discovered: true });
    expect(team(0).knownSpells).toContain('pasDeLEclair');
    expect(team(0).pos).toBe('n6'); // avance de 2 depuis n4
    expect(S().spellCeremony.outcome).toBe('discover');
  });

  it('combo invalide : fizzle, le coût de tentative est perdu', () => {
    const r = S().castSpellFor(0, { runes: ['cercle', 'cercle'] });
    expect(r).toMatchObject({ ok: false, reason: 'fizzle' });
    expect(Math.round(magicNow(team(0)))).toBe(100 - MAGIC.fizzleCost);
    expect(S().spellCeremony.outcome).toBe('fizzle');
  });

  it('magie insuffisante : refus SANS cérémonie ni débit', () => {
    freshGame([{ magic: { stored: 5, lastTs: Date.now() } }, {}]);
    const r = S().castSpellFor(0, { runes: ['cercle', 'eclair'] });
    expect(r).toMatchObject({ ok: false, reason: 'noMana' });
    expect(S().spellCeremony).toBeNull();
    expect(Math.round(magicNow(team(0)))).toBe(5);
  });

  it('refus si résolution en cours (file d\'effets unique) ou extension coupée', () => {
    set({ showQuestion: { question: {} } });
    expect(S().castSpellFor(0, { runes: ['cercle', 'eclair'] }).reason).toBe('busy');
    freshGame([{}, {}], { magic: false });
    expect(S().castSpellFor(0, { runes: ['cercle', 'eclair'] }).reason).toBe('off');
  });

  it('cooldown anti-spam entre deux casts', () => {
    MAGIC.castCooldownMs = 60000;
    S().castSpellFor(0, { runes: ['cercle', 'eclair'] });
    const r = S().castSpellFor(0, { runes: ['cercle', 'eclair'] });
    expect(r.reason).toBe('cooldown');
  });

  it('sort ciblé : cible du payload respectée ; sinon « magie sauvage » aléatoire', () => {
    freshGame([{ knownSpells: ['etincelle', 'mainInvisible'] }, { money: 30 }, { money: 30 }]);
    const r = S().castSpellFor(0, { runes: ['spirale', 'serpent'], target: 2 });
    expect(r.ok).toBe(true);
    expect(team(2).money).toBe(20); // volé
    expect(team(1).money).toBe(30); // épargné
    // sans cible fournie (découverte) → un adversaire au hasard, jamais soi-même
    freshGame([{ knownSpells: [] }, { money: 30 }]);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const r2 = S().castSpellFor(0, { runes: ['spirale', 'serpent'] });
    vi.restoreAllMocks();
    expect(r2.discovered).toBe(true);
    expect(team(1).money).toBe(20);
  });

  it('sort à face : payload.face pré-résolu → marque posée sans picker', () => {
    freshGame([{ knownSpells: ['benedictionDe'], magic: { stored: 100, lastTs: Date.now() } }, {}]);
    const r = S().castSpellFor(0, { runes: ['triangle', 'cercle', 'croix'], face: 4 });
    expect(r.ok).toBe(true);
    expect(team(0).faceMods[4]).toMatchObject({ kind: 'bless' });
    expect(S().pendingActions).toBeNull(); // jamais de suspension sur le chemin cast
  });
});

// --- Intents mobiles ------------------------------------------------------

describe('intent castSpell', () => {
  it('garde GLOBALE : rejeté pendant la résolution de N\'IMPORTE QUELLE équipe', () => {
    set({ showQuestion: { question: {} }, currentTeam: 0 });
    S().applyTeamIntent('tok1', 'castSpell', { runes: ['cercle', 'eclair'] });
    expect(Math.round(magicNow(team(1)))).toBe(100); // rien débité
    set({ showQuestion: null });
    S().applyTeamIntent('tok1', 'castSpell', { runes: ['cercle', 'eclair'] });
    expect(Math.round(magicNow(team(1)))).toBe(80); // cast passé hors résolution
    expect(team(1).money).toBe(60);
  });

  it('jeton inconnu → no-op', () => {
    S().applyTeamIntent('nope', 'castSpell', { runes: ['cercle', 'eclair'] });
    expect(S().spellCeremony).toBeNull();
  });
});

// --- Matérialisation & backfill -------------------------------------------

describe('nextTurn & resume', () => {
  it('nextTurn matérialise la magie de toutes les équipes', () => {
    const past = Date.now() - 60000; // il y a 1 min
    freshGame([{ magic: { stored: 10, lastTs: past } }, { magic: { stored: 20, lastTs: past } }]);
    S().nextTurn();
    for (const [i, base] of [[0, 10], [1, 20]]) {
      const m = team(i).magic;
      expect(m.lastTs).toBeGreaterThan(past);
      expect(m.stored).toBeGreaterThanOrEqual(base + MAGIC.regenPerMin * 0.99);
    }
  });

  it('resumeGame : vieille save sans clé magic → extension figée à OFF', () => {
    saveGame({
      phase: 'game', teams: [mkTeam(0), mkTeam(1)], currentTeam: 0, board: LINEAR,
      askedQuestions: {}, extensions: { equipment: false, weather: false }, finished: false, log: [],
    });
    S().resumeGame();
    expect(S().extensions.magic).toBe(false);
  });

  it('resumeGame : magie ON → lastTs remis à maintenant (pas de régen hors session) + backfill', () => {
    const old = Date.now() - 3600 * 1000;
    const t0 = mkTeam(0, { magic: { stored: 42, lastTs: old } });
    const t1 = { ...mkTeam(1), magic: undefined, knownRunes: undefined, knownSpells: undefined, faceMods: undefined };
    saveGame({
      phase: 'game', teams: [t0, t1], currentTeam: 0, board: LINEAR,
      askedQuestions: {}, extensions: { equipment: false, magic: true }, finished: false, log: [],
    });
    S().resumeGame();
    expect(team(0).magic.stored).toBe(42);
    expect(team(0).magic.lastTs).toBeGreaterThan(old + 3500 * 1000);
    expect(team(1).magic.stored).toBe(MAGIC.start);
    expect(Array.isArray(team(1).knownRunes)).toBe(true);
    expect(Array.isArray(team(1).knownSpells)).toBe(true);
    expect(team(1).faceMods).toEqual({});
  });
});
