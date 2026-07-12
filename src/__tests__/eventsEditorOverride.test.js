// Éditeur d'événements « puissant » : override partiel des intégrés (params/tone),
// classement d'éditabilité, aller-retour DB, et lecture des params par les handlers.
import { describe, it, expect, afterEach } from 'vitest';
import {
  EVENTS, BUILTIN_EVENTS, setCustomEvents, eventEditability, eventTone,
  EVENT_PARAMS_SCHEMA, defaultEventParams,
} from '../data/events.js';
import { eventToPayload } from '../logic/eventsConfig.js';
import { describeAction } from '../components/Setup/EffectBuilder.jsx';
import { useGameStore } from '../store/gameStore.js';

afterEach(() => setCustomEvents({})); // revert aux défauts codés

describe('classement d’éditabilité', () => {
  it('classe les 53 intégrés (scripted / params / structural)', () => {
    const tally = { scripted: 0, params: 0, structural: 0 };
    for (const key of Object.keys(BUILTIN_EVENTS)) {
      const t = eventEditability(key);
      expect(['scripted', 'params', 'structural']).toContain(t);
      tally[t]++;
    }
    expect(tally.scripted).toBeGreaterThanOrEqual(15);
    expect(tally.params).toBeGreaterThanOrEqual(20);
    expect(tally.structural).toBeGreaterThanOrEqual(10);
  });

  it('bossProf = params ; benediction = scripted ; teleport = structural ; clé inconnue = custom', () => {
    expect(eventEditability('bossProf')).toBe('params');
    expect(eventEditability('benediction')).toBe('scripted');
    expect(eventEditability('teleport')).toBe('structural');
    expect(eventEditability('c-perso-xyz')).toBe('custom');
  });

  it('les défauts de params sont injectés sur les intégrés depuis le schéma', () => {
    for (const key of Object.keys(EVENT_PARAMS_SCHEMA)) {
      expect(BUILTIN_EVENTS[key].params).toEqual(defaultEventParams(key));
    }
    expect(BUILTIN_EVENTS.recul.params.back).toBe(2);
    expect(BUILTIN_EVENTS.jackpot.params).toEqual({ win: 30, lose: 10 });
  });
});

describe('setCustomEvents — override partiel des intégrés', () => {
  it('fusionne params en profondeur et préserve effect/gating/comportement', () => {
    setCustomEvents({ jackpot: { name: 'Méga Jackpot', params: { win: 99 } } });
    const ev = EVENTS.jackpot;
    expect(ev.name).toBe('Méga Jackpot');
    expect(ev.params).toEqual({ win: 99, lose: 10 }); // lose conservé (défaut)
    expect(ev.effect).toBe('jackpot');               // champ codé préservé
    expect(ev.needsQuestion).toBe(true);             // gating préservé
    expect(ev.overridden).toBe(true);
  });

  it('un override tone prime (eventTone)', () => {
    expect(eventTone('tresor')).toBe('positive');
    setCustomEvents({ tresor: { tone: 'gamble' } });
    expect(eventTone('tresor')).toBe('gamble');
  });

  it('n’écrase JAMAIS le gating (needsItems/requires) d’un intégré', () => {
    setCustomEvents({ herboriste: { needsItems: false, requires: [], name: 'X' } });
    expect(EVENTS.herboriste.requires).toEqual(['alchemy']); // gating codé intact
    expect(EVENTS.herboriste.name).toBe('X');
  });

  it('n’injecte PAS d’actions dans un flux codé (params/structural)', () => {
    setCustomEvents({ recul: { actions: [{ action: 'money', mode: 'gain', target: 'self', n: 999 }] } });
    // recul (params) : ses actions restent celles du built-in (aucune → flux codé intact)
    expect(EVENTS.recul.actions).toBeUndefined();
  });

  it('applique les actions éditées d’un événement scripté', () => {
    const acts = [{ action: 'money', mode: 'gain', target: 'self', n: 7, unit: 'flat' }];
    setCustomEvents({ benediction: { actions: acts } });
    expect(EVENTS.benediction.actions).toEqual(acts);
  });

  it('un événement perso (clé nouvelle) reste un objet complet', () => {
    setCustomEvents({ 'c-truc': { name: 'Truc', icon: '🎈', needsItems: true, actions: [] } });
    expect(EVENTS['c-truc'].name).toBe('Truc');
    expect(EVENTS['c-truc'].needsItems).toBe(true);
  });
});

describe('aller-retour DB (eventToPayload)', () => {
  it('transporte tone et params', () => {
    const p = eventToPayload({ key: 'recul', name: 'R', tone: 'negative', params: { back: 5 } });
    expect(p.tone).toBe('negative');
    expect(p.params).toEqual({ back: 5 });
  });
  it('params/tone absents → null', () => {
    const p = eventToPayload({ key: 'x', name: 'X' });
    expect(p.tone).toBeNull();
    expect(p.params).toBeNull();
  });
});

describe('catalogue d’actions complété (alchimie/enchantement)', () => {
  it('les 5 nouveaux types se décrivent correctement', () => {
    expect(describeAction({ action: 'grantIngredient', target: 'self', n: 2 })).toContain('ingrédient');
    expect(describeAction({ action: 'discoverRecipe', target: 'self' })).toContain('recette');
    expect(describeAction({ action: 'grantItem', target: 'self', key: '' })).toContain('objet');
    expect(describeAction({ action: 'enchantEquipped', target: 'self' })).toContain('enchant');
    expect(describeAction({ action: 'unenchant', target: 'self' })).toContain('enchantement');
  });
});

describe('handlers — lecture des params (fallback = défaut)', () => {
  const BOARD = (() => {
    const b = { depart: { x: 0, y: 0, type: 'depart', next: ['n1'] } };
    for (let i = 1; i <= 8; i++) b[`n${i}`] = { x: i, y: 0, type: 'subject', subject: 'maths', next: [i === 8 ? 'arrivee' : `n${i + 1}`] };
    b.arrivee = { x: 9, y: 0, type: 'arrivee', next: [] };
    return b;
  })();
  const setup = (showEvent, money = 30, pos = 'n4') => useGameStore.setState({
    phase: 'game', devSandbox: true, board: BOARD, finished: false, currentTeam: 0, log: [],
    teams: [{ name: 'T', emoji: '🦁', color: '#111', money, correct: 0, pos, equipment: { head: null, body: null, feet: null }, bag: [], powers: {} }],
    eventApplied: false, movePath: null, pendingEventQuestion: null, extensions: {}, showEvent,
  });
  const S = () => useGameStore.getState();

  it('jackpot : params.win s’applique (99 au lieu de 30)', () => {
    setup({ key: 'jackpot', event: { ...EVENTS.jackpot, params: { win: 99, lose: 10 } }, phase: 'question', data: { questionResult: true } });
    S().applyEventEffect();
    expect(S().teams[0].money).toBe(129);
  });

  it('recul : params.back recule plus loin ; défaut = 2', () => {
    setup({ key: 'recul', event: { ...EVENTS.recul, params: { back: 5 } }, phase: 'intro', data: {} });
    S().applyEventEffect();
    expect(S().teams[0].pos).toBe('depart'); // 5 cases depuis n4 → clamp au départ

    setup({ key: 'recul', event: { ...EVENTS.recul }, phase: 'intro', data: {} }); // params par défaut (2)
    S().applyEventEffect();
    expect(S().teams[0].pos).toBe('n2');
  });
});
