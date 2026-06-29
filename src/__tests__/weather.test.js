// Événements de terrain (« météo ») — résolution + cadence (branches
// déterministes ; les tirages aléatoires sont contournés par des overrides).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveWeather, maybeDrawWeather, triggerWeather, weatherMoveFactor } from '../store/weatherHandlers.js';
import { WEATHER } from '../logic/balanceConfig.js';
import { MAX_CHARGES } from '../data/powers.js';

// Faux store minimal { get, set } + journal capturé.
function makeStore(initial = {}) {
  const logs = [];
  let state;
  const get = () => state;
  const set = (patch) => { state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }; };
  state = {
    log: logs, addLog: (m) => logs.push(m),
    teams: [], extensions: { weather: true, mastery: false }, board: {},
    turnCount: 0, lastWeatherTurn: 0, weather: null, weatherNotice: null, weatherCeremony: null,
    phase: 'game',
    ...initial,
  };
  return { get, set, logs };
}

// Petit plateau linéaire depart→a→b (pour les reculs / moveBack).
const linearBoard = () => ({
  depart: { type: 'depart', next: ['a'], x: 0, y: 0 },
  a: { type: 'subject', next: ['b'], x: 130, y: 0 },
  b: { type: 'subject', next: [], x: 260, y: 0 },
});

// Sauvegarde/restaure les valeurs d'équilibrage modifiées dans un test.
let snap;
beforeEach(() => { snap = JSON.parse(JSON.stringify(WEATHER)); });
afterEach(() => { Object.assign(WEATHER, JSON.parse(JSON.stringify(snap))); });

describe('weather — résolution', () => {
  it('vent : pose une météo ambiante avec facteur et durée', () => {
    const { get, set } = makeStore();
    resolveWeather(set, get, 'ventContraire');
    const w = get().weather;
    expect(w).toBeTruthy();
    expect(w.nature).toBe('ambient');
    expect(w.factor).toBe(WEATHER.vent.contraireFactor);
    expect(w.turnsLeft).toBe(WEATHER.durations.ventContraire);
    expect(weatherMoveFactor(get)).toBe(WEATHER.vent.contraireFactor);
  });

  it('soleil : recharge un pouvoir, plafonné à MAX_CHARGES', () => {
    WEATHER.soleil.charge = 1;
    const { get, set } = makeStore({
      teams: [
        { emoji: '🟦', name: 'A', powers: { bouclier: { charges: 0 }, foudre: { charges: 4 } } },
        { emoji: '🟥', name: 'B', powers: { relance: { charges: MAX_CHARGES } } }, // déjà au max
      ],
    });
    resolveWeather(set, get, 'soleil');
    const t = get().teams;
    expect(t[0].powers.bouclier.charges).toBe(1);   // le plus en manque rechargé
    expect(t[0].powers.foudre.charges).toBe(4);      // l'autre inchangé
    expect(t[1].powers.relance.charges).toBe(MAX_CHARGES); // plafond respecté
  });

  it('pluie acide : perd un équipement, sinon de l’or', () => {
    WEATHER.pluieAcide.gold = 15;
    const { get, set } = makeStore({
      teams: [
        { emoji: '🟦', name: 'A', equipment: { head: 'casque', body: null, feet: null }, money: 100 },
        { emoji: '🟥', name: 'B', equipment: { head: null, body: null, feet: null }, money: 100 },
        { emoji: '🟩', name: 'C', equipment: { head: null, body: null, feet: null }, money: 5 },
      ],
    });
    resolveWeather(set, get, 'pluieAcide');
    const t = get().teams;
    expect(t[0].equipment.head).toBe(null); // équipement corrodé
    expect(t[0].money).toBe(100);           // or intact (avait un équipement)
    expect(t[1].money).toBe(85);            // pas d'équip → −15 or
    expect(t[2].money).toBe(0);             // or perdu plafonné au solde (5 < 15)
  });

  it('orage : recule les équipes sur une case frappée', () => {
    WEATHER.orage.tileRatio = 1;  // toutes les cases frappées
    WEATHER.orage.die = 2;        // recul fixe de 2
    const { get, set } = makeStore({
      board: linearBoard(),
      teams: [{ emoji: '🟦', name: 'A', pos: 'b', money: 0 }],
    });
    resolveWeather(set, get, 'orage');
    expect(get().teams[0].pos).toBe('depart'); // b → (−2) → depart
    expect(get().weatherCeremony.strikes).toEqual([0]); // pion frappé → foudre ciblée
  });

  it('orage : aucune foudre ciblée si personne n’est sur une case frappée', () => {
    WEATHER.orage.tileRatio = 0; // aucune case frappée
    const { get, set } = makeStore({
      board: linearBoard(),
      teams: [{ emoji: '🟦', name: 'A', pos: 'b', money: 0 }],
    });
    resolveWeather(set, get, 'orage');
    expect(get().teams[0].pos).toBe('b'); // pas touché → pas de recul
    expect(get().weatherCeremony.strikes).toEqual([]);
  });
});

