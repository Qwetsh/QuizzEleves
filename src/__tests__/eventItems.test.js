// Événements d'objet ajoutés : « Les trois coffres » (gain au choix) et
// « Pickpocket » (perte aléatoire d'un objet).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { ITEMS } from '../data/items.js';
import { EVENTS } from '../data/events.js';

const S = () => useGameStore.getState();
const KEY = Object.keys(ITEMS)[0]; // un objet réel du catalogue

function setup(teamOver = {}) {
  useGameStore.setState({
    phase: 'game', currentTeam: 0, eventApplied: false, finished: false,
    teams: [{
      name: 'A', emoji: '🦁', color: '#111', pos: 'depart', money: 50,
      correct: 0, wrong: 0, powers: {},
      equipment: { head: null, body: null, feet: null }, bag: [],
      ...teamOver,
    }],
    board: { depart: { x: 0, y: 0, type: 'depart', next: [] } },
    log: [], enabledItems: Object.keys(ITEMS), lootReveal: null,
  });
}

describe('événement : Les trois coffres', () => {
  beforeEach(() => setup());

  it('acceptEvent propose 3 objets en phase choice', () => {
    useGameStore.setState({ showEvent: { key: 'troisCoffres', event: EVENTS.troisCoffres, phase: 'intro', data: {} } });
    S().acceptEvent();
    expect(S().showEvent.phase).toBe('choice');
    expect(S().showEvent.data.gifts.length).toBeGreaterThan(0);
    expect(S().showEvent.data.gifts.length).toBeLessThanOrEqual(3);
  });

  it('eventChooseGift donne l\'objet choisi (révélation) et ignore un objet non proposé', () => {
    useGameStore.setState({ showEvent: { key: 'troisCoffres', event: EVENTS.troisCoffres, phase: 'choice', data: { gifts: [KEY] } } });
    // Objet hors des coffres proposés → ignoré
    const other = Object.keys(ITEMS)[1];
    S().eventChooseGift(other);
    expect(S().showEvent).not.toBeNull();
    // Objet proposé → équipé ou en sac + cérémonie de gain
    S().eventChooseGift(KEY);
    const t = S().teams[0];
    const owned = Object.values(t.equipment).includes(KEY) || (t.bag || []).includes(KEY);
    expect(owned).toBe(true);
    expect(S().lootReveal?.itemKey).toBe(KEY);
  });
});

describe('événement : Pickpocket', () => {
  beforeEach(() => setup());

  it('retire un objet au hasard et passe au résultat', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    setup({ equipment: { head: KEY, body: null, feet: null } });
    useGameStore.setState({ showEvent: { key: 'pickpocket', event: EVENTS.pickpocket, phase: 'intro', data: {} } });
    S().applyEventEffect();
    expect(S().teams[0].equipment.head).toBeNull();   // objet perdu
    expect(S().showEvent.phase).toBe('result');
    vi.restoreAllMocks();
  });

  it('sans objet : message « rien à perdre », pas de crash', () => {
    useGameStore.setState({ showEvent: { key: 'pickpocket', event: EVENTS.pickpocket, phase: 'intro', data: {} } });
    S().applyEventEffect();
    expect(S().showEvent.phase).toBe('result');
    expect(S().showEvent.data.message).toMatch(/aucun objet/i);
  });
});

describe('événements scriptés (actions du moteur)', () => {
  beforeEach(() => setup());

  it('Bénédiction pose un buff via le moteur puis termine le tour', () => {
    const nextTurn = vi.fn();
    useGameStore.setState({ nextTurn, showEvent: { key: 'benediction', event: EVENTS.benediction, phase: 'intro', data: {} } });
    S().acceptEvent();
    expect(S().teams[0].buffs?.some((b) => b.type === 'advanceOnCorrect')).toBe(true);
    expect(S().showEvent).toBeNull();
    expect(nextTurn).toHaveBeenCalled();
  });

  it('Boussole cassée pose le flag randomPathNext', () => {
    const nextTurn = vi.fn();
    useGameStore.setState({ nextTurn, showEvent: { key: 'boussoleCassee', event: EVENTS.boussoleCassee, phase: 'intro', data: {} } });
    S().acceptEvent();
    expect(S().teams[0].randomPathNext).toBe(true);
    expect(nextTurn).toHaveBeenCalled();
  });
});

describe('événements de pari (loterie, sphinx)', () => {
  it('loterie : gain si tirage favorable', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    setup({ money: 50 });
    useGameStore.setState({ showEvent: { key: 'loterie', event: EVENTS.loterie, phase: 'intro', data: {} } });
    S().applyEventEffect();
    expect(S().teams[0].money).toBe(90);
    expect(S().showEvent.phase).toBe('result');
    vi.restoreAllMocks();
  });

  it('sphinx : +50 pièces si bonne réponse', () => {
    setup({ money: 50 });
    useGameStore.setState({ showEvent: { key: 'sphinx', event: EVENTS.sphinx, phase: 'question', data: { questionResult: true } } });
    S().applyEventEffect();
    expect(S().teams[0].money).toBe(100);
  });
});
