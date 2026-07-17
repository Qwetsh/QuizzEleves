// Tests du DRIVER des bots : idempotence, tirs périmés, watchdog, arrêt.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { createBotDriver, WATCHDOG_MS } from '../logic/botDriver.js';

const BOARD = (() => {
  const b = { depart: { x: 0, y: 0, type: 'depart', next: ['n1'] } };
  for (let i = 1; i <= 4; i++) b[`n${i}`] = { x: i, y: 0, type: 'subject', subject: 'maths', next: [i === 4 ? 'arrivee' : `n${i + 1}`] };
  b.arrivee = { x: 5, y: 0, type: 'arrivee', next: [] };
  return b;
})();

const mkTeam = (i, over = {}) => ({
  name: `T${i}`, emoji: '🦁', color: '#111', pos: 'depart', money: 0, correct: 0, wrong: 0,
  powers: {}, equipment: { head: null, body: null, feet: null }, bag: [], buffs: [], ...over,
});

// État « tour libre du bot » (équipe 1) sur plateau linéaire.
function setupBotTurn(over = {}) {
  useGameStore.setState({
    phase: 'game', devSandbox: true,
    board: BOARD, teams: [mkTeam(0), mkTeam(1, { isBot: true, botLevel: 'moyen' })],
    currentTeam: 1, finished: false,
    questions: { maths: [{ q: 'M ?', a: ['a', 'b', 'c', 'd'], c: 0 }] }, askedQuestions: {},
    log: [], enabledEvents: [],
    showQuestion: null, showEvent: null, showFight: null, showDuelChoice: null,
    showStarterChest: false, showMetierPicker: false, showShop: false, showShopPrompt: false,
    lootReveal: null, investResult: null, showInvestPicker: null,
    showTargetPicker: null, showTilePicker: null, showChargePicker: false, showSubjectPicker: false,
    awaitingChoice: false, pendingMove: null, pendingLanding: false, pendingActions: null,
    rolling: false, showDiceModal: false, hackOverlay: null,
    indiceHidden: [], trapDepth: 0, turnCount: 0,
    ...over,
  });
}

describe('botDriver', () => {
  let driver = null;
  const origRollDice = useGameStore.getState().rollDice;

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    if (driver) { driver.stop(); driver = null; }
    useGameStore.setState({ rollDice: origRollDice });
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('planifie et exécute l’action du bot (délais à zéro)', () => {
    const spy = vi.fn();
    setupBotTurn();
    useGameStore.setState({ rollDice: spy });
    driver = createBotDriver(useGameStore, { delayScale: 0 });
    driver.start();
    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('idempotence : la même signature ne replanifie pas', () => {
    const spy = vi.fn();
    setupBotTurn();
    useGameStore.setState({ rollDice: spy });
    driver = createBotDriver(useGameStore, { delayScale: 0 });
    driver.start();
    vi.advanceTimersByTime(1);
    driver.tick(); // même état → pas de nouveau timer
    driver.tick();
    vi.advanceTimersByTime(1000);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('tir périmé : un changement d’état annule le timer en attente', () => {
    const spy = vi.fn();
    setupBotTurn();
    useGameStore.setState({ rollDice: spy });
    driver = createBotDriver(useGameStore, { delayScale: 1 }); // délai réel (1,8 s)
    driver.start();
    // L'humain reprend la main avant que le bot n'agisse.
    useGameStore.setState({ currentTeam: 0 });
    vi.advanceTimersByTime(30000);
    expect(spy).not.toHaveBeenCalled();
  });

  it('watchdog : décision sans effet → action de secours jouée', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const spy = vi.fn(); // rollDice muet : l'état ne bouge jamais
    setupBotTurn();
    useGameStore.setState({ rollDice: spy });
    driver = createBotDriver(useGameStore, { delayScale: 0 });
    driver.start();
    vi.advanceTimersByTime(1); // action normale (sans effet)
    expect(spy).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(WATCHDOG_MS); // → secours
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(warn).toHaveBeenCalled();
  });

  it('vraie action : le bot lance le dé et l’état avance', () => {
    setupBotTurn();
    driver = createBotDriver(useGameStore, { delayScale: 0 });
    driver.start();
    vi.advanceTimersByTime(1);
    expect(useGameStore.getState().rolling).toBe(true);
    expect(useGameStore.getState().showDiceModal).toBe(true);
  });

  it('stop() coupe l’abonnement et les timers', () => {
    const spy = vi.fn();
    setupBotTurn();
    useGameStore.setState({ rollDice: spy });
    driver = createBotDriver(useGameStore, { delayScale: 1 });
    driver.start();
    driver.stop();
    vi.advanceTimersByTime(60000);
    expect(spy).not.toHaveBeenCalled();
    driver = null;
  });
});