describe('weather — séisme', () => {
  // Plateau : 1 section, 2 voies (haut/bas) de 2 cases menant à l'arrivée.
  const quakeBoard = () => ({
    depart: { type: 'depart', next: ['s1_a_0'], x: 0, y: 480 },
    s1_a_0: { type: 'subject', next: ['s1_a_1'], x: 130, y: 220 },
    s1_a_1: { type: 'subject', next: ['arrivee'], x: 260, y: 220 },
    s1_b_0: { type: 'subject', next: ['s1_b_1'], x: 130, y: 740 },
    s1_b_1: { type: 'subject', next: ['arrivee'], x: 260, y: 740 },
    arrivee: { type: 'arrivee', next: [], x: 390, y: 480 },
  });

  it('borné avant l’arrivée : un pion ne peut jamais atterrir sur l’arrivée', () => {
    WEATHER.seisme.ticks = 6;
    for (let run = 0; run < 60; run++) {
      const { get, set } = makeStore({ board: quakeBoard(), teams: [{ emoji: '🟦', name: 'A', pos: 's1_a_0' }] });
      resolveSeisme_call(get, set);
      expect(get().teams[0].pos).not.toBe('arrivee');
    }
  });

  it('produit une animation tick-par-tick (un waypoint par secousse)', () => {
    WEATHER.seisme.ticks = 6;
    let moved = false;
    for (let run = 0; run < 30 && !moved; run++) {
      const { get, set } = makeStore({ board: quakeBoard(), teams: [{ emoji: '🟦', name: 'A', pos: 's1_a_0' }] });
      resolveSeisme_call(get, set);
      const mp = get().movePath;
      if (mp?.length) { moved = true; expect(mp[0].waypoints.length).toBe(7); } // départ + 6 ticks
    }
    expect(moved).toBe(true);
  });
});

// resolveSeisme n'est pas exporté : on le déclenche via triggerWeather (forcé).
function resolveSeisme_call(get, set) { triggerWeather(set, get, 'seisme', { forced: true }); }

describe('weather — cadence (maybeDrawWeather)', () => {
  it('ne tire rien tant que le cooldown (min) n’est pas écoulé', () => {
    WEATHER.cadence = { min: 3, max: 5 };
    const { get, set } = makeStore({ turnCount: 2, lastWeatherTurn: 0 });
    maybeDrawWeather(set, get);
    expect(get().weather).toBe(null);
    expect(get().weatherNotice).toBe(null);
  });

  it('résout un préavis arrivé à échéance', () => {
    const { get, set } = makeStore({
      turnCount: 6, lastWeatherTurn: 0,
      weatherNotice: { id: 'soleil' },
      teams: [{ emoji: '🟦', name: 'A', powers: { bouclier: { charges: 0 } } }],
    });
    maybeDrawWeather(set, get);
    expect(get().weatherNotice).toBe(null);
    expect(get().weatherCeremony?.id).toBe('soleil');
    expect(get().lastWeatherTurn).toBe(6);
  });

  it('décompte une météo ambiante, puis l’expire', () => {
    const { get, set } = makeStore({ weather: { id: 'ventContraire', nature: 'ambient', turnsLeft: 2, factor: 0.5 } });
    maybeDrawWeather(set, get);
    expect(get().weather.turnsLeft).toBe(1);
    maybeDrawWeather(set, get);
    expect(get().weather).toBe(null);
  });

  it('coupée si l’extension weather est désactivée', () => {
    const { get, set } = makeStore({ extensions: { weather: false }, turnCount: 99, lastWeatherTurn: 0 });
    maybeDrawWeather(set, get);
    expect(get().weather).toBe(null);
    expect(get().weatherNotice).toBe(null);
  });
});

describe('weather — pluie maudite (pool)', () => {
  it('perte d’or : chaque équipe lance son propre dé, plafonné au solde', () => {
    WEATHER.pluieMaudite.pool = { loseGold: { weight: 1, die: 2 } }; // dé fixe = 2
    const { get, set } = makeStore({ teams: [
      { emoji: '🟦', name: 'A', money: 100 },
      { emoji: '🟥', name: 'B', money: 1 },
    ] });
    triggerWeather(set, get, 'pluieMaudite', { forced: true });
    expect(get().teams[0].money).toBe(98);
    expect(get().teams[1].money).toBe(0); // plafonné (1 < 2)
  });

  it('blocage d’achat : pose shopBlockedTurns sur toutes les équipes', () => {
    WEATHER.pluieMaudite.pool = { blockShop: { weight: 1, turns: 2 } };
    const { get, set } = makeStore({ teams: [{ emoji: '🟦', name: 'A' }, { emoji: '🟥', name: 'B' }] });
    triggerWeather(set, get, 'pluieMaudite', { forced: true });
    expect(get().teams.every((t) => t.shopBlockedTurns === 2)).toBe(true);
  });

  it('sablier + mélange : pose les flags timer/modeleur sur toutes les équipes', () => {
    WEATHER.pluieMaudite.pool = { curseTimer: { weight: 1, divisor: 3, interval: 2 } };
    const { get, set } = makeStore({ teams: [{ emoji: '🟦', name: 'A' }] });
    triggerWeather(set, get, 'pluieMaudite', { forced: true });
    const t = get().teams[0];
    expect(t.sablierActif).toBe(true);
    expect(t.sablierDivisor).toBe(3);
    expect(t.modeleurInterval).toBe(2);
  });
});

describe('weather — préavis', () => {
  it('une météo punitive non forcée pose un préavis (pas de résolution immédiate)', () => {
    const { get, set } = makeStore({ teams: [{ emoji: '🟦', name: 'A', equipment: { head: 'x', body: null, feet: null }, money: 0 }] });
    triggerWeather(set, get, 'pluieAcide', {});
    expect(get().weatherNotice?.id).toBe('pluieAcide');
    expect(get().weatherCeremony).toBe(null); // pas encore résolue
    expect(get().teams[0].equipment.head).toBe('x'); // intact tant que pas résolu
  });

  it('forcée (admin) : résolution immédiate sans préavis', () => {
    const { get, set } = makeStore({ teams: [{ emoji: '🟦', name: 'A', equipment: { head: 'x', body: null, feet: null }, money: 0 }] });
    triggerWeather(set, get, 'pluieAcide', { forced: true });
    expect(get().weatherNotice).toBe(null);
    expect(get().weatherCeremony?.id).toBe('pluieAcide');
    expect(get().teams[0].equipment.head).toBe(null); // résolue
  });
});
